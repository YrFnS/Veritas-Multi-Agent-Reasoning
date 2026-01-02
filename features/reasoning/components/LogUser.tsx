import React from 'react';
import { LogEntry } from '../types';

interface LogUserProps {
  log: LogEntry;
}

export const LogUser: React.FC<LogUserProps> = ({ log }) => {
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
};