import React from 'react';
import { AgentConfig, ProcessState } from '../types';
import { Tooltip } from '../../../components/Tooltip';

interface AgentCardProps {
  config: AgentConfig;
  currentState: ProcessState;
  isActive: boolean;
  onInterrogate?: (agentName: string) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ config, currentState, isActive, onInterrogate }) => {
  const isInterrogationActive = currentState === ProcessState.INTERROGATION;
  const shouldPulse = isActive;
  
  // Dynamic Styles
  const activeBorderClass = shouldPulse 
    ? (isInterrogationActive ? 'border-orange-500' : config.color.replace('text-', 'border-')) 
    : 'border-zinc-800';
    
  const activeTextClass = isInterrogationActive && shouldPulse 
    ? 'text-orange-500' 
    : config.color;

  const activeBgClass = shouldPulse
     ? (isInterrogationActive ? 'bg-orange-950/40' : 'bg-zinc-900/60')
     : 'bg-black/40';

  const containerClasses = `
    relative group overflow-hidden transition-all duration-500 ease-out flex flex-col h-32 backdrop-blur-sm
    border-y border-r ${activeBorderClass}
    border-l-[4px] ${shouldPulse ? activeBorderClass : `border-l-zinc-800 group-hover:${activeBorderClass}`}
    ${activeBgClass}
    ${shouldPulse ? 'shadow-lg z-10 scale-[1.02]' : 'opacity-70 hover:opacity-100 hover:bg-zinc-900/20 scale-100 grayscale-[0.5] hover:grayscale-0'}
  `;

  // Animation for processing: A scanning vertical line
  const ProcessingScanner = () => (
    <div className="absolute inset-0 pointer-events-none overflow-hidden mix-blend-overlay">
        <div className="absolute top-0 left-0 w-full h-[30%] bg-gradient-to-b from-transparent via-white/10 to-transparent animate-scanline"></div>
    </div>
  );

  // Diagnostic warning stripes background
  const DiagnosticStripes = () => (
    <div className="absolute inset-0 pointer-events-none opacity-5 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)]"></div>
  );

  return (
    <div className={containerClasses}>
      {/* Background Effects */}
      {shouldPulse && (
        <>
            <div className={`absolute inset-0 bg-gradient-to-r ${isInterrogationActive ? 'from-orange-500/20' : config.color.replace('text-', 'from-') + '/20'} to-transparent opacity-50`}></div>
            <ProcessingScanner />
        </>
      )}
      
      {isInterrogationActive && <DiagnosticStripes />}

      {/* Header Section */}
      <div className={`flex items-center justify-between p-3 border-b transition-colors duration-300 relative z-10 ${shouldPulse ? 'border-white/10' : 'border-zinc-800'}`}>
        {/* Agent Identity */}
        <Tooltip 
            content={
                <div className="space-y-1">
                    <span className={`block font-bold ${activeTextClass} uppercase`}>{config.role} PROTOCOL</span>
                    <span className="block text-zinc-400">{config.task}</span>
                    <span className="block text-zinc-500 italic text-[9px]">Archetype: {config.style}</span>
                </div>
            } 
            position="right"
            className="flex-1"
        >
            <div className="flex items-center gap-3 cursor-help">
              <div className={`
                w-8 h-8 flex items-center justify-center border transition-all duration-500 relative overflow-hidden
                ${shouldPulse 
                    ? `${activeBorderClass} bg-black/50 shadow-[0_0_15px_-3px_currentColor] ${activeTextClass}` 
                    : 'border-zinc-800 bg-zinc-900 text-zinc-600 group-hover:text-zinc-400 group-hover:border-zinc-700'}
              `}>
                <span className="text-lg drop-shadow-md relative z-10">{config.icon}</span>
                {shouldPulse && <div className={`absolute inset-0 bg-current opacity-10 animate-pulse`}></div>}
              </div>
              
              <div className="flex flex-col">
                 <h3 className={`font-mono font-bold text-sm tracking-widest leading-none mb-0.5 transition-colors ${activeTextClass}`}>
                  {config.name}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] uppercase text-zinc-600 font-mono tracking-wider">
                    {config.role.substring(0,3).toUpperCase()}
                    </span>
                    {shouldPulse && (
                        <span className="flex h-1.5 w-1.5 relative">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isInterrogationActive ? 'bg-orange-500' : config.color.replace('text-', 'bg-')}`}></span>
                            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isInterrogationActive ? 'bg-orange-500' : config.color.replace('text-', 'bg-')}`}></span>
                        </span>
                    )}
                </div>
              </div>
            </div>
        </Tooltip>

        {/* Action / Status */}
        <div className="flex items-center">
            {isInterrogationActive ? (
                shouldPulse ? (
                     <div className="px-2 py-0.5 border border-orange-500/50 bg-orange-950/50 text-[9px] text-orange-500 font-mono animate-pulse tracking-wider shadow-[0_0_10px_rgba(249,115,22,0.3)]">
                        DIAGNOSTIC
                     </div>
                ) : (
                    <span className="text-zinc-700 text-[9px] font-mono">SUSPENDED</span>
                )
            ) : shouldPulse ? (
                 <div className={`px-2 py-0.5 border ${config.color.replace('text-', 'border-')}/30 bg-black/50 text-[9px] ${activeTextClass} font-mono tracking-wider shadow-[0_0_10px_-5px_currentColor]`}>
                    PROCESSING
                 </div>
            ) : (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        if(onInterrogate) onInterrogate(config.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 px-2 py-1 border border-zinc-800 hover:border-zinc-600 bg-zinc-950 text-[8px] text-zinc-500 hover:text-zinc-300 font-mono tracking-wider uppercase"
                >
                    INTERROGATE
                </button>
            )}
        </div>
      </div>
      
      {/* Activity Visualization Area */}
      <div className="flex-1 p-3 relative overflow-hidden flex items-end gap-0.5">
         {/* Background Grid for Tech Feel */}
         <div className="absolute inset-0 opacity-10 bg-[size:10px_10px] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)]"></div>
         
         {shouldPulse ? (
            // Active Frequency Bars
            [...Array(20)].map((_, i) => (
              <div 
                key={i} 
                className={`flex-1 rounded-t-sm transition-all duration-75 ${isInterrogationActive ? 'bg-orange-500' : config.color.replace('text-', 'bg-')}`}
                style={{ 
                  height: `${Math.random() * 80 + 10}%`,
                  opacity: Math.random() * 0.5 + 0.3,
                  transition: 'height 0.1s ease-in-out'
                }} 
              />
            ))
         ) : (
            // Idle Flatline
            <div className="w-full h-px bg-zinc-800 relative overflow-hidden opacity-50">
                <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-zinc-500 to-transparent opacity-20 animate-pulse"></div>
            </div>
         )}
      </div>

      {/* Decorative Footer Line */}
      <div className={`h-0.5 w-full transition-colors duration-500 ${shouldPulse ? (isInterrogationActive ? 'bg-orange-500' : config.color.replace('text-', 'bg-')) : 'bg-zinc-800'}`}></div>
    </div>
  );
};