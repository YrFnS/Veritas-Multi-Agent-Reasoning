import React from 'react';
import { LogEntry, AgentConfig } from '../types';
import { TerminalText } from '../../../components/TerminalText';
import { CodeBlock } from './CodeBlock';
import { DataStream } from './DataStream';

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
    if (isThinking) return null; // Content handled specially in visual block
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
      <div className="flex items-center justify-center py-8 opacity-40 select-none">
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent w-full max-w-lg"></div>
        <span className="px-4 text-[9px] text-zinc-500 tracking-[0.3em] font-bold uppercase whitespace-nowrap">{log.content}</span>
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent w-full max-w-lg"></div>
      </div>
    );
  }

  // --- RENDER: USER INPUT ---
  if (log.agentRole === 'user') {
    return (
      <div className="flex flex-col items-end mb-8 mt-4 pl-12">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-zinc-600 font-mono">
              {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="text-black font-bold bg-zinc-200 px-2 py-0.5 rounded-sm text-[10px] tracking-wider">USER_INPUT</span>
          </div>
          <div className="bg-zinc-900 border-r-2 border-white/50 p-4 text-white/90 text-sm font-medium shadow-[0_4px_20px_rgba(0,0,0,0.5)] max-w-full">
            {log.content}
          </div>
      </div>
    );
  }

  // --- RENDER: FINAL VERDICT ---
  if (log.agentRole === 'verdict') {
    return (
      <div className="my-12 relative group perspective-1000">
        <div className="absolute -inset-1 bg-gradient-to-b from-veritas-gold/10 to-transparent blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
        <div className="relative bg-black border border-veritas-gold shadow-[0_0_30px_-10px_rgba(255,204,0,0.1)]">
            
            {/* Header Stamp */}
            <div className="bg-veritas-gold/10 border-b border-veritas-gold/30 p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-veritas-gold flex items-center justify-center text-black font-bold text-lg">⚖</div>
                    <div>
                        <h3 className="text-veritas-gold font-bold text-sm tracking-[0.2em] leading-none">OFFICIAL VERDICT</h3>
                        <span className="text-[9px] text-veritas-gold/60 uppercase tracking-widest">Consensus Achieved</span>
                    </div>
                </div>
                <div className="text-[10px] text-veritas-gold/50 font-mono text-right">
                    ID: {log.id.split('-')[0].toUpperCase()}<br/>
                    TS: {log.timestamp}
                </div>
            </div>

            {/* Content */}
            <div className="p-8">
                <TerminalText 
                    text={log.content} 
                    speed={5} 
                    scramble={false}
                    className="text-base md:text-lg text-white font-medium leading-relaxed font-sans whitespace-pre-wrap block" 
                />
            </div>

            {/* Footer / Audio */}
            <div className="border-t border-veritas-gold/20 bg-zinc-950/50 p-3 flex justify-between items-center">
                <div className="flex gap-4 text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-veritas-gold rounded-full"></span>Authenticity Verified</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-veritas-gold rounded-full"></span>Final & Conclusive</span>
                </div>
                <button 
                    onClick={() => isPlaying ? onStop() : onSpeak(log.content)}
                    className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold tracking-wider transition-all duration-300 uppercase
                    ${isPlaying 
                        ? 'bg-veritas-cyan text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' 
                        : 'bg-transparent border border-zinc-700 text-zinc-400 hover:text-white hover:border-white'}`}
                >
                    <span>{isPlaying ? '■' : '▶'}</span>
                    <span>{isPlaying ? 'VOICE TRANSMISSION ACTIVE' : 'INITIATE AUDIO BRIEF'}</span>
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
  
  // Custom Styles based on Role
  let containerStyle = "border-l-2 pl-4";
  let contentBg = "";
  
  if (log.agentRole === 'skeptic') {
    containerStyle = "border-l-4 border-veritas-red pl-6 bg-gradient-to-r from-red-950/10 to-transparent";
  } else if (log.agentRole === 'analyst') {
    containerStyle = "border-l-2 border-veritas-cyan pl-4";
  } else if (log.agentRole === 'judge') {
    containerStyle = "border-l-4 border-veritas-gold pl-6 bg-gradient-to-r from-yellow-950/10 to-transparent";
  }

  return (
    <div className={`relative transition-all duration-500 mb-6 ${log.isThinking ? 'opacity-100' : 'opacity-100'}`}>
      
      {/* Agent Header */}
      <div className="flex items-center gap-3 mb-2 w-full">
          <span className="text-[9px] text-zinc-600 font-mono shrink-0">
            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <div className="h-px bg-zinc-900 flex-1"></div>
          <span className={`${agentColor} font-bold tracking-[0.15em] uppercase text-[10px] flex items-center gap-2 shrink-0 bg-black px-2`}>
            {log.agentName}
            {/* Thinking Badge */}
            {log.isThinking && (
               <span className="flex items-center gap-1 text-[8px] bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400 animate-pulse border border-zinc-800">
                 PROCESSING
               </span>
            )}
            {/* Tool Badge */}
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
                <div className={`${agentColor} font-mono text-xs flex items-center gap-2 mb-1`}>
                    <span className="animate-spin">◷</span>
                    {log.content}
                </div>
                
                {/* Visual Data Stream Effect */}
                <DataStream color={agentColor} />

                <div className="flex gap-4 mt-2">
                    <div className="h-0.5 w-12 bg-zinc-800 overflow-hidden relative">
                        <div className={`absolute inset-0 ${bgColor} animate-progress-indeterminate`}></div>
                    </div>
                    <span className="text-[9px] text-zinc-600 font-mono animate-pulse">DECRYPTING VECTOR SPACE...</span>
                </div>
            </div>
        ) : (
          <div className="space-y-4">
            {/* THOUGHT PROCESS REVEAL */}
            {log.metadata?.thought_process && (
                <div className="mb-4 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-zinc-800"></div>
                    <div className="pl-3 py-1">
                        <div className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                             <span className="w-1 h-1 bg-zinc-600 rounded-full"></span>
                             Internal Monologue
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono leading-relaxed italic border border-zinc-900 p-2 bg-zinc-900/30 rounded-sm">
                            {log.metadata.thought_process}
                        </p>
                    </div>
                </div>
            )}

            {/* CONFIDENCE VISUAL (Analyst Only) */}
            {log.agentRole === 'analyst' && log.metadata?.confidence !== undefined && (
              <div className="flex items-center gap-3 mb-2 bg-zinc-950/50 p-1.5 border border-zinc-900 w-max rounded-sm">
                  <span className="text-[9px] text-zinc-500 uppercase font-bold">Confidence Metric</span>
                  <div className="flex gap-0.5 h-2">
                    {[...Array(10)].map((_, i) => (
                        <div 
                            key={i} 
                            className={`w-1.5 h-full rounded-sm ${i < (log.metadata.confidence / 10) ? (log.metadata.confidence > 80 ? 'bg-veritas-cyan' : 'bg-veritas-gold') : 'bg-zinc-800'}`}
                        ></div>
                    ))}
                  </div>
                  <span className={`text-[10px] font-mono font-bold ${log.metadata.confidence > 80 ? 'text-veritas-cyan' : 'text-veritas-gold'}`}>{log.metadata.confidence}%</span>
              </div>
            )}

            {/* MAIN CONTENT */}
            <div className="relative">
                {renderContent(log.content, !!log.isThinking)}
            </div>

            {/* FLAWS DETECTED (Skeptic Only) */}
            {log.agentRole === 'skeptic' && log.metadata?.has_flaws && log.metadata?.flaws?.length > 0 && (
              <div className="mt-4 border border-red-900/40 bg-red-950/10 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-veritas-red"></div>
                <div className="absolute top-0 right-0 p-2 opacity-20 text-veritas-red text-4xl font-black select-none">!</div>
                <p className="text-veritas-red text-[10px] font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
                    <span>⚠</span> Logical Inconsistencies Detected
                </p>
                <ul className="space-y-2">
                  {log.metadata.flaws.map((flaw: string, idx: number) => (
                    <li key={idx} className="text-red-300 text-xs font-mono flex items-start gap-2">
                      <span className="text-red-600 mt-0.5">x</span>
                      {flaw}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* SOURCES GRID */}
            {log.sources && log.sources.length > 0 && (
              <div className="mt-4 pt-3 border-t border-zinc-900">
                <div className="flex flex-wrap gap-2">
                  {log.sources.map((src, idx) => (
                    src.web && (
                      <a 
                        key={idx} 
                        href={src.web.uri} 
                        target="_blank" 
                        rel="noreferrer"
                        className="group flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-veritas-cyan/50 px-2 py-1.5 rounded-sm transition-all"
                      >
                        <span className="text-[10px] text-zinc-500 group-hover:text-veritas-cyan transition-colors">↗</span>
                        <span className="text-[10px] text-zinc-400 group-hover:text-white font-mono truncate max-w-[150px]">
                            {src.web.title || "External Data Node"}
                        </span>
                      </a>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};