import React from 'react';
import { LogEntry } from '../types';

interface LogSystemProps {
  log: LogEntry;
}

export const LogSystem: React.FC<LogSystemProps> = ({ log }) => {
  return (
    <div className="flex items-center justify-center py-8 opacity-40 select-none">
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent w-full max-w-lg"></div>
      <span className="px-4 text-[9px] text-zinc-500 tracking-[0.3em] font-bold uppercase whitespace-nowrap">{log.content}</span>
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent w-full max-w-lg"></div>
    </div>
  );
};