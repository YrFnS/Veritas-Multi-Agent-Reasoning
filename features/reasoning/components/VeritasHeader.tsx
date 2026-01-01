import React from 'react';
import { ProcessState, SystemConfig } from '../types';
import { Tooltip } from '../../../components/Tooltip';
import { AuthBadge } from './AuthBadge';

interface VeritasHeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isProcessing: boolean;
  processState: ProcessState;
  currentRound: number;
  maxRounds: number;
  activePreset: string;
  presets: Record<string, SystemConfig>;
  isMuted: boolean;
  toggleMute: () => void;
  onPresetChange: (key: string) => void;
  onExport: () => void;
  onReset: () => void;
  onConfigOpen: () => void;
  playVerdict: () => void;
  manualApiKey: string | null;
  onSetManualKey: (key: string | null) => void;
}

export const VeritasHeader: React.FC<VeritasHeaderProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  isProcessing,
  processState,
  currentRound,
  maxRounds,
  activePreset,
  presets,
  isMuted,
  toggleMute,
  onPresetChange,
  onExport,
  onReset,
  onConfigOpen,
  playVerdict,
  manualApiKey,
  onSetManualKey
}) => {
  return (
    <header className="h-14 border-b border-zinc-800 bg-black flex justify-between items-center px-4 md:px-6 relative z-50 shrink-0 select-none">
      <div className="flex items-center gap-4">
        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden text-veritas-cyan border border-zinc-800 p-1 px-2 hover:bg-zinc-900 transition-colors"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          ☰
        </button>

        <Tooltip content="Veritas Truth Engine v1.0 // Click to Play Test Sound" position="bottom">
            <div className="flex items-center gap-2 md:gap-4 group cursor-pointer" onClick={playVerdict}>
              <div className="w-6 h-6 bg-veritas-cyan flex items-center justify-center group-hover:opacity-80 transition-opacity">
                <span className="text-black font-bold text-xs">V</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-sm md:text-lg font-bold tracking-[0.2em] text-white leading-none group-hover:text-veritas-cyan transition-colors">VERITAS</h1>
                <span className="hidden md:inline text-[9px] text-zinc-500 font-mono tracking-widest">MULTI-AGENT TRUTH ENGINE</span>
              </div>
            </div>
        </Tooltip>
        
        {/* PRESET SELECTOR (Desktop) */}
        <div className="hidden lg:flex ml-8 bg-zinc-900 rounded-sm border border-zinc-800 p-0.5">
            {Object.keys(presets).map(key => (
                <Tooltip key={key} content={`Load System Preset: ${key}`} position="bottom">
                    <button
                      onClick={() => onPresetChange(key)}
                      className={`px-3 py-1 text-[9px] font-mono tracking-wider transition-all ${activePreset === key ? 'bg-veritas-cyan text-black font-bold' : 'text-zinc-500 hover:text-white'}`}
                    >
                      {key}
                    </button>
                </Tooltip>
            ))}
            {activePreset === 'CUSTOM' && (
                <span className="px-3 py-1 text-[9px] font-mono tracking-wider bg-zinc-800 text-zinc-300">CUSTOM</span>
            )}
        </div>
      </div>
      
      {/* CENTER STATUS - CYCLE INDICATOR */}
      {isProcessing && currentRound > 0 && (
        <div className="hidden lg:flex flex-col items-center justify-center absolute left-1/2 transform -translate-x-1/2">
            <Tooltip content={`Recursive Debate Cycle ${currentRound} of ${maxRounds}. Iterating logic.`} position="bottom">
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1 mb-1">
                    <span className="text-[9px] text-veritas-gold font-mono tracking-widest animate-pulse">RECURSIVE CYCLE {currentRound} / {maxRounds}</span>
                    </div>
                    <div className="flex gap-1">
                    {[...Array(maxRounds)].map((_, i) => (
                        <div 
                        key={i} 
                        className={`h-1 w-8 rounded-full transition-colors duration-500 ${i < currentRound ? 'bg-veritas-gold' : 'bg-zinc-800'}`}
                        ></div>
                    ))}
                    </div>
                </div>
            </Tooltip>
        </div>
      )}

      {/* CENTER STATUS - DIAGNOSTIC MODE */}
      {processState === ProcessState.INTERROGATION && (
          <div className="absolute left-1/2 transform -translate-x-1/2 bg-orange-950/80 border border-orange-500/50 px-4 py-1 rounded-full flex items-center gap-2 animate-pulse">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></span>
              <span className="text-orange-400 font-mono text-[10px] font-bold tracking-widest">DIAGNOSTIC MODE ACTIVE</span>
          </div>
      )}

      <div className="flex items-center gap-2 md:gap-6">
        <div className="hidden md:flex items-center gap-2">
            <Tooltip content={`Current System State: ${processState}`} position="left">
                <div className="flex items-center gap-2 cursor-help">
                    <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-veritas-red animate-pulse' : 'bg-zinc-700'}`}></span>
                    <span className="text-[10px] font-mono text-zinc-400">STATUS: {processState}</span>
                </div>
            </Tooltip>
        </div>
        
        {/* RIGHT SIDE ACTIONS */}
        <div className="flex items-center gap-2">
            
            {/* AUTH / SUBSCRIPTION BADGE */}
            <AuthBadge manualApiKey={manualApiKey} onSetManualKey={onSetManualKey} />

            <div className="h-4 w-px bg-zinc-800 mx-1 hidden md:block"></div>

            <Tooltip content={isMuted ? "Enable Audio Feedback" : "Mute Audio Feedback"} position="bottom">
                <button 
                onClick={toggleMute}
                className={`text-[10px] font-mono border border-zinc-800 px-3 py-1 hover:bg-zinc-900 transition-colors uppercase ${isMuted ? 'text-zinc-600 line-through' : 'text-veritas-cyan'}`}
            >
                {isMuted ? 'MUTE' : 'AUDIO'}
            </button>
          </Tooltip>
          
          <Tooltip content="Export Session Transcript to JSON (Ctrl+E)" position="bottom">
                <button 
                onClick={onExport}
                className="hidden md:block text-[10px] font-mono text-zinc-400 border border-zinc-800 px-3 py-1 hover:bg-zinc-900 transition-colors uppercase"
            >
                EXP
            </button>
          </Tooltip>

          <Tooltip content="Reset Memory & Context (Ctrl+K)" position="bottom">
            <button 
                onClick={onReset}
                className="text-[10px] font-mono text-zinc-400 border border-zinc-800 px-3 py-1 hover:bg-zinc-900 hover:text-veritas-red transition-colors uppercase"
            >
                RST
            </button>
          </Tooltip>

          <Tooltip content="Open System Configuration Editor" position="bottom">
            <button 
                onClick={onConfigOpen}
                className="text-[10px] font-mono text-veritas-cyan border border-veritas-cyan/30 px-3 py-1 hover:bg-veritas-cyan/10 transition-colors uppercase"
            >
                CFG
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
};