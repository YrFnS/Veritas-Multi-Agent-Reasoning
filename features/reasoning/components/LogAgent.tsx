import React from 'react';
import type { AgentConfig, LogEntry } from '../types';
import { TerminalText } from '../../../components/TerminalText';
import { CodeBlock } from './CodeBlock';
import { DataStream } from './DataStream';

interface LogAgentProps {
  log: LogEntry;
  agents: AgentConfig[];
}

export const LogAgent: React.FC<LogAgentProps> = ({ log, agents }) => {
  const getAgentColor = (role: string) => {
    const agent = agents.find((candidate) => candidate.role === role);
    return agent ? agent.color : 'text-gray-500';
  };

  const renderContent = (content: string, isThinking: boolean) => {
    if (isThinking) return null;

    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const rawCode = part.replace(/^```[a-z]*\n?|```$/g, '');
        return <CodeBlock key={index} code={rawCode} />;
      }

      if (!part.trim()) return null;

      const lines = part.split('\n');
      const groups: { type: 'header' | 'bullet' | 'text'; content: string }[] =
        [];
      let currentTextBlock = '';

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          if (currentTextBlock) currentTextBlock += '\n';
          return;
        }

        const isHeader = trimmed.startsWith('##');
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');

        if (isHeader || isBullet) {
          if (currentTextBlock) {
            groups.push({ type: 'text', content: currentTextBlock });
            currentTextBlock = '';
          }
          if (isHeader) groups.push({ type: 'header', content: line });
          if (isBullet) groups.push({ type: 'bullet', content: line });
        } else {
          currentTextBlock += (currentTextBlock ? '\n' : '') + line;
        }
      });

      if (currentTextBlock) {
        groups.push({ type: 'text', content: currentTextBlock });
      }

      return (
        <div key={index} className="space-y-2">
          {groups.map((group, groupIndex) => {
            if (group.type === 'header') {
              return (
                <h4
                  key={groupIndex}
                  className="text-veritas-cyan font-bold mt-4 mb-2 tracking-wider uppercase text-sm border-b border-veritas-cyan/20 pb-1 w-max"
                >
                  {group.content.replace(/^#+\s*/, '')}
                </h4>
              );
            }

            if (group.type === 'bullet') {
              return (
                <div key={groupIndex} className="flex gap-2 ml-2">
                  <span className="text-zinc-500 mt-0.5 text-[10px]">►</span>
                  <TerminalText
                    text={group.content.replace(/^[-*]\s*/, '')}
                    speed={1}
                    scramble={false}
                    className="text-zinc-300 leading-relaxed block"
                  />
                </div>
              );
            }

            return (
              <div key={groupIndex} className="min-h-[1.5em]">
                <TerminalText
                  text={group.content}
                  speed={0.5}
                  scramble={false}
                  className="text-zinc-300 whitespace-pre-wrap leading-relaxed block"
                />
              </div>
            );
          })}
        </div>
      );
    });
  };

  const agentColor = getAgentColor(log.agentRole);
  const bgColor = agentColor.replace('text-', 'bg-');
  const summaryEntry = [
    [log.metadata?.evidence_summary, 'Evidence Summary'],
    [log.metadata?.work_summary, 'Work Summary'],
    [log.metadata?.debate_summary, 'Debate Summary'],
    [log.metadata?.reasoning, 'Validation Summary'],
  ].find(([value]) => typeof value === 'string' && value.trim());
  const summary = summaryEntry?.[0];
  const summaryLabel = summaryEntry?.[1];
  const confidence = log.metadata?.confidence;
  const flaws = log.metadata?.has_flaws ? log.metadata.flaws || [] : [];

  let containerStyle = 'border-l-2 pl-4';
  if (log.agentRole === 'skeptic') {
    containerStyle =
      'border-l-4 border-veritas-red pl-6 bg-gradient-to-r from-red-950/10 to-transparent';
  } else if (log.agentRole === 'analyst') {
    containerStyle = 'border-l-2 border-veritas-cyan pl-4';
  } else if (log.agentRole === 'judge') {
    containerStyle =
      'border-l-4 border-veritas-gold pl-6 bg-gradient-to-r from-yellow-950/10 to-transparent';
  }

  return (
    <div className="relative transition-all duration-500 mb-6 opacity-100">
      <div className="flex items-center gap-3 mb-2 w-full">
        <span className="text-[9px] text-zinc-600 font-mono shrink-0">
          {new Date(log.timestamp).toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
        <div className="h-px bg-zinc-900 flex-1" />
        <span
          className={`${agentColor} font-bold tracking-[0.15em] uppercase text-[10px] flex items-center gap-2 shrink-0 bg-black px-2`}
        >
          {log.agentName}
          {log.isThinking && (
            <span className="flex items-center gap-1 text-[8px] bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400 animate-pulse border border-zinc-800">
              PROCESSING
            </span>
          )}
          {!log.isThinking && log.sources && log.sources.length > 0 && (
            <span className="flex items-center gap-1 text-[8px] border border-veritas-cyan/30 text-veritas-cyan px-1.5 py-0.5 rounded-sm">
              WEB_LINKED
            </span>
          )}
        </span>
      </div>

      <div className={`${containerStyle} py-2`}>
        {log.isThinking ? (
          <div className="flex flex-col gap-2 relative overflow-hidden p-2">
            <div
              className={`${agentColor} font-mono text-xs flex items-center gap-2 mb-1`}
            >
              <span className="animate-spin">◷</span>
              {log.content}
            </div>
            <DataStream color={agentColor} />
            <div className="flex gap-4 mt-2">
              <div className="h-0.5 w-12 bg-zinc-800 overflow-hidden relative">
                <div
                  className={`absolute inset-0 ${bgColor} animate-progress-indeterminate`}
                />
              </div>
              <span className="text-[9px] text-zinc-600 font-mono animate-pulse">
                PROCESSING EVIDENCE...
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {summary && (
              <div className="mb-4 relative">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-zinc-800" />
                <div className="pl-3 py-1">
                  <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                    <span className="w-1 h-1 bg-zinc-600 rounded-full" />
                    {summaryLabel}
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono leading-relaxed border border-zinc-900 p-2 bg-zinc-900/30 rounded-sm">
                    {summary}
                  </p>
                </div>
              </div>
            )}

            {log.agentRole === 'analyst' && confidence !== undefined && (
                <div className="flex items-center gap-3 mb-2 bg-zinc-950/50 p-1.5 border border-zinc-900 w-max rounded-sm">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">
                    Model Confidence (Uncalibrated)
                  </span>
                  <div className="flex gap-0.5 h-2">
                    {[...Array(10)].map((_, index) => (
                      <div
                        key={index}
                        className={`w-1.5 h-full rounded-sm ${
                          index < confidence / 10
                            ? confidence > 80
                              ? 'bg-veritas-cyan'
                              : 'bg-veritas-gold'
                            : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      confidence > 80
                        ? 'text-veritas-cyan'
                        : 'text-veritas-gold'
                    }`}
                  >
                    {confidence}%
                  </span>
                </div>
              )}

            <div className="relative">
              {renderContent(log.content, Boolean(log.isThinking))}
            </div>

            {log.agentRole === 'skeptic' && flaws.length > 0 && (
                <div className="mt-4 border border-red-900/40 bg-red-950/10 p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-veritas-red" />
                  <div className="absolute top-0 right-0 p-2 opacity-20 text-veritas-red text-4xl font-black select-none">
                    !
                  </div>
                  <p className="text-veritas-red text-[10px] font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
                    <span>⚠</span> Material Issues Detected
                  </p>
                  <ul className="space-y-2">
                    {flaws.map((flaw, index) => (
                      <li
                        key={index}
                        className="text-red-300 text-xs font-mono flex items-start gap-2"
                      >
                        <span className="text-red-600 mt-0.5">×</span>
                        {flaw}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {log.sources && log.sources.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-900">
                <div className="flex flex-wrap gap-2">
                  {log.sources.map(
                    (source, index) =>
                      source.web && (
                        <a
                          key={`${source.web.uri}-${index}`}
                          href={source.web.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-veritas-cyan/50 px-2 py-1.5 rounded-sm transition-all"
                        >
                          <span className="text-[10px] text-zinc-500 group-hover:text-veritas-cyan transition-colors">
                            ↗
                          </span>
                          <span className="text-[10px] text-zinc-400 group-hover:text-white font-mono truncate max-w-[150px]">
                            {source.web.title || 'External Source'}
                          </span>
                        </a>
                      )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
