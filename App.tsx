import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ReasoningLog } from './features/reasoning/components/ReasoningLog';
import { ConfigEditor } from './features/reasoning/components/ConfigEditor';
import { VoiceControl } from './features/reasoning/components/VoiceControl';
import { VeritasShell } from './features/reasoning/components/VeritasShell';
import { BootSequence } from './components/BootSequence';
import { Tooltip } from './components/Tooltip';
import { logSystemEvent } from './components/SystemMonitor';
import { DEFAULT_CONFIG, PRESETS } from './features/reasoning/constants';
import { ProcessState } from './features/reasoning/types';
import type { SystemConfig } from './features/reasoning/types';
import { useReasoningEngine } from './features/reasoning/hooks/useReasoningEngine';
import { useSoundFX } from './features/reasoning/hooks/useSoundFX';
import { useCommandTerminal } from './features/reasoning/hooks/useCommandTerminal';
import { parseSystemConfig } from './features/reasoning/validation/configValidation.js';

const CONFIG_STORAGE_KEY = 'veritas_system_config';

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('DEFAULT');
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [config, setConfig] = useState<SystemConfig>(() => {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      return saved ? parseSystemConfig(JSON.parse(saved)) : DEFAULT_CONFIG;
    } catch (error) {
      console.warn('Stored configuration was invalid and has been reset.', error);
      return DEFAULT_CONFIG;
    }
  });

  const {
    playBlip,
    playClick,
    playKeystroke,
    playActivate,
    playDataStream,
    playVerdict,
    playError,
    isMuted,
    toggleMute,
  } = useSoundFX();
  const {
    logs,
    processState,
    activeAgentName,
    currentRound,
    chatHistory,
    startReasoning,
    stopReasoning,
    clearMemory,
  } = useReasoningEngine(config);

  const isProcessing = ![
    ProcessState.IDLE,
    ProcessState.COMPLETE,
    ProcessState.CANCELLED,
    ProcessState.ERROR,
  ].includes(processState);

  const { userPrompt, setUserPrompt, handleInputKeyDown, handleExecute } =
    useCommandTerminal(isProcessing, (prompt) => {
      playActivate();
      startReasoning(prompt);
      logSystemEvent('EXEC_SEQUENCE_INIT');
      setIsSidebarOpen(false);
    });

  useEffect(() => {
    if (isBooting) return;
    if (processState === ProcessState.ANALYZING) {
      playActivate();
      logSystemEvent('STATE: ANALYZING');
    }
    if (processState === ProcessState.AUDITING) {
      playDataStream();
      logSystemEvent('STATE: AUDITING');
    }
    if (processState === ProcessState.JUDGING) {
      logSystemEvent('STATE: JUDICIAL_REVIEW');
    }
    if (processState === ProcessState.COMPLETE) {
      playVerdict();
      logSystemEvent('PROCESS_COMPLETE');
    }
    if (processState === ProcessState.CANCELLED) {
      logSystemEvent('PROCESS_CANCELLED');
    }
    if (processState === ProcessState.ERROR) {
      playError();
      logSystemEvent('CRITICAL_ERROR');
    }
  }, [
    processState,
    playActivate,
    playDataStream,
    playVerdict,
    playError,
    isBooting,
  ]);

  useEffect(() => {
    if (!isBooting && logs.length > 0) playBlip();
  }, [logs.length, playBlip, isBooting]);

  useEffect(() => {
    if (
      !isBooting &&
      !isProcessing &&
      !isVoiceActive &&
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 768px)').matches
    ) {
      textareaRef.current?.focus();
    }
  }, [processState, isBooting, isProcessing, isVoiceActive]);

  const handleSaveConfig = (newConfig: SystemConfig) => {
    const normalized = parseSystemConfig(newConfig);
    setConfig(normalized);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    setIsEditingConfig(false);
    setActivePreset('CUSTOM');
    logSystemEvent('CONFIG_UPDATED');
    playVerdict();
  };

  const handlePresetChange = (key: string) => {
    playClick();
    const nextConfig = parseSystemConfig(PRESETS[key]);
    setActivePreset(key);
    setConfig(nextConfig);
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(nextConfig));
    logSystemEvent(`PRESET_LOADED: ${key}`);
  };

  const handleExport = useCallback(() => {
    playClick();
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `veritas_transcript_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    logSystemEvent('EXPORT_SUCCESS');
  }, [logs, playClick]);

  const handleReset = useCallback(() => {
    playClick();
    clearMemory();
    logSystemEvent('MEMORY_PURGED');
  }, [clearMemory, playClick]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;

      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        handleReset();
      }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        handleExport();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExport, handleReset]);

  const handleInterrogate = (agentName: string) => {
    playClick();
    setUserPrompt(`@${agentName}: `);
    textareaRef.current?.focus();
    setIsSidebarOpen(false);
  };

  const handleToggleMute = () => {
    toggleMute();
    logSystemEvent(
      isMuted ? 'AUDIO_UPLINK: RESTORED' : 'AUDIO_UPLINK: DISABLED'
    );
  };

  const handleStop = () => {
    playError();
    stopReasoning();
    logSystemEvent('PROCESS_CANCEL_REQUESTED');
  };

  if (isBooting) {
    return <BootSequence onComplete={() => setIsBooting(false)} />;
  }

  return (
    <>
      <VeritasShell
        processState={processState}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        config={config}
        activeAgentName={activeAgentName}
        activePreset={activePreset}
        isMuted={isMuted}
        isProcessing={isProcessing}
        currentRound={currentRound}
        presets={PRESETS}
        onPresetChange={handlePresetChange}
        onInterrogate={handleInterrogate}
        onExport={handleExport}
        onReset={handleReset}
        onConfigOpen={() => {
          playClick();
          setIsEditingConfig(true);
        }}
        playVerdict={playVerdict}
        toggleMute={handleToggleMute}
      >
        <div className="flex-1 relative border-b border-zinc-800 overflow-hidden flex flex-col">
          <ReasoningLog logs={logs} agents={config.agents} />
        </div>

        <div className="bg-black border-t border-zinc-800 p-4 flex flex-col md:flex-row gap-4 items-stretch shrink-0 shadow-[-10px_-10px_30px_rgba(0,0,0,0.5)] z-20">
          <div className="hidden md:block">
            <VoiceControl
              onTranscript={(text) =>
                setUserPrompt((previous) =>
                  previous +
                  (previous.length > 0 && !previous.endsWith(' ') ? ' ' : '') +
                  text
                )
              }
              disabled={isProcessing}
              onStateChange={(active) => {
                setIsVoiceActive(active);
                if (active) logSystemEvent('VOX_CHANNEL_OPEN');
              }}
            />
          </div>

          <div
            className={`flex-1 relative w-full h-24 md:h-auto group transition-all duration-300 ${
              isVoiceActive ? 'ring-1 ring-red-500/50 bg-red-950/10' : ''
            }`}
          >
            <textarea
              ref={textareaRef}
              value={userPrompt}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                setUserPrompt(event.target.value);
                if (Math.random() > 0.3) playKeystroke();
              }}
              onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
                handleInputKeyDown(event);
                if (event.key === 'Enter') playClick();
              }}
              placeholder={
                isVoiceActive
                  ? 'LISTENING TO AUDIO STREAM...'
                  : isProcessing
                    ? 'PROCESSING STREAM...'
                    : chatHistory.length > 0
                      ? 'ENTER FOLLOW-UP QUERY OR NEW TOPIC...'
                      : 'INPUT QUERY FOR VERIFICATION... (CTRL+UP for History)'
              }
              disabled={isProcessing}
              className="w-full h-full bg-zinc-900/50 border border-zinc-800 text-veritas-cyan font-mono text-sm p-3 focus:outline-none focus:border-veritas-cyan/50 resize-none placeholder:text-zinc-700 disabled:opacity-50 transition-colors"
            />

            <div className="md:hidden absolute bottom-2 right-2 z-30">
              <div className="scale-75 origin-bottom-right">
                <VoiceControl
                  onTranscript={(text) =>
                    setUserPrompt((previous) => `${previous} ${text}`.trimStart())
                  }
                  disabled={isProcessing}
                  onStateChange={setIsVoiceActive}
                />
              </div>
            </div>

            <div className="absolute top-0 right-0 p-1 pointer-events-none hidden md:block">
              <div
                className={`w-2 h-2 border transition-colors ${
                  isVoiceActive
                    ? 'border-red-500 bg-red-500 animate-pulse'
                    : 'border-zinc-600 group-focus-within:border-veritas-cyan'
                }`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto">
            {isProcessing ? (
              <Tooltip
                content="Cancel the current reasoning sequence"
                position="left"
              >
                <button
                  onClick={handleStop}
                  className="w-full h-12 md:h-16 px-8 bg-red-950/30 border border-red-500 text-red-500 font-mono font-bold tracking-wider hover:bg-red-500 hover:text-black transition-all animate-pulse"
                >
                  CANCEL
                </button>
              </Tooltip>
            ) : (
              <Tooltip
                content="Initiate multi-agent reasoning (Enter)"
                position="left"
              >
                <button
                  onClick={handleExecute}
                  disabled={!userPrompt.trim()}
                  className="w-full h-12 md:h-16 px-8 bg-veritas-cyan/10 border border-veritas-cyan text-veritas-cyan font-mono font-bold tracking-wider hover:bg-veritas-cyan hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  EXECUTE
                </button>
              </Tooltip>
            )}

            {chatHistory.length > 0 && !isProcessing && (
              <Tooltip
                content="Clear context memory and logs (Ctrl+K)"
                position="left"
              >
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
      </VeritasShell>

      {isEditingConfig && (
        <ConfigEditor
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setIsEditingConfig(false)}
        />
      )}
    </>
  );
};

export default App;
