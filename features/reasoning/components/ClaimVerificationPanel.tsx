import React from 'react';
import type {
  ClaimVerificationSummary,
  VerifiedClaim,
} from '../types';

interface ClaimVerificationPanelProps {
  claims: VerifiedClaim[];
  summary: ClaimVerificationSummary;
}

const statusConfig: Record<
  VerifiedClaim['status'],
  { label: string; text: string; border: string; background: string; icon: string }
> = {
  supported: {
    label: 'SUPPORTED',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    background: 'bg-emerald-500/5',
    icon: '✓',
  },
  contradicted: {
    label: 'CONTRADICTED',
    text: 'text-veritas-red',
    border: 'border-veritas-red/30',
    background: 'bg-veritas-red/5',
    icon: '×',
  },
  mixed: {
    label: 'MIXED',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    background: 'bg-orange-500/5',
    icon: '≈',
  },
  not_found: {
    label: 'NOT FOUND',
    text: 'text-veritas-gold',
    border: 'border-veritas-gold/30',
    background: 'bg-veritas-gold/5',
    icon: '?',
  },
  not_verifiable: {
    label: 'NOT VERIFIABLE',
    text: 'text-zinc-400',
    border: 'border-zinc-700',
    background: 'bg-zinc-900/30',
    icon: '∅',
  },
};

const Metric: React.FC<{ label: string; value: string | number }> = ({
  label,
  value,
}) => (
  <div className="border border-zinc-800 bg-black/40 px-3 py-2 min-w-0">
    <div className="text-[8px] text-zinc-600 uppercase tracking-widest truncate">
      {label}
    </div>
    <div className="text-sm text-zinc-200 font-mono mt-1">{value}</div>
  </div>
);

const ClaimCard: React.FC<{ claim: VerifiedClaim }> = ({ claim }) => {
  const style = statusConfig[claim.status];

  return (
    <article className={`border ${style.border} ${style.background} p-3`}>
      <div className="flex flex-col md:flex-row md:items-start gap-2 md:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <span
            className={`w-5 h-5 shrink-0 border ${style.border} ${style.text} flex items-center justify-center text-[10px] font-bold`}
          >
            {style.icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[9px] font-mono text-zinc-500">
                {claim.id}
              </span>
              <span className={`text-[9px] font-mono font-bold ${style.text}`}>
                {style.label}
              </span>
              <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-600 border border-zinc-800 px-1.5 py-0.5">
                {claim.importance}
              </span>
            </div>
            <p className="text-xs md:text-sm text-zinc-200 leading-relaxed">
              {claim.text}
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[10px] md:text-xs text-zinc-500 font-mono leading-relaxed">
        {claim.rationale}
      </p>

      {claim.correctedText && (
        <div className="mt-3 border-l-2 border-veritas-cyan pl-3 py-1">
          <div className="text-[8px] text-veritas-cyan uppercase tracking-widest mb-1">
            Corrected claim
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {claim.correctedText}
          </p>
        </div>
      )}

      {claim.sources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800/70">
          <div className="text-[8px] text-zinc-600 uppercase tracking-widest mb-2">
            Evidence for this claim
          </div>
          <div className="flex flex-wrap gap-2">
            {claim.sources.map((source) =>
              source.web ? (
                <a
                  key={source.web.uri}
                  href={source.web.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-1.5 border border-zinc-800 bg-zinc-950 px-2 py-1 hover:border-veritas-cyan/50 transition-colors min-w-0"
                >
                  <span className="text-[9px] text-zinc-600 group-hover:text-veritas-cyan">
                    ↗
                  </span>
                  <span className="text-[9px] text-zinc-500 group-hover:text-zinc-200 font-mono truncate max-w-[220px]">
                    {source.web.title}
                  </span>
                </a>
              ) : null
            )}
          </div>
        </div>
      )}
    </article>
  );
};

export const ClaimVerificationPanel: React.FC<
  ClaimVerificationPanelProps
> = ({ claims, summary }) => {
  if (claims.length === 0) return null;

  const unresolved =
    summary.mixedClaims +
    summary.notFoundClaims +
    summary.notVerifiableClaims;

  return (
    <section className="mt-6 border border-zinc-800 bg-zinc-950/60 p-3 md:p-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-4">
        <div>
          <div className="text-[9px] text-veritas-cyan uppercase tracking-[0.2em] font-bold">
            Claim verification audit
          </div>
          <p className="text-[9px] text-zinc-600 font-mono mt-1">
            Evidence is attached to individual assertions, not only to the answer as a whole.
          </p>
        </div>
        <div className="text-[9px] text-zinc-500 font-mono">
          {summary.totalClaims} CLAIM{summary.totalClaims === 1 ? '' : 'S'}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        <Metric label="Supported" value={summary.supportedClaims} />
        <Metric label="Contradicted" value={summary.contradictedClaims} />
        <Metric label="Unresolved" value={unresolved} />
        <Metric label="Citation coverage" value={`${summary.citationCoverage}%`} />
        <Metric label="Support coverage" value={`${summary.supportCoverage}%`} />
        <Metric label="Source domains" value={summary.independentDomains} />
      </div>

      <div className="space-y-3">
        {claims.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} />
        ))}
      </div>
    </section>
  );
};
