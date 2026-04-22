
import { GoogleGenAI, Schema, Modality, ThinkingLevel } from "@google/genai";
import { AgentConfig, IReasoningCore } from "../types";

/**
 * GeminiCore: The low-level communication layer.
 * Responsibilities: 
 * 1. Initialize API
 * 2. Handle Retry Logic & Error handling
 * 3. Handle JSON Parsing/Cleaning
 * 4. Handle Raw TTS generation
 */
export class GeminiCore implements IReasoningCore {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generates a JSON response from a model with robust error handling and retries.
   */
  public async generateJSON(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schema: Schema,
    useTools: boolean = false,
    configOverrides: Partial<AgentConfig> = {},
    signal?: AbortSignal
  ): Promise<{ data: any; sources?: any[] }> {
    const MAX_RETRIES = 2;
    let attempt = 0;
    let lastError: any;

    while (attempt <= MAX_RETRIES) {
      if (signal?.aborted) throw new Error("ABORT_SEQUENCE_RECEIVED");
      try {
        // Map thinkingBudget to ThinkingLevel
        // Note: gemini-3.1-pro-preview defaults to HIGH
        let thinkingLevel = ThinkingLevel.HIGH;
        if (configOverrides.thinkingBudget !== undefined) {
            if (configOverrides.thinkingBudget === 0) thinkingLevel = ThinkingLevel.MINIMAL;
            else if (configOverrides.thinkingBudget < 4000) thinkingLevel = ThinkingLevel.LOW;
        }

        const config: any = {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: configOverrides.temperature ?? 0.1,
          thinkingConfig: { thinkingLevel },
          // CRITICAL: maxOutputTokens must be large enough to include both thinking and response.
          // Truncation leads to JSON parse errors.
          maxOutputTokens: 32768, 
        };

        if (configOverrides.topK) config.topK = configOverrides.topK;
        if (configOverrides.topP) config.topP = configOverrides.topP;
        if (useTools) config.tools = [{ googleSearch: {} }];

        const response = await this.ai.models.generateContent({
          model,
          contents: userPrompt,
          config,
        });

        if (signal?.aborted) throw new Error("ABORT_SEQUENCE_RECEIVED");

        const text = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

        if (!text) throw new Error("Empty response from AI");
        
        try {
          return {
            data: this.cleanAndParseJSON(text),
            sources: groundingChunks
          };
        } catch (parseError) {
          // If it's a parse error, maybe we can heal it if it's truncated
          const healedData = this.attemptHealJSON(text);
          if (healedData) {
            return {
              data: healedData,
              sources: groundingChunks
            };
          }
          throw parseError;
        }

      } catch (error) {
        if (error instanceof Error && error.message === "ABORT_SEQUENCE_RECEIVED") throw error;
        lastError = error;
        attempt++;
        if (attempt <= MAX_RETRIES) {
          console.warn(`GeminiCore: Execution failed (Attempt ${attempt}/${MAX_RETRIES}). Retrying...`, error);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    console.error("GeminiCore: Fatal Error after retries:", lastError);
    throw lastError;
  }

  /**
   * Generates raw audio bytes for TTS.
   */
  public async generateSpeech(text: string): Promise<string> {
    try {
        const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio data returned");
        return base64Audio;
    } catch (e) {
        console.error("GeminiCore: TTS Failed:", e);
        throw e;
    }
  }

  private cleanAndParseJSON(text: string): any {
    try {
      // 1. First attempt: Direct parse (fastest)
      return JSON.parse(text);
    } catch (e) {
      // 2. Second attempt: Remove markdown code blocks
      try {
        const cleanText = text.replace(/```json\n?|```\n?/g, "").trim();
        return JSON.parse(cleanText);
      } catch (e2) {
        // 3. Third attempt: Robust extraction of the first JSON object
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
             return JSON.parse(jsonMatch[0]);
          }
          throw new Error("No JSON object found in response");
        } catch (e3) {
           throw new Error(`JSON Parse Error. Raw text: ${text}`);
        }
      }
    }
  }

  /**
   * Attempt to heal truncated JSON by closing open structures.
   */
  private attemptHealJSON(text: string): any {
    let healed = text.trim();
    
    // If it ends with a comma, strip it
    if (healed.endsWith(',')) {
      healed = healed.slice(0, -1);
    }

    // If it ends with a key and colon like "flaws":
    if (healed.endsWith('":')) {
      healed += ' []'; // Assume empty array for common truncation point
    } else if (healed.endsWith('"')) {
      // Ends mid-string or mid-key
      // Hard to heal reliably, but let's try to close it
    }

    // Stack-based bracket closer
    const stack: string[] = [];
    for (let i = 0; i < healed.length; i++) {
        const char = healed[i];
        if (char === '{') stack.push('}');
        else if (char === '[') stack.push(']');
        else if (char === '}' && stack[stack.length - 1] === '}') stack.pop();
        else if (char === ']' && stack[stack.length - 1] === ']') stack.pop();
    }

    while (stack.length > 0) {
        healed += stack.pop();
    }

    try {
        return JSON.parse(healed);
    } catch (e) {
        return null;
    }
  }
}
