
import React, { useState, useEffect } from 'react';
import { LogEntry } from '../types';
import { TerminalText } from '../../../components/TerminalText';
import { useSoundFX } from '../hooks/useSoundFX';

interface LogVerdictProps {
  log: LogEntry;
  onSpeak: (text: string) => void;
  onStop: () => void;
  isPlaying: boolean;
}

export const LogVerdict: React.FC<LogVerdictProps> = ({ log, onSpeak, onStop, isPlaying }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const { playClick, playVerdict } = useSoundFX();

  // Reveal animation logic
  useEffect(() => {
    // Start locked
    const timer = setTimeout(() => {
        setIsUnlocked(true);
        playVerdict(); // Play success sound when unlocked
    }, 1500); // 1.5s delay for "decryption" effect

    return () => clearTimeout(timer);
  }, [playVerdict]);

  return (
    <div className="my-12 relative group perspective-1000">
      <div className={`absolute -inset-1 bg-gradient-to-b from-veritas-gold/10 to-transparent blur-xl transition-opacity duration-1000 ${isUnlocked ? 'opacity-30 group-hover:opacity-50' : 'opacity-0'}`}></div>
      
      <div className={`relative bg-black border transition-all duration-500 ${isUnlocked ? 'border-veritas-gold shadow-[0_0_30px_-10px_rgba(255,204,0,0.1)]' : 'border-zinc-800'}`}>
          
          {/* Header Stamp */}
          <div className={`border-b p-3 flex justify-between items-center transition-colors duration-500 ${isUnlocked ? 'bg-veritas-gold/10 border-veritas-gold/30' : 'bg-zinc-900 border-zinc-800'}`}>
              <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 flex items-center justify-center font-bold text-lg transition-colors duration-500 ${isUnlocked ? 'bg-veritas-gold text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                    {isUnlocked ? '⚖' : '🔒'}
                  </div>
                  <div>
                      <h3 className={`font-bold text-sm tracking-[0.2em] leading-none transition-colors duration-500 ${isUnlocked ? 'text-veritas-gold' : 'text-zinc-500'}`}>
                        {isUnlocked ? 'OFFICIAL VERDICT' : 'ENCRYPTED PACKET'}
                      </h3>
                      <span className={`text-[9px] uppercase tracking-widest transition-colors duration-500 ${isUnlocked ? 'text-veritas-gold/60' : 'text-zinc-600'}`}>
                        {isUnlocked ? 'Consensus Achieved' : 'Decrypting...'}
                      </span>
                  </div>
              </div>
              <div className="text-[10px] text-zinc-600 font-mono text-right">
                  ID: {log.id.split('-')[0].toUpperCase()}<br/>
                  TS: {log.timestamp}
              </div>
          </div>

          {/* Content Area */}
          <div className="p-8 min-h-[100px]">
              {isUnlocked ? (
                <TerminalText 
                    text={log.content} 
                    speed={5} 
                    scramble={false}
                    className="text-base md:text-lg text-white font-medium leading-relaxed font-sans whitespace-pre-wrap block animate-in fade-in duration-500" 
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-4">
                    <div className="flex gap-1">
                         {[...Array(5)].map((_, i) => (
                             <div key={i} className="w-2 h-8 bg-zinc-800 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}></div>
                         ))}
                    </div>
                    <div className="font-mono text-xs text-zinc-500 tracking-widest animate-pulse">
                        VALIDATING TRUTH CHECKSUM...
                    </div>
                </div>
              )}
          </div>

          {/* Footer / Audio */}
          {isUnlocked && (
              <div className="border-t border-veritas-gold/20 bg-zinc-950/50 p-3 flex justify-between items-center animate-in slide-in-from-top-2 duration-500">
                  <div className="flex gap-4 text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-veritas-gold rounded-full"></span>Authenticity Verified</span>
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-veritas-gold rounded-full"></span>Final & Conclusive</span>
                  </div>
                  <button 
                      onClick={() => isPlaying ? onStop() : onSpeak(log.content)}
                      className={`flex items-center gap-2 px-4 py-1.5 text-[10px] font-bold tracking-wider transition-all duration-300 uppercase
                      ${isPlaying 
                          ? 'bg-veritas-cyan text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]' 
                          : 'bg-transparent border border-zinc-700 text-zinc-400 hover:text-white hover:border-white'}`}
                  >
                      <span>{isPlaying ? '■' : '▶'}</span>
                      <span>{isPlaying ? 'VOICE TRANSMISSION ACTIVE' : 'INITIATE AUDIO BRIEF'}</span>
                  </button>
              </div>
          )}
      </div>
    </div>
  );
};
