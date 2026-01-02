import { GoogleGenAI, Schema, Modality } from "@google/genai";
import { AgentConfig } from "../types";

/**
 * GeminiCore: The low-level communication layer.
 * Responsibilities: 
 * 1. Initialize API
 * 2. Handle Retry Logic & Error handling
 * 3. Handle JSON Parsing/Cleaning
 * 4. Handle Raw TTS generation
 */
export class GeminiCore {
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
    configOverrides: Partial<AgentConfig> = {}
  ): Promise<{ data: any; sources?: any[] }> {
    const MAX_RETRIES = 2;
    let attempt = 0;
    let lastError: any;

    while (attempt <= MAX_RETRIES) {
      try {
        const config: any = {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: configOverrides.temperature ?? 0.1,
          thinkingConfig: { thinkingBudget: 2048 },
          maxOutputTokens: 8192,
        };

        if (configOverrides.topK) config.topK = configOverrides.topK;
        if (configOverrides.topP) config.topP = configOverrides.topP;
        if (useTools) config.tools = [{ googleSearch: {} }];

        const response = await this.ai.models.generateContent({
          model,
          contents: userPrompt,
          config,
        });

        const text = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

        if (!text) throw new Error("Empty response from AI");
        
        return {
          data: this.cleanAndParseJSON(text),
          sources: groundingChunks
        };

      } catch (error) {
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
      const cleanText = text.replace(/```json\n?|```\n?/g, "").trim();
      return JSON.parse(cleanText);
    } catch (e) {
      console.error("JSON Parse Error. Raw text:", text);
      throw new Error("Failed to parse agent response. The agent may have deviated from the protocol.");
    }
  }
}