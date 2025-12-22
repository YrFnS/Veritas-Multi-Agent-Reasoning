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
          fixed inset-y-0 left-0 z-[60] w-80 bg-black/95 backdrop-blur-xl border-r border-zinc-800 transform transition-transform duration-300 ease-out flex flex-col
          md:relative md:translate-x-0 md:bg-black/50 md:backdrop-blur-sm md:z-auto
          ${isOpen ? 'translate-x-0 shadow-[10px_0_30px_rgba(0,0,0,0.8)]' : '-translate-x-full'}
      `}>
        {/* Header (Mobile Only Close) */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/20 flex justify-between items-center shrink-0">
          <Tooltip content="Active neural nodes in the reasoning chain." position="bottom">
            <h2 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2 cursor-help">
                <span className={`w-1.5 h-1.5 rounded-full ${processState !== 'IDLE' ? 'bg-veritas-cyan animate-pulse' : 'bg-zinc-600'}`}></span>
                Active Agents
            </h2>
          </Tooltip>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-zinc-500 hover:text-white px-2">✕</button>
        </div>

        {/* Agents List */}
        <div className="flex-1 p-4 space-y-4 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-800">
            {config.agents.map((agent) => (
              <AgentCard 
                  key={agent.name} 
                  config={agent} 
                  currentState={processState} 
                  isActive={activeAgentName === agent.name}
                  onInterrogate={onInterrogate}
              />
            ))}
        </div>
        
        {/* Status Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 shrink-0">
           {/* Mobile Preset Selector */}
           <div className="md:hidden mb-4">
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

           {/* Network Status */}
           <div className="flex justify-between items-center text-[9px] font-mono text-zinc-600">
              <div className="flex items-center gap-2">
                 <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                 <span>NEURAL LINK: STABLE</span>
              </div>
              <span>LATENCY: 12ms</span>
           </div>
           <div className="mt-2 h-0.5 w-full bg-zinc-900 overflow-hidden">
               <div className="h-full w-1/3 bg-zinc-700 animate-[scanline_2s_linear_infinite]"></div>
           </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar background */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-[50] md:hidden backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </>
  );
};