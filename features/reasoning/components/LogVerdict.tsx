import React, { useEffect, useMemo, useState } from 'react';
import type {
  ClaimVerificationSummary,
  LogEntry,
  ReasoningOutcome,
} from '../types';
import { TerminalText } from '../../../components/TerminalText';
import { ClaimVerificationPanel } from './ClaimVerificationPanel';

interface LogVerdictProps {
  log: LogEntry;
  onSpeak: (text: string) => void;
  onStop: () => void;
  isPlaying: boolean;
}

const emptyClaimSummary: ClaimVerificationSummary = {
  totalClaims: 0,
  verifiableClaims: 0,
  supportedClaims: 0,
  contradictedClaims: 0,
  mixedClaims: 0,
  notFoundClaims: 0,
  notVerifiableClaims: 0,
  claimsWithSources: 0,
  citationCoverage: 0,
  supportCoverage: 0,
  independentDomains: 0,
};

const fallbackOutcome = (log: LogEntry): ReasoningOutcome => ({
  status: 'unverified',
  answer: log.content,
  mode: 'standard',
  consensusReached: false,
  validatorRan: false,
  verificationStatus: null,
  isConclusive: false,
  roundsExecuted: 0,
  warnings: ['Legacy result: verification metadata was not recorded.'],
  sources: [],
  claims: [],
  claimSummary: emptyClaimSummary,
  provider: 'gemini',
  model: 'unknown',
});

