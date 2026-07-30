import type { SourceMetadata } from '../types.js';

const toSafeHttpUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export const createWebSource = (
  uri: unknown,
  title: unknown
): SourceMetadata | null => {
  if (typeof uri !== 'string') return null;
  const safeUri = toSafeHttpUrl(uri.trim());
  if (!safeUri) return null;

  const safeTitle =
    typeof title === 'string' && title.trim() ? title.trim() : safeUri;

  return {
    web: {
      uri: safeUri,
      title: safeTitle,
    },
  };
};

export const dedupeSources = (
  sources: SourceMetadata[] | undefined
): SourceMetadata[] => {
  if (!sources?.length) return [];

  const seen = new Set<string>();
  const result: SourceMetadata[] = [];

  for (const source of sources) {
    const normalized = createWebSource(source.web?.uri, source.web?.title);
    const uri = normalized?.web?.uri;
    if (!normalized || !uri || seen.has(uri)) continue;
    seen.add(uri);
    result.push(normalized);
  }

  return result;
};
