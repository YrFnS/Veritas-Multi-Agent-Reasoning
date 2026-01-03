
import React, { useState } from 'react';

interface CodeBlockProps {
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  // Regex patterns for syntax highlighting
  const patterns = {
    keyword: /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|interface|type|async|await|try|catch|switch|case|break)\b/g,
    jsonKey: /"([a-zA-Z0-9_]+)":/g,
    string: /("[^"]*"|'[^']*'|`[^`]*`)/g,
    number: /\b(\d+(\.\d+)?)\b/g,
    comment: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
    boolean: /\b(true|false|null|undefined)\b/g,
    functionCall: /\b([a-zA-Z0-9_]+)(?=\()/g
  };

  const highlightCode = (input: string) => {
    let output = input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Apply highlighting (Order matters to avoid nested span issues in simple regex replacement)
    output = output
      .replace(patterns.comment, '<span class="text-zinc-500 italic">$1</span>')
      .replace(patterns.jsonKey, '<span class="text-veritas-cyan font-bold">"$1"</span>:') // Special handling for JSON keys
      .replace(patterns.string, '<span class="text-green-400">$1</span>')
      .replace(patterns.keyword, '<span class="text-purple-400 font-bold">$1</span>')
      .replace(patterns.boolean, '<span class="text-veritas-red">$1</span>')
      .replace(patterns.number, '<span class="text-veritas-gold">$1</span>')
      .replace(patterns.functionCall, '<span class="text-blue-300">$1</span>');

    return output;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
      <div className="my-3 bg-zinc-950 border border-zinc-800 rounded p-3 relative group shadow-inner">
        <div className="flex justify-between items-center mb-2 border-b border-zinc-900 pb-2">
            <span className="text-[9px] text-zinc-600 font-mono">SOURCE_FRAGMENT</span>
            <button 
                onClick={handleCopy}
                className="text-[9px] font-mono border border-zinc-800 hover:border-veritas-cyan hover:text-veritas-cyan px-2 py-0.5 rounded transition-all opacity-50 group-hover:opacity-100"
            >
                {copied ? 'COPIED' : 'COPY'}
            </button>
        </div>
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-800">
            <pre className="text-[11px] font-mono leading-relaxed whitespace-pre font-medium">
                <code className="text-zinc-400" dangerouslySetInnerHTML={{ __html: highlightCode(code) }} />
            </pre>
        </div>
      </div>
  );
};