export const LogVerdict: React.FC<LogVerdictProps> = ({
  log,
  onSpeak,
  onStop,
  isPlaying,
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);

  const outcome = useMemo(
    () => log.metadata?.outcome || fallbackOutcome(log),
    [log]
  );

  const statusStyle = {
    verified: {
      title: 'VERIFIED VERDICT',
      subtitle: 'Every verifiable material claim has source-backed support',
      icon: '✓',
      text: 'text-emerald-400',
      border: 'border-emerald-500',
      borderSoft: 'border-emerald-500/30',
      background: 'bg-emerald-500/10',
      glow: 'from-emerald-500/20',
    },
    corrected: {
      title: 'CORRECTED VERDICT',
      subtitle: 'Claim-level validation corrected one or more material assertions',
      icon: '↻',
      text: 'text-veritas-cyan',
      border: 'border-veritas-cyan',
      borderSoft: 'border-veritas-cyan/30',
      background: 'bg-veritas-cyan/10',
      glow: 'from-veritas-cyan/20',
    },
    unverified: {
      title: outcome.mode === 'workflow' ? 'WORKFLOW OUTPUT' : 'UNVERIFIED ANSWER',
      subtitle:
        outcome.mode === 'workflow'
          ? 'Completed workflow; no independent validation performed'
          : outcome.consensusReached
            ? 'Internal agent consensus only; not external verification'
            : 'No complete source-backed verification was achieved',
      icon: '?',
      text: 'text-veritas-gold',
      border: 'border-veritas-gold',
      borderSoft: 'border-veritas-gold/30',
      background: 'bg-veritas-gold/10',
      glow: 'from-veritas-gold/20',
    },
    disputed: {
      title: 'DISPUTED RESULT',
      subtitle: 'Material objections remained unresolved',
      icon: '!',
      text: 'text-veritas-red',
      border: 'border-veritas-red',
      borderSoft: 'border-veritas-red/30',
      background: 'bg-veritas-red/10',
      glow: 'from-veritas-red/20',
    },
    insufficient_evidence: {
      title: 'INSUFFICIENT EVIDENCE',
      subtitle: 'Material claims remain unsupported, mixed, or not externally verifiable',
      icon: '∅',
      text: 'text-orange-400',
      border: 'border-orange-500',
      borderSoft: 'border-orange-500/30',
      background: 'bg-orange-500/10',
      glow: 'from-orange-500/20',
    },
  }[outcome.status];

  useEffect(() => {
    setIsUnlocked(false);
    const timer = window.setTimeout(() => setIsUnlocked(true), 700);
    return () => window.clearTimeout(timer);
  }, [log.id]);

  return (
    <div className="my-12 relative group perspective-1000">
      <div
        className={`absolute -inset-1 bg-gradient-to-b ${statusStyle.glow} to-transparent blur-xl transition-opacity duration-1000 ${
          isUnlocked ? 'opacity-30 group-hover:opacity-50' : 'opacity-0'
        }`}
      />

      <div
        className={`relative bg-black border transition-all duration-500 ${
          isUnlocked
            ? `${statusStyle.border} shadow-[0_0_30px_-10px_rgba(255,204,0,0.1)]`
            : 'border-zinc-800'
        }`}
      >
        <div
          className={`border-b p-3 flex justify-between items-center transition-colors duration-500 ${
            isUnlocked
              ? `${statusStyle.background} ${statusStyle.borderSoft}`
              : 'bg-zinc-900 border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 flex items-center justify-center font-bold text-lg transition-colors duration-500 ${
                isUnlocked
                  ? `${statusStyle.background} ${statusStyle.text} border ${statusStyle.borderSoft}`
                  : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {isUnlocked ? statusStyle.icon : '🔒'}
            </div>
            <div>
              <h3
                className={`font-bold text-sm tracking-[0.2em] leading-none transition-colors duration-500 ${
                  isUnlocked ? statusStyle.text : 'text-zinc-500'
                }`}
              >
                {isUnlocked ? statusStyle.title : 'RESULT PACKET'}
              </h3>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500">
                {isUnlocked
                  ? statusStyle.subtitle
                  : 'Finalizing status metadata...'}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-zinc-600 font-mono text-right">
            ID: {log.id.split('-')[0].toUpperCase()}
            <br />
            MODE: {outcome.mode.toUpperCase()}
          </div>
        </div>

        <div className="p-6 md:p-8 min-h-[100px]">
          {isUnlocked ? (
            <>
              <TerminalText
                text={log.content}
                speed={5}
                scramble={false}
                className="text-base md:text-lg text-white font-medium leading-relaxed font-sans whitespace-pre-wrap block animate-in fade-in duration-500"
              />

              {outcome.warnings.length > 0 && (
                <div className="mt-6 border border-zinc-800 bg-zinc-950/70 p-3">
                  <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">
                    Status notes
                  </div>
                  <ul className="space-y-1">
                    {outcome.warnings.map((warning) => (
                      <li
                        key={warning}
                        className="text-[10px] text-zinc-400 font-mono flex gap-2"
                      >
                        <span className={statusStyle.text}>•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <ClaimVerificationPanel
                claims={outcome.claims}
                summary={outcome.claimSummary}
              />

              {outcome.sources.length > 0 && (
                <div className="mt-4 border-t border-zinc-900 pt-3">
                  <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-2">
                    All validation sources
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {outcome.sources.map((source) =>
                      source.web ? (
                        <a
                          key={source.web.uri}
                          href={source.web.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-veritas-cyan/50 px-2 py-1.5 rounded-sm transition-all"
                        >
                          <span className="text-[10px] text-zinc-500 group-hover:text-veritas-cyan">
                            ↗
                          </span>
                          <span className="text-[10px] text-zinc-400 group-hover:text-white font-mono truncate max-w-[180px]">
                            {source.web.title}
                          </span>
                        </a>
                      ) : null
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-4">
              <div className="flex gap-1">
                {[...Array(5)].map((_, index) => (
                  <div
                    key={index}
                    className="w-2 h-8 bg-zinc-800 animate-pulse"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  />
                ))}
              </div>
              <div className="font-mono text-xs text-zinc-500 tracking-widest animate-pulse">
                CALCULATING CLAIM EVIDENCE STATUS...
              </div>
            </div>
          )}
        </div>

        {isUnlocked && (
          <div
            className={`border-t ${statusStyle.borderSoft} bg-zinc-950/50 p-3 flex flex-col md:flex-row gap-3 justify-between md:items-center animate-in slide-in-from-top-2 duration-500`}
          >
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
              <span>
                STATUS: <b className={statusStyle.text}>{outcome.status}</b>
              </span>
              <span>
                CONSENSUS: {outcome.consensusReached ? 'YES' : 'NO'}
              </span>
              <span>VALIDATOR: {outcome.validatorRan ? 'RAN' : 'NOT RUN'}</span>
              <span>
                SOURCE CHECK: {outcome.verificationStatus || 'NOT RUN'}
              </span>
              <span>CLAIMS: {outcome.claimSummary.totalClaims}</span>
              <span>
                CITATION COVERAGE: {outcome.claimSummary.citationCoverage}%
              </span>
              <span>SOURCES: {outcome.sources.length}</span>
              <span>
                MODEL: {outcome.provider}/{outcome.model}
              </span>
            </div>

            <button
              onClick={() => (isPlaying ? onStop() : onSpeak(log.content))}
              className={`flex items-center justify-center gap-2 px-4 py-1.5 text-[10px] font-bold tracking-wider transition-all duration-300 uppercase ${
                isPlaying
                  ? 'bg-veritas-cyan text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                  : 'bg-transparent border border-zinc-700 text-zinc-400 hover:text-white hover:border-white'
              }`}
            >
              <span>{isPlaying ? '■' : '▶'}</span>
              <span>{isPlaying ? 'STOP AUDIO' : 'PLAY AUDIO'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
