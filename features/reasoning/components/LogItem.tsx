import React from 'react';
import { LogEntry, AgentConfig } from '../types';
import { TerminalText } from '../../../components/TerminalText';
import { CodeBlock } from './CodeBlock';

interface LogItemProps {
  log: LogEntry;
  agents: AgentConfig[];
  onSpeak: (text: string) => void;
  onStop: () => void;
  isPlaying: boolean;
}

export const LogItem: React.FC<LogItemProps> = ({ log, agents, onSpeak, onStop, isPlaying }) => {
  const getAgentColor = (role: string) => {
    const agent = agents.find(a => a.role === role);
    return agent ? agent.color : 'text-gray-500';
  };

  const renderContent = (content: string, isThinking: boolean) => {
    if (isThinking) return content;
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const rawCode = part.replace(/^```[a-z]*\n?|```$/g, '');
        return <CodeBlock key={index} code={rawCode} />;
      }
      if (!part.trim()) return null;
      return (
        <TerminalText 
          key={index}
          text={part} 
          speed={2} 
          scramble={false}
          className="text-zinc-300 whitespace-pre-wrap leading-relaxed block max-w-4xl" 
        />
      );
    });
  };

  // --- RENDER: SYSTEM SEPARATOR ---
  if (log.agentRole === 'system') {
    return (
      <div className="flex items-center justify-center py-6 opacity-40">
        <div className="h-px bg-zinc-700 flex-1"></div>
        <span className="px-4 text-[9px] text-zinc-500 tracking-[0.2em]">{log.content}</span>
        <div className="h-px bg-zinc-700 flex-1"></div>
      </div>
    );
  }

  // --- RENDER: USER INPUT ---
  if (log.agentRole === 'user') {
    return (
      <div className="flex flex-col items-end mb-8 mt-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-zinc-500">
              [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" })}]
            </span>
            <span className="text-white font-bold bg-zinc-800 px-2 py-0.5 rounded text-[10px]">USER_INPUT</span>
          </div>
          <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-bl-xl rounded-tl-xl rounded-tr-xl max-w-2xl text-white/90 text-sm">
            {log.content}
          </div>
      </div>
    );
  }

  // --- RENDER: FINAL VERDICT ---
  if (log.agentRole === 'verdict') {
    return (
      <div className="my-8 relative group">
        <div className="absolute -inset-1 bg-veritas-gold/20 blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
        <div className="relative bg-zinc-950 border-2 border-veritas-gold p-6 md:p-8">
          <div className="absolute -top-3 left-6 bg-zinc-950 px-2 text-veritas-gold font-bold tracking-widest text-sm flex items-center gap-2">
            <span>⚖</span> FINAL VERDICT
          </div>
          <TerminalText 
            text={log.content} 
            speed={5} 
            scramble={false}
            className="text-sm md:text-base text-white font-medium leading-relaxed font-sans whitespace-pre-wrap block" 
          />
          <div className="mt-4 pt-4 border-t border-dashed border-zinc-800 flex justify-between items-center text-[9px] text-zinc-500 uppercase tracking-widest">
            <div className="flex gap-4">
                <span>Authenticity Verified</span>
                <span>Session ID: {log.id.split('-')[0]}</span>
            </div>
            <button 
                onClick={() => isPlaying ? onStop() : onSpeak(log.content)}
                className={`flex items-center gap-2 px-3 py-1 border transition-all duration-300 ${isPlaying ? 'border-veritas-cyan text-veritas-cyan bg-veritas-cyan/10 animate-pulse' : 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500'}`}
            >
                <span>{isPlaying ? '■' : '▶'}</span>
                <span>{isPlaying ? 'TRANSMITTING VOICE...' : 'PLAY AUDIO'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: AGENT THINKING/OUTPUT (Standard) ---
  const agentColor = getAgentColor(log.agentRole);
  const borderColor = agentColor.replace('text-', 'border-');
  const bgColor = agentColor.replace('text-', 'bg-');
  const isSearchCapable = log.agentRole === 'analyst' || log.agentRole === 'skeptic';
  
  return (
    <div className={`group relative transition-all duration-500 ${log.isThinking ? 'opacity-90' : 'opacity-100'}`}>
      
      {/* Timestamp & Agent Header */}
      <div className="flex items-center gap-3 mb-2 border-b border-zinc-900 pb-1 w-max pr-4">
          <span className="text-[10px] text-zinc-600 font-bold">
            [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}]
          </span>
          <span className={`${agentColor} font-bold tracking-wider uppercase flex items-center gap-2`}>
            //{log.agentName}
            {!log.isThinking && log.sources && log.sources.length > 0 && (
              <span className="flex items-center gap-1.5 text-[9px] bg-veritas-cyan/5 px-2 py-0.5 rounded-sm border border-veritas-cyan/20 text-veritas-cyan/90 tracking-widest">
                <span className="text-[10px]">📡</span> NET_ACCESS
              </span>
            )}
            {log.isThinking && (
              <span className="ml-2 flex items-center gap-1.5 text-[9px] opacity-70 border border-current px-1.5 py-0.5 rounded">
                <span className="relative flex h-1.5 w-1.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${bgColor} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${bgColor}`}></span>
                </span>
                {isSearchCapable ? 'REASONING_WITH_TOOLS...' : 'SYNTHESIZING_TRUTH...'}
              </span>
            )}
          </span>
      </div>

      <div className={`pl-4 border-l ${borderColor} ml-1`}>
        {log.isThinking ? (
            <div className={`${agentColor} font-mono flex flex-col gap-1`}>
              <div className="flex items-center gap-2 opacity-80">
                <span className="text-[10px] opacity-50">&gt;&gt;</span> 
                {log.content}
              </div>
              <div className="text-[9px] opacity-50 animate-pulse">
                ACCESSING VECTOR SPACE... CALCULATING PROBABILITY... 
              </div>
            </div>
        ) : (
          <div className="space-y-3">
            {/* VISUALIZATION: CONFIDENCE BAR (Analyst Only) */}
            {log.agentRole === 'analyst' && log.metadata?.confidence !== undefined && (
              <div className="w-64 mb-2">
                <div className="flex justify-between text-[9px] text-zinc-500 mb-1 uppercase">
                  <span>Certainty Level</span>
                  <span>{log.metadata.confidence}%</span>
                </div>
                <div className="h-1 bg-zinc-900 w-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${log.metadata.confidence > 80 ? 'bg-veritas-cyan' : log.metadata.confidence > 50 ? 'bg-veritas-gold' : 'bg-veritas-red'}`}
                    style={{ width: `${log.metadata.confidence}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div>
                {renderContent(log.content, !!log.isThinking)}
            </div>

            {/* SOURCES */}
            {log.sources && log.sources.length > 0 && (
              <div className="mt-2 pt-2 border-t border-zinc-900/50">
                <p className="text-[9px] text-zinc-600 mb-1">REFERENCE NODES:</p>
                <div className="flex flex-wrap gap-2">
                  {log.sources.map((src, idx) => (
                    src.web && (
                      <a 
                        key={idx} 
                        href={src.web.uri} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-veritas-cyan/70 hover:text-veritas-cyan hover:underline truncate max-w-[200px]"
                      >
                        🔗 {src.web.title || "External Source"}
                      </a>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* FLAWS */}
            {log.agentRole === 'skeptic' && log.metadata?.has_flaws && log.metadata?.flaws?.length > 0 && (
              <div className="mt-3 bg-red-950/20 border border-red-900/50 p-3 rounded-sm">
                <p className="text-veritas-red text-[10px] font-bold mb-2 uppercase tracking-wider">⚠ Logic Failures Detected:</p>
                <ul className="list-none space-y-1">
                  {log.metadata.flaws.map((flaw: string, idx: number) => (
                    <li key={idx} className="text-red-400/80 text-[10px] pl-2 border-l border-red-900/50">
                      {flaw}
                    </li>
                  ))}
                </ul>
              </div>
            )}

              {/* VISUALIZATION: THOUGHT PROCESS */}
              {log.metadata?.thought_process && (
              <details className="group mt-2">
                <summary className="cursor-pointer text-[9px] text-zinc-600 hover:text-zinc-400 list-none flex items-center gap-1">
                  <span className="opacity-50">▶</span> VIEW INTERNAL REASONING TRACE
                </summary>
                <div className="mt-2 pl-2 border-l border-zinc-800 text-zinc-500 text-[10px] italic">
                  {log.metadata.thought_process}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
};