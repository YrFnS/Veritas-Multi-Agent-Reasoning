import React from 'react';

interface CodeBlockProps {
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code }) => {
  // Regex patterns for syntax highlighting
  const patterns = {
    keyword: /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|interface|type|async|await)\b/g,
    string: /("[^"]*"|'[^']*'|`[^`]*`)/g,
    number: /\b(\d+)\b/g,
    comment: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
    boolean: /\b(true|false|null|undefined)\b/g,
    functionCall: /\b([a-zA-Z0-9_]+)(?=\()/g
  };

  const highlightCode = (input: string) => {
    let output = input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    output = output
      .replace(patterns.string, '<span class="text-green-400">$1</span>')
      .replace(patterns.comment, '<span class="text-zinc-500 italic">$1</span>')
      .replace(patterns.keyword, '<span class="text-veritas-cyan font-bold">$1</span>')
      .replace(patterns.boolean, '<span class="text-veritas-red">$1</span>')
      .replace(patterns.number, '<span class="text-veritas-gold">$1</span>')
      .replace(patterns.functionCall, '<span class="text-blue-300">$1</span>');

    return output;
  };

  return (
      <div className="my-3 bg-zinc-950 border border-zinc-800 rounded p-3 overflow-x-auto relative group">
        <div className="absolute top-0 right-0 px-2 py-0.5 text-[9px] text-zinc-600 font-mono border-b border-l border-zinc-800 rounded-bl bg-zinc-900 opacity-50 group-hover:opacity-100 transition-opacity">
            CODE_FRAGMENT
        </div>
        <pre className="text-[11px] font-mono leading-relaxed whitespace-pre">
            <code className="text-zinc-300" dangerouslySetInnerHTML={{ __html: highlightCode(code) }} />
        </pre>
      </div>
  );
};