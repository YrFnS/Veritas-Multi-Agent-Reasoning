import React, { useEffect, useRef, useState } from 'react';
import { LogEntry, AgentConfig } from '../types';
import { useSpeech } from '../hooks/useSpeech';
import { LogItem } from './LogItem';

interface ReasoningLogProps {
  logs: LogEntry[];
  agents: AgentConfig[];
}

export const ReasoningLog: React.FC<ReasoningLogProps> = ({ logs, agents }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const { speak, stop, isPlaying } = useSpeech();

  // Handle auto-scrolling
  useEffect(() => {
    if (scrollRef.current && shouldAutoScroll) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, shouldAutoScroll]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShouldAutoScroll(isAtBottom);
    }
  };

  return (
    <div className="h-full flex flex-col font-mono text-xs overflow-hidden relative bg-black">
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 scrollbar-hide z-10"
      >
        {logs.map((log) => (
          <LogItem 
            key={log.id} 
            log={log} 
            agents={agents} 
            onSpeak={speak}
            onStop={stop}
            isPlaying={isPlaying}
          />
        ))}
        
        {/* Empty State / Standby Mode */}
        {logs.length === 0 && (
          <div className="h-full flex items-center justify-center flex-col text-zinc-600 select-none opacity-60">
            <div className="relative mb-8 group cursor-default">
                {/* Outer Ring */}
                <div className="w-32 h-32 border border-zinc-800 rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                   <div className="w-2 h-2 bg-zinc-800 rounded-full absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
                   <div className="w-2 h-2 bg-zinc-800 rounded-full absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2"></div>
                </div>
                
                {/* Inner Ring */}
                <div className="w-24 h-24 border border-veritas-cyan/20 rounded-full flex items-center justify-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[spin_5s_linear_infinite_reverse]">
                   <div className="w-full h-px bg-transparent"></div>
                </div>

                {/* Core */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-veritas-cyan rounded-full animate-pulse shadow-[0_0_15px_rgba(0,240,255,0.5)]"></div>
            </div>
            
            <h2 className="text-sm tracking-[0.3em] font-bold text-zinc-500 mb-2">SYSTEM STANDBY</h2>
            <p className="text-[10px] font-mono text-zinc-700 tracking-wider">AWAITING INPUT VECTOR...</p>
            
            <div className="mt-8 flex gap-2">
                <div className="w-1 h-1 bg-zinc-700 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1 h-1 bg-zinc-700 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1 h-1 bg-zinc-700 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};