import React, { useState, useEffect, useRef } from 'react';
import { ReasoningLog } from './features/reasoning/components/ReasoningLog';
import { ConfigEditor } from './features/reasoning/components/ConfigEditor';
import { VeritasHeader } from './features/reasoning/components/VeritasHeader';
import { VeritasSidebar } from './features/reasoning/components/VeritasSidebar';
import { BootSequence } from './components/BootSequence';
import { DEFAULT_CONFIG, PRESETS } from './features/reasoning/constants';
import { SystemConfig, ProcessState } from './features/reasoning/types';
import { useReasoningEngine } from './features/reasoning/hooks/useReasoningEngine';
import { useSoundFX } from './features/reasoning/hooks/useSoundFX';
import { useCommandTerminal } from './features/reasoning/hooks/useCommandTerminal';
import { Tooltip } from './components/Tooltip';

const CONFIG_STORAGE_KEY = 'veritas_system_config';
const API_KEY_STORAGE_KEY = 'veritas_user_api_key';

const App: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [isBooting, setIsBooting] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('DEFAULT');
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  
  // Auth State
  const [manualApiKey, setManualApiKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE_KEY);
    } catch {
      return null;
    }
  });

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
  
  // Pass the manual key (or null) to the engine
  const { logs, processState, activeAgentName, currentRound, chatHistory, startReasoning, clearMemory } = useReasoningEngine(config, manualApiKey);
  
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
    if (!isBooting && !isProcessing && typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
        textareaRef.current?.focus();
    }
  }, [processState, isBooting, isProcessing]);

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

  // --- HANDLERS ---
  const handleSaveConfig = (newConfig: SystemConfig) => {
    setConfig(newConfig);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig));
    setIsEditingConfig(false);
    setActivePreset('CUSTOM');
    playVerdict();
  };

  const handleSetManualKey = (key: string | null) => {
    setManualApiKey(key);
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
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
    <div className="h-screen w-screen bg-veritas-black text-white font-sans selection:bg-veritas-cyan selection:text-black flex flex-col overflow-hidden crt-flicker">
      
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
        manualApiKey={manualApiKey}
        onSetManualKey={handleSetManualKey}
      />

      <main className="flex-1 flex overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

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
        <section className="flex-1 flex flex-col min-w-0 bg-black/20 relative z-10">
          <div className="flex-1 relative border-b border-zinc-800 overflow-hidden flex flex-col">
             <ReasoningLog logs={logs} agents={config.agents} />
          </div>

          {/* INPUT AREA */}
          <div className="bg-black border-t border-zinc-800 p-4 flex flex-col md:flex-row gap-4 items-center shrink-0 shadow-[-10px_-10px_30px_rgba(0,0,0,0.5)] z-20">
             <div className="flex-1 relative w-full h-24 md:h-24 group">
               <textarea 
                 ref={textareaRef}
                 value={userPrompt}
                 onChange={(e) => setUserPrompt(e.target.value)}
                 onKeyDown={handleInputKeyDown}
                 placeholder={
                    isProcessing ? "PROCESSING STREAM..." : 
                    chatHistory.length > 0 ? "ENTER FOLLOW-UP QUERY OR NEW TOPIC..." : 
                    "INPUT QUERY FOR VERIFICATION... (CTRL+UP for History)"
                 }
                 disabled={isProcessing}
                 className="w-full h-full bg-zinc-900/50 border border-zinc-800 text-veritas-cyan font-mono text-sm p-3 focus:outline-none focus:border-veritas-cyan/50 resize-none placeholder:text-zinc-700 disabled:opacity-50 transition-colors"
               />
               <div className="absolute top-0 right-0 p-1 pointer-events-none">
                 <div className="w-2 h-2 border border-zinc-600 group-focus-within:border-veritas-cyan transition-colors"></div>
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