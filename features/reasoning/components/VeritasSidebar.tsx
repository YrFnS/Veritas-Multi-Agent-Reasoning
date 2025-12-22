import React from 'react';
import { AgentConfig, ProcessState, SystemConfig } from '../types';
import { AgentCard } from './AgentCard';
import { Tooltip } from '../../../components/Tooltip';

interface VeritasSidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  config: SystemConfig;
  processState: ProcessState;
  activeAgentName: string | null;
  activePreset: string;
  presets: Record<string, SystemConfig>;
  onPresetChange: (key: string) => void;
  onInterrogate: (agentName: string) => void;
}

export const VeritasSidebar: React.FC<VeritasSidebarProps> = ({
  isOpen,
  setIsOpen,
  config,
  processState,
  activeAgentName,
  activePreset,
  presets,
  onPresetChange,
  onInterrogate
}) => {
  return (
    <>
      {/* SIDEBAR CONTAINER */}
      <aside className={`
          fixed inset-y-0 left-0 z-30 w-80 bg-black/95 backdrop-blur-md border-r border-zinc-800 transform transition-transform duration-300 ease-out
          md:relative md:translate-x-0 md:bg-black/50 md:backdrop-blur-sm md:flex md:flex-col
          ${isOpen ? 'translate-x-0 pt-14 md:pt-0 shadow-[10px_0_30px_rgba(0,0,0,0.5)]' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
          <Tooltip content="These agents form the cognitive architecture. Each has a specific role in the reasoning chain." position="bottom">
            <h2 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-2 cursor-help">
                <span className="w-1.5 h-1.5 bg-veritas-cyan rounded-full animate-pulse"></span>
                Active Neural Nodes
            </h2>
          </Tooltip>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-zinc-500 p-2 hover:text-white">✕</button>
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto overflow-x-hidden">
            {config.agents.map((agent) => (
              <AgentCard 
                  key={agent.name} // Use name as key to support custom names better
                  config={agent} 
                  currentState={processState} 
                  isActive={activeAgentName === agent.name}
                  onInterrogate={onInterrogate}
              />
            ))}
        </div>
        
        {/* Mobile Preset Selector (since header hides it) */}
        <div className="md:hidden p-4 border-t border-zinc-800 bg-zinc-900/30">
            <p className="text-[9px] text-zinc-600 mb-2 font-mono uppercase">System Presets</p>
            <div className="flex flex-wrap gap-2">
                {Object.keys(presets).map(key => (
                    <button
                      key={key}
                      onClick={() => { onPresetChange(key); setIsOpen(false); }}
                      className={`px-3 py-1 text-[9px] font-mono tracking-wider border border-zinc-800 ${activePreset === key ? 'bg-veritas-cyan text-black font-bold' : 'text-zinc-500'}`}
                    >
                      {key}
                    </button>
                ))}
            </div>
        </div>

        {/* Decorator */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent opacity-50"></div>
      </aside>

      {/* Overlay for mobile sidebar background */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </>
  );
};