export type CodeTokenKind =
  | 'plain'
  | 'comment'
  | 'jsonKey'
  | 'string'
  | 'keyword'
  | 'boolean'
  | 'number'
  | 'functionCall';

export interface CodeToken {
  kind: CodeTokenKind;
  text: string;
}

const TOKEN_PATTERN =
  /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(?<jsonKey>"(?:\\.|[^"\\])*"(?=\s*:))|(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?<keyword>\b(?:const|let|var|function|return|if|else|for|while|import|export|from|class|interface|type|async|await|try|catch|switch|case|break)\b)|(?<boolean>\b(?:true|false|null|undefined)\b)|(?<number>\b\d+(?:\.\d+)?\b)|(?<functionCall>\b[A-Za-z_$][\w$]*(?=\s*\())/g;

const tokenKind = (groups: Record<string, string | undefined>): CodeTokenKind => {
  if (groups.comment !== undefined) return 'comment';
  if (groups.jsonKey !== undefined) return 'jsonKey';
  if (groups.string !== undefined) return 'string';
  if (groups.keyword !== undefined) return 'keyword';
  if (groups.boolean !== undefined) return 'boolean';
  if (groups.number !== undefined) return 'number';
  return 'functionCall';
};

export const tokenizeCode = (input: string): CodeToken[] => {
  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of input.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? cursor;
    if (index > cursor) {
      tokens.push({ kind: 'plain', text: input.slice(cursor, index) });
    }

    tokens.push({
      kind: tokenKind(match.groups || {}),
      text: match[0],
    });
    cursor = index + match[0].length;
  }

  if (cursor < input.length) {
    tokens.push({ kind: 'plain', text: input.slice(cursor) });
  }

  return tokens;
};
