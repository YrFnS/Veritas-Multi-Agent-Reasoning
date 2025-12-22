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
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>

      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 pb-20 space-y-8 scrollbar-hide z-10"
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
        
        {logs.length === 0 && (
          <div className="h-full flex items-center justify-center flex-col text-zinc-600 gap-4">
            <div className="w-16 h-16 border border-zinc-800 rounded-full flex items-center justify-center animate-spin-slow">
              <div className="w-2 h-2 bg-veritas-cyan rounded-full"></div>
            </div>
            <p className="tracking-widest text-xs">SYSTEM READY // WAITING FOR INPUT</p>
          </div>
        )}
      </div>
    </div>
  );
};