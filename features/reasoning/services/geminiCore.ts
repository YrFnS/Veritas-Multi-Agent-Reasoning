import type {
  AgentConfig,
  IReasoningCore,
  JsonSchema,
  ProviderCapabilities,
  SourceMetadata,
} from '../types.js';
import { throwIfAborted, waitForRetry } from './abortUtils.js';
import { createWebSource } from './sourceUtils.js';
import { parseStrictJson } from './strictJson.js';

interface GeminiPart {
  text?: string;
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
  groundingMetadata?: {
    groundingChunks?: unknown;
  };
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: {
    message?: string;
    status?: string;
  };
}

class GeminiHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'GeminiHttpError';
  }
}

export class GeminiCore implements IReasoningCore {
  public readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    strictJsonSchema: true,
    webSearch: true,
    citations: true,
    speech: true,
  };

  private readonly baseUrl =
    'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(private readonly apiKey: string) {}

  public async generateJSON(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schema: JsonSchema,
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
        const generationConfig: Record<string, unknown> = {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          thinkingConfig: {
            thinkingLevel: this.resolveThinkingLevel(
              configOverrides.thinkingBudget
            ),
          },
          maxOutputTokens: 32768,
        };

        const usesModernGeminiSampling = /^gemini-3\.(5|6)/.test(model);
        if (!usesModernGeminiSampling) {
          generationConfig.temperature = configOverrides.temperature ?? 0.1;
          if (configOverrides.topK !== undefined) {
            generationConfig.topK = configOverrides.topK;
          }
          if (configOverrides.topP !== undefined) {
            generationConfig.topP = configOverrides.topP;
          }
        }

        const response = await this.postGenerateContent(
          model,
          {
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig,
            ...(useTools ? { tools: [{ googleSearch: {} }] } : {}),
          },
          signal
        );

        throwIfAborted(signal);

        const candidate = response.candidates?.[0];
        const text = this.readText(candidate);
        if (!text) throw new Error('Empty response from Gemini.');

        return {
          data: parseStrictJson(text, 'Gemini'),
          sources: this.normalizeSources(
            candidate?.groundingMetadata?.groundingChunks
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

        const retryable =
          !(error instanceof GeminiHttpError) || error.retryable;
        if (attempt <= maxRetries && retryable) {
          console.warn(
            `GeminiCore: execution failed (attempt ${attempt}/${maxRetries}). Retrying...`,
            error
          );
          await waitForRetry(attempt * 1000, signal);
          continue;
        }

        break;
      }
    }

    console.error('GeminiCore: fatal error after retries:', lastError);
    throw lastError instanceof Error
      ? lastError
      : new Error('Gemini request failed after retries.');
  }

  public async generateSpeech(text: string): Promise<string> {
    const response = await this.postGenerateContent(
      'gemini-2.5-flash-preview-tts',
      {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      }
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data
    )?.inlineData?.data;

    if (!base64Audio) throw new Error('No audio data returned from Gemini.');
    return base64Audio;
  }

  private async postGenerateContent(
    model: string,
    body: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<GeminiResponse> {
    const modelId = model.replace(/^models\//, '');
    const response = await fetch(
      `${this.baseUrl}/${encodeURIComponent(modelId)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal,
      }
    );

    const payload = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
      const message =
        payload.error?.message ||
        payload.error?.status ||
        `Gemini API error: ${response.status}`;
      const retryable = response.status === 429 || response.status >= 500;
      throw new GeminiHttpError(message, response.status, retryable);
    }

    return payload;
  }

  private resolveThinkingLevel(thinkingBudget: number | undefined): string {
    if (thinkingBudget === 0) return 'MINIMAL';
    if (thinkingBudget !== undefined && thinkingBudget < 4000) return 'LOW';
    return 'HIGH';
  }

  private readText(candidate: GeminiCandidate | undefined): string {
    return (candidate?.content?.parts || [])
      .map((part) => part.text || '')
      .join('')
      .trim();
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
