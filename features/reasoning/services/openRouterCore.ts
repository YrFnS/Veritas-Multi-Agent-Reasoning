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
    schema: JsonSchema,
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

  private toJsonSchema(schema: JsonSchema): Record<string, unknown> {
    const output: Record<string, unknown> = {
      type: schema.type,
    };

    if (schema.description !== undefined) {
      output.description = schema.description;
    }
    if (schema.enum !== undefined) output.enum = schema.enum;
    if (schema.required !== undefined) output.required = schema.required;
    if (schema.minItems !== undefined) output.minItems = schema.minItems;
    if (schema.maxItems !== undefined) output.maxItems = schema.maxItems;
    if (schema.items) output.items = this.toJsonSchema(schema.items);

    if (schema.properties) {
      output.properties = Object.fromEntries(
        Object.entries(schema.properties).map(([name, child]) => [
          name,
          this.toJsonSchema(child),
        ])
      );
    }

    if (schema.type === 'object') {
      output.additionalProperties = schema.additionalProperties ?? false;
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
