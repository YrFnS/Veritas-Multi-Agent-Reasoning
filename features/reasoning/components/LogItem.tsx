import React from 'react';
import { LogEntry, AgentConfig } from '../types';
import { LogSystem } from './LogSystem';
import { LogUser } from './LogUser';
import { LogVerdict } from './LogVerdict';
import { LogAgent } from './LogAgent';

interface LogItemProps {
  log: LogEntry;
  agents: AgentConfig[];
  onSpeak: (text: string) => void;
  onStop: () => void;
  isPlaying: boolean;
}

export const LogItem: React.FC<LogItemProps> = ({ log, agents, onSpeak, onStop, isPlaying }) => {
  // --- RENDER: SYSTEM SEPARATOR ---
  if (log.agentRole === 'system') {
    return <LogSystem log={log} />;
  }

  // --- RENDER: USER INPUT ---
  if (log.agentRole === 'user') {
    return <LogUser log={log} />;
  }

  // --- RENDER: FINAL VERDICT ---
  if (log.agentRole === 'verdict') {
    return (
      <LogVerdict 
        log={log} 
        onSpeak={onSpeak} 
        onStop={onStop} 
        isPlaying={isPlaying} 
      />
    );
  }

  // --- RENDER: AGENT THINKING/OUTPUT (Standard) ---
  return <LogAgent log={log} agents={agents} />;
};