
import React from 'react';
import { AgentConfig, ProcessState, SystemConfig } from '../types';
import { AgentCard } from './AgentCard';
import { Tooltip } from '../../../components/Tooltip';
import { useTelemetry } from '../hooks/useTelemetry';

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
  const metrics = useTelemetry(processState);

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
        
        {/* Status Footer - LIVE TELEMETRY */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/80 shrink-0 font-mono">
           {/* Mobile Preset Selector */}
           <div className="md:hidden mb-4">
              <p className="text-[9px] text-zinc-600 mb-2 uppercase">System Presets</p>
              <div className="flex flex-wrap gap-2">
                  {Object.keys(presets).map(key => (
                      <button
                        key={key}
                        onClick={() => { onPresetChange(key); setIsOpen(false); }}
                        className={`px-3 py-1 text-[9px] tracking-wider border border-zinc-800 ${activePreset === key ? 'bg-veritas-cyan text-black font-bold' : 'text-zinc-500'}`}
                      >
                        {key}
                      </button>
                  ))}
              </div>
           </div>

           {/* Metrics Grid */}
           <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[9px] text-zinc-500 mb-3">
              <div className="flex justify-between">
                <span>CPU LOAD</span>
                <span className={metrics.cpu > 80 ? 'text-veritas-red' : 'text-veritas-cyan'}>{metrics.cpu.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>MEM ALLOC</span>
                <span className={metrics.memory > 80 ? 'text-veritas-gold' : 'text-zinc-300'}>{metrics.memory.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>NET I/O</span>
                <span className="text-zinc-300">{Math.floor(metrics.network)} MB/s</span>
              </div>
              <div className="flex justify-between">
                <span>ENTROPY</span>
                <span className={metrics.entropy > 0.8 ? 'text-veritas-red' : 'text-zinc-300'}>{metrics.entropy.toFixed(3)}</span>
              </div>
           </div>

           {/* Network Status Bar */}
           <div className="flex justify-between items-center text-[9px] text-zinc-600">
              <div className="flex items-center gap-2">
                 <span className={`w-1 h-1 rounded-full ${processState === ProcessState.IDLE ? 'bg-emerald-500' : 'bg-veritas-gold animate-ping'}`}></span>
                 <span>{processState === ProcessState.IDLE ? 'LINK STABLE' : 'DATA STREAM ACTIVE'}</span>
              </div>
              <span>{Math.floor(metrics.fps)} FPS</span>
           </div>
           
           {/* Live Graph visualizer */}
           <div className="mt-2 h-4 w-full bg-zinc-900 overflow-hidden flex items-end gap-[1px] opacity-50">
               {[...Array(20)].map((_, i) => (
                   <div 
                    key={i} 
                    className="flex-1 bg-veritas-cyan/50" 
                    style={{ 
                        height: `${Math.max(5, (Math.sin(Date.now() / 200 + i) * 0.5 + 0.5) * metrics.cpu)}%`,
                        opacity: i % 2 === 0 ? 0.8 : 0.4 
                    }}
                   ></div>
               ))}
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
