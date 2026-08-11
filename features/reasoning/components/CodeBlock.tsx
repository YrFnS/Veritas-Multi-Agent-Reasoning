import { useEffect, useMemo, useRef, useState } from 'react';
import type { FC } from 'react';
import {
  tokenizeCode,
  type CodeTokenKind,
} from '../services/codeHighlight.js';

interface CodeBlockProps {
  code: string;
}

const TOKEN_CLASSES: Record<Exclude<CodeTokenKind, 'plain'>, string> = {
  comment: 'text-zinc-500 italic',
  jsonKey: 'text-veritas-cyan font-bold',
  string: 'text-green-400',
  keyword: 'text-purple-400 font-bold',
  boolean: 'text-veritas-red',
  number: 'text-veritas-gold',
  functionCall: 'text-blue-300',
};

export const CodeBlock: FC<CodeBlockProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokens = useMemo(() => tokenizeCode(code), [code]);

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    []
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Unable to copy code block.', error);
      setCopied(false);
    }
  };

  return (
    <div className="my-3 bg-zinc-950 border border-zinc-800 rounded p-3 relative group shadow-inner">
      <div className="flex justify-between items-center mb-2 border-b border-zinc-900 pb-2">
        <span className="text-[9px] text-zinc-600 font-mono">
          SOURCE_FRAGMENT
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="text-[9px] font-mono border border-zinc-800 hover:border-veritas-cyan hover:text-veritas-cyan px-2 py-0.5 rounded transition-all opacity-50 group-hover:opacity-100"
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-800">
        <pre className="text-[11px] font-mono leading-relaxed whitespace-pre font-medium">
          <code className="text-zinc-400">
            {tokens.map((token, index) => (
              <span
                key={`${index}-${token.kind}`}
                className={
                  token.kind === 'plain' ? undefined : TOKEN_CLASSES[token.kind]
                }
              >
                {token.text}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};
