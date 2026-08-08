import type {
  AgentConfig,
  IReasoningCore,
  JsonSchema,
  ProviderCapabilities,
  SourceMetadata,
} from '../types.js';
import { throwIfAborted, waitForRetry } from './abortUtils.js';
import { requireOpenRouterModelId } from './openRouterModels.js';
import { redactProviderSecrets } from './providerKeys.js';
import { createWebSource } from './sourceUtils.js';
import { parseStrictJson } from './strictJson.js';

export const OPENROUTER_CHAT_COMPLETIONS_URL =
  'https://openrouter.ai/api/v1/chat/completions';

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

class OpenRouterHttpError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'OpenRouterHttpError';
  }
}

const readOpenRouterError = async (
  response: Response,
  apiKey: string
): Promise<OpenRouterHttpError> => {
  if (response.status === 401 || response.status === 403) {
    return new OpenRouterHttpError(
      'OpenRouter rejected the API key. Re-enter it in CFG and try again.',
      false
    );
  }
  if (response.status === 402) {
    return new OpenRouterHttpError(
      'OpenRouter reports insufficient credits for this request. Check the account or select a free model.',
      false
    );
  }
  if (response.status === 429) {
    return new OpenRouterHttpError(
      'OpenRouter rate-limited the request. Wait briefly and try again.',
      true
    );
  }

  let details = '';
  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown };
    };
    if (typeof payload.error?.message === 'string') {
      details = redactProviderSecrets(payload.error.message, [apiKey]);
    }
  } catch {
    // Status-specific guidance below remains actionable without response JSON.
  }

  const message = `OpenRouter request failed (${response.status})${
    details ? `: ${details}` : '. Try again or select another model.'
  }`;
  return new OpenRouterHttpError(message, response.status >= 500);
};

export class OpenRouterCore implements IReasoningCore {
  public readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    strictJsonSchema: true,
    webSearch: false,
    citations: false,
    speech: false,
  };

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
    const modelId = requireOpenRouterModelId(model);
    const maxRetries = 2;
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      throwIfAborted(signal);

      try {
        const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            ...(typeof window !== 'undefined'
              ? { 'HTTP-Referer': window.location.origin }
              : {}),
            'X-Title': 'Veritas Truth Engine',
          },
          body: JSON.stringify({
            model: modelId,
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

        if (!response.ok) throw await readOpenRouterError(response, this.apiKey);

        let result: OpenRouterResponse;
        try {
          result = (await response.json()) as OpenRouterResponse;
        } catch {
          throw new OpenRouterHttpError(
            'OpenRouter returned malformed response JSON. Try another model or retry the request.',
            false
          );
        }

        const message = result.choices?.[0]?.message;
        const text = message?.content;
        if (typeof text !== 'string' || !text.trim()) {
          throw new OpenRouterHttpError(
            'OpenRouter returned a malformed completion. Try another model or retry the request.',
            false
          );
        }

        let data: unknown;
        try {
          data = parseStrictJson(text, 'OpenRouter');
        } catch (error) {
          throw new OpenRouterHttpError(
            error instanceof Error
              ? error.message
              : 'OpenRouter returned invalid structured output.',
            false
          );
        }

        return {
          data,
          sources: this.normalizeSources(message?.annotations),
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
          !(error instanceof OpenRouterHttpError) || error.retryable;
        if (attempt <= maxRetries && retryable) {
          console.warn(
            `OpenRouter request failed; retrying (${attempt}/${maxRetries}).`
          );
          await waitForRetry(attempt * 1000, signal);
        } else {
          break;
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
