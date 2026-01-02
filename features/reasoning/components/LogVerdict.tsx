import React from 'react';
import { LogEntry } from '../types';
import { TerminalText } from '../../../components/TerminalText';

interface LogVerdictProps {
  log: LogEntry;
  onSpeak: (text: string) => void;
  onStop: () => void;
  isPlaying: boolean;
}

export const LogVerdict: React.FC<LogVerdictProps> = ({ log, onSpeak, onStop, isPlaying }) => {
  return (
    <div className="my-12 relative group perspective-1000">
      <div className="absolute -inset-1 bg-gradient-to-b from-veritas-gold/10 to-transparent blur-xl opacity-30 group-hover:opacity-50 transition-opacity"></div>
      <div className="relative bg-black border border-veritas-gold shadow-[0_0_30px_-10px_rgba(255,204,0,0.1)]">
          
          {/* Header Stamp */}
          <div className="bg-veritas-gold/10 border-b border-veritas-gold/30 p-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-veritas-gold flex items-center justify-center text-black font-bold text-lg">⚖</div>
                  <div>
                      <h3 className="text-veritas-gold font-bold text-sm tracking-[0.2em] leading-none">OFFICIAL VERDICT</h3>
                      <span className="text-[9px] text-veritas-gold/60 uppercase tracking-widest">Consensus Achieved</span>
                  </div>
              </div>
              <div className="text-[10px] text-veritas-gold/50 font-mono text-right">
                  ID: {log.id.split('-')[0].toUpperCase()}<br/>
                  TS: {log.timestamp}
              </div>
          </div>

          {/* Content */}
          <div className="p-8">
              <TerminalText 
                  text={log.content} 
                  speed={5} 
                  scramble={false}
                  className="text-base md:text-lg text-white font-medium leading-relaxed font-sans whitespace-pre-wrap block" 
              />
          </div>

          {/* Footer / Audio */}
          <div className="border-t border-veritas-gold/20 bg-zinc-950/50 p-3 flex justify-between items-center">
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
      </div>
    </div>
  );
};