export class StrictJsonParseError extends Error {
  constructor(providerName: string) {
    super(`${providerName} returned malformed JSON; the response was rejected.`);
    this.name = 'StrictJsonParseError';
  }
}

export const parseStrictJson = (
  text: string,
  providerName: string
): unknown => {
  const normalized = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```\s*$/, '')
    .trim();

  try {
    return JSON.parse(normalized);
  } catch {
    throw new StrictJsonParseError(providerName);
  }
};
