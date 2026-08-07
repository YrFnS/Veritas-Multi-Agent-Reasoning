import React from 'react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { Tooltip } from '../../../components/Tooltip';

interface VoiceControlProps {
  onTranscript: (text: string) => void;
  disabled: boolean;
  onStateChange?: (isListening: boolean) => void;
}

export const VoiceControl: React.FC<VoiceControlProps> = ({ onTranscript, disabled, onStateChange }) => {
  const { isListening, transcript, startListening, stopListening, error } = useVoiceInput();

  React.useEffect(() => {
    if (transcript) {
        onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  React.useEffect(() => {
    if (onStateChange) onStateChange(isListening);
  }, [isListening, onStateChange]);

  const handleClick = () => {
    if (isListening) {
        stopListening();
    } else {
        startListening();
    }
  };

  return (
    <div className="relative">
        <Tooltip content={error ? `Error: ${error}` : (isListening ? "VOX LINK ACTIVE // CLICK TO TERMINATE" : "INITIATE VOICE UPLINK")} position="top">
            <button
                onClick={handleClick}
                disabled={disabled}
                aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
                className={`
                    relative w-12 h-12 md:h-16 md:w-16 flex items-center justify-center border transition-all duration-300
                    ${isListening 
                        ? 'bg-red-950/50 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                        : 'bg-zinc-900/50 border-zinc-700 text-zinc-500 hover:text-veritas-cyan hover:border-veritas-cyan hover:bg-veritas-cyan/10'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                {/* Icon */}
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 md:w-6 md:h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>

                {/* Recording Ping Animation */}
                {isListening && (
                    <span className="absolute top-1 right-1 w-2 h-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                )}
            </button>
        </Tooltip>
        
        {/* Status Text Overlay when Listening */}
        {isListening && (
             <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                 <div className="bg-red-500 text-black text-[9px] font-bold px-2 py-0.5 tracking-widest animate-pulse">
                     LISTENING
                 </div>
             </div>
        )}
    </div>
  );
};