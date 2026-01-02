import React, { useState, useEffect, useRef } from 'react';
import { ReasoningLog } from './features/reasoning/components/ReasoningLog';
import { ConfigEditor } from './features/reasoning/components/ConfigEditor';
import { VeritasHeader } from './features/reasoning/components/VeritasHeader';
import { VeritasSidebar } from './features/reasoning/components/VeritasSidebar';
import { VoiceControl } from './features/reasoning/components/VoiceControl';
import { BootSequence } from './components/BootSequence';
import { NeuralBackground } from './components/NeuralBackground';
import { DEFAULT_CONFIG, PRESETS } from './features/reasoning/constants';
import { SystemConfig, ProcessState } from './features/reasoning/types';
import { useReasoningEngine } from './features/reasoning/hooks/useReasoningEngine';
import { useSoundFX } from './features/reasoning/hooks/useSoundFX';
import { useCommandTerminal } from './features/reasoning/hooks/useCommandTerminal';
import { Tooltip } from './components/Tooltip';

const CONFIG_STORAGE_KEY = 'veritas_system_config';

const App: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [isBooting, setIsBooting] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('DEFAULT');
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- CONFIGURATION ---
  const [config, setConfig] = useState<SystemConfig>(() => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch (e) {
      return DEFAULT_CONFIG;
    }
  });

  // --- HOOKS ---
  const { playBlip, playClick, playActivate, playDataStream, playVerdict, playError, isMuted, toggleMute } = useSoundFX();
  const { logs, processState, activeAgentName, currentRound, chatHistory, startReasoning, clearMemory } = useReasoningEngine(config);
  
  const isProcessing = processState !== ProcessState.IDLE && processState !== ProcessState.COMPLETE && processState !== ProcessState.ERROR;

  const { userPrompt, setUserPrompt, handleInputKeyDown, handleExecute } = useCommandTerminal(
    isProcessing,
    (prompt) => {
      playActivate();
      startReasoning(prompt);
      setIsSidebarOpen(false);
    }
  );

  // --- EFFECTS ---
  // Audio Triggers based on State
  useEffect(() => {
    if (isBooting) return;
    if (processState === ProcessState.ANALYZING) playActivate();
    if (processState === ProcessState.AUDITING) playDataStream();
    if (processState === ProcessState.COMPLETE) playVerdict();
    if (processState === ProcessState.ERROR) playError();
  }, [processState, playActivate, playDataStream, playVerdict, playError, isBooting]);

  // Audio Trigger on new logs
  useEffect(() => {
    if (isBooting) return;
    if (logs.length > 0) playBlip();
  }, [logs.length, playBlip, isBooting]);

  // Auto-focus Input
  useEffect(() => {
    if (!isBooting && !isProcessing && !isVoiceActive && typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
        textareaRef.current?.focus();
    }
  }, [processState, isBooting, isProcessing, isVoiceActive]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey) {
            if (e.key === 'k') { e.preventDefault(); handleReset(); }
            if (e.key === 'e') { e.preventDefault(); handleExport(); }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearMemory, playClick]);

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

  // --- HANDLERS ---
  const handleSaveConfig = (newConfig: SystemConfig) => {
    setConfig(newConfig);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    setIsEditingConfig(false);
    setActivePreset('CUSTOM');
    playVerdict();
  };

  const handlePresetChange = (key: string) => {
      playClick();
      setActivePreset(key);
      setConfig(PRESETS[key]);
  };

  const handleExport = () => {
    playClick();
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `veritas_transcript_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    playClick();
    clearMemory();
  }

  const handleInterrogate = (agentName: string) => {
      playClick();
      setUserPrompt(`@${agentName}: `);
      if (textareaRef.current) textareaRef.current.focus();
      setIsSidebarOpen(false);
  };

  if (isBooting) {
    return <BootSequence onComplete={() => setIsBooting(false)} />;
  }

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
        presets={PRESETS}
        isMuted={isMuted}
        toggleMute={toggleMute}
        onPresetChange={handlePresetChange}
        onExport={handleExport}
        onReset={handleReset}
        onConfigOpen={() => { playClick(); setIsEditingConfig(true); }}
        playVerdict={playVerdict}
      />

      <main className="flex-1 flex overflow-hidden relative">
        <NeuralBackground />
        
        {/* Subtle grid overlay remains for texture, but clearer */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>

        <VeritasSidebar 
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          config={config}
          processState={processState}
          activeAgentName={activeAgentName}
          activePreset={activePreset}
          presets={PRESETS}
          onPresetChange={handlePresetChange}
          onInterrogate={handleInterrogate}
        />

        {/* CENTER DASHBOARD */}
        <section className="flex-1 flex flex-col min-w-0 bg-black/10 relative z-10 backdrop-blur-[1px]">
          <div className="flex-1 relative border-b border-zinc-800 overflow-hidden flex flex-col">
             <ReasoningLog logs={logs} agents={config.agents} />
          </div>

          {/* INPUT AREA */}
          <div className="bg-black border-t border-zinc-800 p-4 flex flex-col md:flex-row gap-4 items-stretch shrink-0 shadow-[-10px_-10px_30px_rgba(0,0,0,0.5)] z-20">
             
             {/* Vox Link */}
             <div className="hidden md:block">
                 <VoiceControl 
                    onTranscript={(text) => setUserPrompt(prev => {
                        // Smart append: Add space if needed
                        return prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + text;
                    })}
                    disabled={isProcessing}
                    onStateChange={setIsVoiceActive}
                 />
             </div>

             <div className={`flex-1 relative w-full h-24 md:h-auto group transition-all duration-300 ${isVoiceActive ? 'ring-1 ring-red-500/50 bg-red-950/10' : ''}`}>
               <textarea 
                 ref={textareaRef}
                 value={userPrompt}
                 onChange={(e) => setUserPrompt(e.target.value)}
                 onKeyDown={handleInputKeyDown}
                 placeholder={
                    isVoiceActive ? "LISTENING TO AUDIO STREAM..." :
                    isProcessing ? "PROCESSING STREAM..." : 
                    chatHistory.length > 0 ? "ENTER FOLLOW-UP QUERY OR NEW TOPIC..." : 
                    "INPUT QUERY FOR VERIFICATION... (CTRL+UP for History)"
                 }
                 disabled={isProcessing}
                 className="w-full h-full bg-zinc-900/50 border border-zinc-800 text-veritas-cyan font-mono text-sm p-3 focus:outline-none focus:border-veritas-cyan/50 resize-none placeholder:text-zinc-700 disabled:opacity-50 transition-colors"
               />
               
               {/* Mobile Vox Button (Absolute) */}
               <div className="md:hidden absolute bottom-2 right-2 z-30">
                 <div className="scale-75 origin-bottom-right">
                    <VoiceControl 
                        onTranscript={(text) => setUserPrompt(prev => prev + ' ' + text)}
                        disabled={isProcessing}
                        onStateChange={setIsVoiceActive}
                    />
                 </div>
               </div>

               <div className="absolute top-0 right-0 p-1 pointer-events-none hidden md:block">
                 <div className={`w-2 h-2 border transition-colors ${isVoiceActive ? 'border-red-500 bg-red-500 animate-pulse' : 'border-zinc-600 group-focus-within:border-veritas-cyan'}`}></div>
               </div>
             </div>
             
             <div className="flex flex-col gap-2 w-full md:w-auto">
                 <Tooltip content="Initiate Multi-Agent Reasoning Chain (Enter)" position="left">
                    <button
                        onClick={handleExecute}
                        disabled={isProcessing || !userPrompt.trim()}
                        className="w-full h-12 md:h-16 px-8 bg-veritas-cyan/10 border border-veritas-cyan text-veritas-cyan font-mono font-bold tracking-wider hover:bg-veritas-cyan hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? 'PROCESSING' : 'EXECUTE'}
                    </button>
                 </Tooltip>

                 {chatHistory.length > 0 && !isProcessing && (
                   <Tooltip content="Clear Context Memory & Logs (Ctrl+K)" position="left">
                        <button
                                onClick={handleReset}
                                className="w-full text-[9px] text-zinc-500 hover:text-veritas-red border border-transparent hover:border-zinc-800 py-1 transition-colors uppercase tracking-widest"
                            >
                                CLEAR CONTEXT
                        </button>
                    </Tooltip>
                 )}
             </div>
          </div>
        </section>
      </main>

      {/* MODAL */}
      {isEditingConfig && (
        <ConfigEditor config={config} onSave={handleSaveConfig} onClose={() => setIsEditingConfig(false)} />
      )}
    </div>
  );
};

export default App;