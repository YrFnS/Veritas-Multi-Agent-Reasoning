import { GoogleGenAI, Schema, Modality } from "@google/genai";
import { AgentConfig } from "../types";
import { checkAuthStatus, isBackendAvailable } from "../../../services/backendProxy";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * GeminiCore: The low-level communication layer.
 * Responsibilities: 
 * 1. Initialize API (SDK or OAuth proxy)
 * 2. Handle Retry Logic & Error handling
 * 3. Handle JSON Parsing/Cleaning
 * 4. Handle Raw TTS generation
 */
export class GeminiCore {
  private ai: GoogleGenAI | null = null;
  private apiKey: string | null = null;
  private useOAuth: boolean = false;

  constructor(apiKey: string | null, useOAuth: boolean = false) {
    this.apiKey = apiKey;
    this.useOAuth = useOAuth;

    if (apiKey && !useOAuth) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Check if we should use OAuth proxy
   */
  private shouldUseOAuthProxy(): boolean {
    return this.useOAuth && isBackendAvailable();
  }

  /**
   * Generate content via OAuth backend proxy
   */
  private async generateViaBackend(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.1
  ): Promise<string> {
    const messages = [
      { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
    ];

    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ messages, model, temperature })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Backend error: ${response.status}`);
    }

    // Read SSE stream and collect text
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) fullText += parsed.text;
            if (parsed.error) throw new Error(parsed.error);
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return fullText;
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
        const temperature = configOverrides.temperature ?? 0.1;

        // Use OAuth backend if authenticated
        if (this.shouldUseOAuthProxy()) {
          console.log('🔐 Using OAuth backend proxy for API call');

          // Convert schema to human-readable format for the prompt
          const schemaDescription = this.schemaToDescription(schema);
          const jsonInstruction = `\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, just raw JSON.\n\nRequired JSON Schema:\n${schemaDescription}`;
          const enhancedPrompt = userPrompt + jsonInstruction;

          const text = await this.generateViaBackend(model, systemPrompt, enhancedPrompt, temperature);

          if (!text) throw new Error("Empty response from OAuth backend");

          return {
            data: this.cleanAndParseJSON(text),
            sources: [] // Backend doesn't return grounding yet
          };
        }

        // Use direct SDK with API key
        if (!this.ai) {
          throw new Error("No API key configured and OAuth not available");
        }

        const config: any = {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature,
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
   * Note: TTS still uses direct SDK as it requires special modalities
   */
  public async generateSpeech(text: string): Promise<string> {
    // TTS requires direct SDK access
    if (!this.ai && this.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }

    if (!this.ai) {
      throw new Error("TTS requires API key - not available via OAuth");
    }

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

  /**
   * Convert a Schema object to human-readable description for prompts
   */
  private schemaToDescription(schema: Schema): string {
    const props = schema.properties || {};
    const required = (schema as any).required || [];

    const lines: string[] = ['{'];

    for (const [key, value] of Object.entries(props)) {
      const prop = value as any;
      const isRequired = required.includes(key);
      const typeStr = prop.type || 'string';
      const desc = prop.description ? ` // ${prop.description}` : '';
      const reqMark = isRequired ? ' (REQUIRED)' : '';
      lines.push(`  "${key}": <${typeStr}>${reqMark}${desc}`);
    }

    lines.push('}');
    return lines.join('\n');
  }
}