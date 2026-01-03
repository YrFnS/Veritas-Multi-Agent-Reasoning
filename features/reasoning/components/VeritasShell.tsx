
import React from 'react';
import { ProcessState, SystemConfig } from '../types';
import { VeritasHeader } from './VeritasHeader';
import { VeritasSidebar } from './VeritasSidebar';
import { NeuralBackground } from '../../../components/NeuralBackground';
import { SystemMonitor } from '../../../components/SystemMonitor';

interface VeritasShellProps {
  // State
  processState: ProcessState;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  config: SystemConfig;
  activeAgentName: string | null;
  activePreset: string;
  isMuted: boolean;
  isProcessing: boolean;
  currentRound: number;
  presets: Record<string, SystemConfig>;
  
  // Handlers
  onPresetChange: (key: string) => void;
  onInterrogate: (agentName: string) => void;
  onExport: () => void;
  onReset: () => void;
  onConfigOpen: () => void;
  playVerdict: () => void;
  toggleMute: () => void;

  // Content
  children: React.ReactNode;
}

export const VeritasShell: React.FC<VeritasShellProps> = ({
  processState,
  isSidebarOpen,
  setIsSidebarOpen,
  config,
  activeAgentName,
  activePreset,
  isMuted,
  isProcessing,
  currentRound,
  presets,
  onPresetChange,
  onInterrogate,
  onExport,
  onReset,
  onConfigOpen,
  playVerdict,
  toggleMute,
  children
}) => {
  
  // --- AMBIENT LIGHTING SYSTEM ---
  const getAmbientClasses = () => {
    switch (processState) {
      case ProcessState.AUDITING: return 'shadow-[inset_0_0_150px_rgba(220,38,38,0.2)] border-veritas-red/20'; // Red
      case ProcessState.JUDGING: return 'shadow-[inset_0_0_150px_rgba(255,204,0,0.15)] border-veritas-gold/20'; // Gold
      case ProcessState.ERROR: return 'shadow-[inset_0_0_150px_rgba(220,38,38,0.4)] border-red-500 animate-pulse'; // Red Alarm
      case ProcessState.ANALYZING: return 'shadow-[inset_0_0_150px_rgba(0,240,255,0.1)] border-veritas-cyan/10'; // Cyan
      case ProcessState.INTERROGATION: return 'shadow-[inset_0_0_150px_rgba(249,115,22,0.15)] border-orange-500/20'; // Orange
      default: return 'shadow-[inset_0_0_150px_rgba(0,0,0,0.5)] border-transparent'; // Dark
    }
  };

  return (
    <div className="h-screen w-screen bg-veritas-black text-white font-sans selection:bg-veritas-cyan selection:text-black flex flex-col overflow-hidden crt-flicker relative">
      
      {/* AMBIENT LIGHTING OVERLAY */}
      <div className={`absolute inset-0 pointer-events-none transition-all duration-1000 border-[20px] z-50 ${getAmbientClasses()}`}></div>

      <VeritasHeader 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isProcessing={isProcessing}
        processState={processState}
        currentRound={currentRound}
        maxRounds={config.max_rounds}
        activePreset={activePreset}
        presets={presets}
        isMuted={isMuted}
        toggleMute={toggleMute}
        onPresetChange={onPresetChange}
        onExport={onExport}
        onReset={onReset}
        onConfigOpen={onConfigOpen}
        playVerdict={playVerdict}
      />

      <main className="flex-1 flex overflow-hidden relative">
        {/* REACTIVE BACKGROUND */}
        <NeuralBackground processState={processState} />
        
        {/* Subtle grid overlay remains for texture, but clearer */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>

        {/* SYSTEM MONITOR HUD */}
        <SystemMonitor />

        <VeritasSidebar 
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          config={config}
          processState={processState}
          activeAgentName={activeAgentName}
          activePreset={activePreset}
          presets={presets}
          onPresetChange={onPresetChange}
          onInterrogate={onInterrogate}
        />

        {/* CENTER DASHBOARD WRAPPER */}
        <section className="flex-1 flex flex-col min-w-0 bg-black/10 relative z-10 backdrop-blur-[1px]">
          {children}
        </section>
      </main>
    </div>
  );
};
