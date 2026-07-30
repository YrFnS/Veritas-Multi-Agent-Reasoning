import { Schema } from '@google/genai';
import type {
  AgentConfig,
  IReasoningCore,
  ProviderCapabilities,
  SourceMetadata,
} from '../types.js';
import { throwIfAborted, waitForRetry } from './abortUtils.js';
import { createWebSource } from './sourceUtils.js';
import { parseStrictJson } from './strictJson.js';

interface OpenRouterAnnotation {
  type?: string;
  url_citation?: {
    url?: string;
    title?: string;
  };
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
      annotations?: OpenRouterAnnotation[];
    };
  }>;
}

export class OpenRouterCore implements IReasoningCore {
  public readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    strictJsonSchema: true,
    webSearch: false,
    citations: false,
    speech: false,
  };

  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor(private readonly apiKey: string) {}

  public async generateJSON(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    schema: Schema,
    _useTools = false,
    configOverrides: Partial<AgentConfig> = {},
    signal?: AbortSignal
  ): Promise<{ data: unknown; sources?: SourceMetadata[] }> {
    const maxRetries = 2;
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      throwIfAborted(signal);

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Veritas Truth Engine',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'veritas_response',
                strict: true,
                schema: this.toJsonSchema(schema),
              },
            },
            provider: { require_parameters: true },
            temperature: configOverrides.temperature ?? 0.1,
          }),
          signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const message =
            (errorData as { error?: { message?: string } }).error?.message ||
            `OpenRouter error: ${response.status}`;
          throw new Error(message);
        }

        const result = (await response.json()) as OpenRouterResponse;
        const message = result.choices?.[0]?.message;
        const text = message?.content;
        if (!text) throw new Error('Empty response from OpenRouter.');

        return {
          data: parseStrictJson(text, 'OpenRouter'),
          sources: this.normalizeSources(message.annotations),
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
            `OpenRouterCore: execution failed (attempt ${attempt}/${maxRetries}). Retrying...`,
            error
          );
          await waitForRetry(attempt * 1000, signal);
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('OpenRouter request failed after retries.');
  }

  private toJsonSchema(schema: unknown): Record<string, unknown> {
    if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
      return {};
    }

    const input = schema as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (key === 'type' && typeof value === 'string') {
        output.type = value.toLowerCase();
      } else if (key === 'properties' && value && typeof value === 'object') {
        output.properties = Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(
            ([name, child]) => [name, this.toJsonSchema(child)]
          )
        );
      } else if (key === 'items') {
        output.items = this.toJsonSchema(value);
      } else if (
        key === 'required' ||
        key === 'enum' ||
        key === 'description' ||
        key === 'format'
      ) {
        output[key] = value;
      }
    }

    if (output.type === 'object') {
      output.additionalProperties = false;
    }

    return output;
  }

  private normalizeSources(
    annotations: OpenRouterAnnotation[] | undefined
  ): SourceMetadata[] {
    if (!annotations) return [];

    return annotations.flatMap((annotation) => {
      if (annotation.type !== 'url_citation') return [];
      const source = createWebSource(
        annotation.url_citation?.url,
        annotation.url_citation?.title
      );
      return source ? [source] : [];
    });
  }
}
