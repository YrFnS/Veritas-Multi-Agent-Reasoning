import type { ProviderType } from '../types.js';

export const KEYS_STORAGE_KEY = 'veritas_api_keys';

export type ProviderKeyMap = Partial<Record<ProviderType, string>>;

export interface ProviderKeyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const getBrowserStorage = (): ProviderKeyStorage | undefined => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
};

export const readProviderKeys = (
  storage: ProviderKeyStorage | undefined = getBrowserStorage()
): ProviderKeyMap => {
  if (!storage) return {};

  try {
    const raw = storage.getItem(KEYS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const record = parsed as Record<string, unknown>;
    const keys: ProviderKeyMap = {};
    if (typeof record.gemini === 'string' && record.gemini.trim()) {
      keys.gemini = record.gemini.trim();
    }
    if (typeof record.openrouter === 'string' && record.openrouter.trim()) {
      keys.openrouter = record.openrouter.trim();
    }
    return keys;
  } catch {
    return {};
  }
};

export const writeProviderKey = (
  provider: ProviderType,
  value: string,
  storage: ProviderKeyStorage | undefined = getBrowserStorage()
): ProviderKeyMap => {
  const keys = readProviderKeys(storage);
  const normalized = value.trim();

  if (normalized) {
    keys[provider] = normalized;
  } else {
    delete keys[provider];
  }

  storage?.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys));
  return keys;
};

export const redactProviderSecrets = (
  value: string,
  secrets: Array<string | undefined> = []
): string => {
  let redacted = value;
  for (const secret of secrets.filter(Boolean) as string[]) {
    redacted = redacted.replaceAll(secret, '[REDACTED]');
  }
  return redacted.replace(/\bsk-(?:or-v1-)?[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]');
};

export const resolveProviderApiKey = (
  provider: ProviderType,
  storage: ProviderKeyStorage | undefined = getBrowserStorage()
): string => {
  const key = readProviderKeys(storage)[provider];
  if (!key) {
    throw new Error(
      `API key for ${provider.toUpperCase()} is missing. Add it in the configuration editor.`
    );
  }
  return key;
};
