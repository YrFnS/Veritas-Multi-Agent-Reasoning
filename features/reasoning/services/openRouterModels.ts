export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

export interface OpenRouterModelPricing {
  prompt?: string;
  completion?: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  pricing?: OpenRouterModelPricing;
}

interface FetchModelsOptions {
  fetcher?: typeof fetch;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const parseOpenRouterModelCatalog = (
  value: unknown
): OpenRouterModel[] => {
  const root = asRecord(value);
  if (!root || !Array.isArray(root.data)) {
    throw new Error(
      'OpenRouter returned a malformed model catalog. Enter a model ID manually.'
    );
  }

  return root.data.flatMap((entry) => {
    const model = asRecord(entry);
    const id = optionalString(model?.id);
    if (!model || !id) return [];

    const pricingRecord = asRecord(model.pricing);
    const prompt = optionalString(pricingRecord?.prompt);
    const completion = optionalString(pricingRecord?.completion);
    const description = optionalString(model.description);
    const contextLength =
      typeof model.context_length === 'number' &&
      Number.isFinite(model.context_length) &&
      model.context_length > 0
        ? model.context_length
        : undefined;

    return [
      {
        id,
        name: optionalString(model.name) ?? id,
        ...(description ? { description } : {}),
        ...(contextLength ? { contextLength } : {}),
        ...(prompt || completion
          ? { pricing: { ...(prompt ? { prompt } : {}), ...(completion ? { completion } : {}) } }
          : {}),
      },
    ];
  });
};

export const isFreeOpenRouterModel = (model: OpenRouterModel): boolean => {
  const prompt = model.pricing?.prompt;
  const completion = model.pricing?.completion;
  return (
    prompt !== undefined &&
    completion !== undefined &&
    Number(prompt) === 0 &&
    Number(completion) === 0
  );
};

export const searchOpenRouterModels = (
  models: OpenRouterModel[],
  query: string,
  freeOnly = false
): OpenRouterModel[] => {
  const normalized = query.trim().toLowerCase();
  return models.filter((model) => {
    if (freeOnly && !isFreeOpenRouterModel(model)) return false;
    if (!normalized) return true;
    return `${model.name}\n${model.id}\n${model.description ?? ''}`
      .toLowerCase()
      .includes(normalized);
  });
};

export const requireOpenRouterModelId = (value: string): string => {
  const model = value.trim();
  if (!model) {
    throw new Error(
      'Select an OpenRouter model or enter its exact model ID in CFG before running AI actions.'
    );
  }
  return model;
};

export const fetchOpenRouterModels = async ({
  fetcher = fetch,
  forceRefresh = false,
  signal,
}: FetchModelsOptions = {}): Promise<OpenRouterModel[]> => {
  let response: Response;
  try {
    response = await fetcher(OPENROUTER_MODELS_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: forceRefresh ? 'reload' : 'default',
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      'OpenRouter model discovery is unavailable. Enter a model ID manually.'
    );
  }

  if (!response.ok) {
    throw new Error(
      `OpenRouter model discovery failed (${response.status}). Enter a model ID manually.`
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(
      'OpenRouter returned a malformed model catalog. Enter a model ID manually.'
    );
  }
  return parseOpenRouterModelCatalog(payload);
};
