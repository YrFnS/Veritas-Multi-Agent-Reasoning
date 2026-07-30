import { GoogleGenAI, Schema, Modality, ThinkingLevel } from '@google/genai';
import type {
  AgentConfig,
  IReasoningCore,
  ProviderCapabilities,
  SourceMetadata,
} from '../types.js';
import { throwIfAborted, waitForRetry } from './abortUtils.js';
import { createWebSource } from './sourceUtils.js';
import { parseStrictJson } from './strictJson.js';

export class GeminiCore implements IReasoningCore {
  public readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    strictJsonSchema: true,
    webSearch: true,
    citations: true,
    speech: true,
  };

  private readonly ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  public async generateJSON(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schema: Schema,
    useTools = false,
    configOverrides: Partial<AgentConfig> = {},
    signal?: AbortSignal
  ): Promise<{ data: unknown; sources?: SourceMetadata[] }> {
    const maxRetries = 2;
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      throwIfAborted(signal);

      try {
        let thinkingLevel = ThinkingLevel.HIGH;
        if (configOverrides.thinkingBudget !== undefined) {
          if (configOverrides.thinkingBudget === 0) {
            thinkingLevel = ThinkingLevel.MINIMAL;
          } else if (configOverrides.thinkingBudget < 4000) {
            thinkingLevel = ThinkingLevel.LOW;
          }
        }

        const config: any = {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: schema,
          thinkingConfig: { thinkingLevel },
          maxOutputTokens: 32768,
          abortSignal: signal,
        };

        const usesModernGeminiSampling = /^gemini-3\.(5|6)/.test(model);
        if (!usesModernGeminiSampling) {
          config.temperature = configOverrides.temperature ?? 0.1;
          if (configOverrides.topK !== undefined) {
            config.topK = configOverrides.topK;
          }
          if (configOverrides.topP !== undefined) {
            config.topP = configOverrides.topP;
          }
        }

        if (useTools) config.tools = [{ googleSearch: {} }];

        const response = await this.ai.models.generateContent({
          model,
          contents: userPrompt,
          config,
        });

        throwIfAborted(signal);

        const text = response.text;
        if (!text) throw new Error('Empty response from Gemini.');

        return {
          data: parseStrictJson(text, 'Gemini'),
          sources: this.normalizeSources(
            response.candidates?.[0]?.groundingMetadata?.groundingChunks
          ),
        };
      } catch (error) {
        if (
          signal?.aborted ||
          (error instanceof Error &&
            (error.name === 'AbortError' ||
              error.message === 'ABORT_SEQUENCE_RECEIVED'))
        ) {
          throw new Error('ABORT_SEQUENCE_RECEIVED');
        }

        lastError = error;
        attempt += 1;

        if (attempt <= maxRetries) {
          console.warn(
            `GeminiCore: execution failed (attempt ${attempt}/${maxRetries}). Retrying...`,
            error
          );
          await waitForRetry(attempt * 1000, signal);
        }
      }
    }

    console.error('GeminiCore: fatal error after retries:', lastError);
    throw lastError instanceof Error
      ? lastError
      : new Error('Gemini request failed after retries.');
  }

  public async generateSpeech(text: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
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

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error('No audio data returned.');
      return base64Audio;
    } catch (error) {
      console.error('GeminiCore: TTS failed:', error);
      throw error;
    }
  }

  private normalizeSources(chunks: unknown): SourceMetadata[] {
    if (!Array.isArray(chunks)) return [];

    return chunks.flatMap((chunk) => {
      if (typeof chunk !== 'object' || chunk === null) return [];
      const web = (chunk as { web?: unknown }).web;
      if (typeof web !== 'object' || web === null) return [];

      const source = createWebSource(
        (web as { uri?: unknown }).uri,
        (web as { title?: unknown }).title
      );
      return source ? [source] : [];
    });
  }
}
