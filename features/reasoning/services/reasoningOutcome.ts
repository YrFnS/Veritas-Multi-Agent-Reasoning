import type {
  ClaimVerificationSummary,
  ProviderType,
  ReasoningMode,
  ReasoningOutcome,
  SourceMetadata,
  VerificationStatus,
  VerifiedClaim,
} from '../types.js';
import {
  createEmptyClaimSummary,
  summarizeClaimVerification,
} from './claimVerification.js';
import { dedupeSources } from './sourceUtils.js';

interface BaseOutcomeInput {
  answer: string;
  provider: ProviderType;
  model: string;
  warnings?: string[];
  sources?: SourceMetadata[];
  claims?: VerifiedClaim[];
  claimSummary?: ClaimVerificationSummary;
}

export interface StandardOutcomeInput extends BaseOutcomeInput {
  consensusReached: boolean;
  validatorRan: boolean;
  verificationStatus: VerificationStatus;
  isConclusive: boolean;
  roundsExecuted: number;
}

const uniqueWarnings = (warnings: string[] = []): string[] =>
  [...new Set(warnings.map((warning) => warning.trim()).filter(Boolean))];

export const buildStandardOutcome = (
  input: StandardOutcomeInput
): ReasoningOutcome => {
  const claims = input.claims || [];
  const claimSummary =
    input.claimSummary ||
    (claims.length > 0
      ? summarizeClaimVerification(claims)
      : createEmptyClaimSummary());
  const sources = dedupeSources([
    ...(input.sources || []),
    ...claims.flatMap((claim) => claim.sources),
  ]);
  const hasSourceBackedValidation =
    input.validatorRan &&
    sources.length > 0 &&
    claimSummary.claimsWithSources > 0;
  const warnings = [...(input.warnings || [])];

  if (
    input.validatorRan &&
    (input.verificationStatus === 'CONFIRMED' ||
      input.verificationStatus === 'CORRECTED') &&
    !hasSourceBackedValidation
  ) {
    warnings.push(
      'Verification was downgraded because no external source metadata was attached to the checked claims.'
    );
  }

  let status: ReasoningOutcome['status'];
  if (!input.isConclusive) {
    status = 'insufficient_evidence';
  } else if (
    hasSourceBackedValidation &&
    input.verificationStatus === 'CONFIRMED'
  ) {
    status = 'verified';
  } else if (
    hasSourceBackedValidation &&
    input.verificationStatus === 'CORRECTED'
  ) {
    status = 'corrected';
  } else if (!input.consensusReached) {
    status = 'disputed';
  } else {
    status = 'unverified';
  }

  return {
    status,
    answer: input.answer,
    mode: 'standard',
    consensusReached: input.consensusReached,
    validatorRan: input.validatorRan,
    verificationStatus: input.verificationStatus,
    isConclusive: input.isConclusive,
    roundsExecuted: input.roundsExecuted,
    warnings: uniqueWarnings(warnings),
    sources,
    claims,
    claimSummary,
    provider: input.provider,
    model: input.model,
  };
};

export interface UnverifiedOutcomeInput extends BaseOutcomeInput {
  mode: Exclude<ReasoningMode, 'standard'>;
  isConclusive?: boolean;
}

export const buildUnverifiedOutcome = (
  input: UnverifiedOutcomeInput
): ReasoningOutcome => ({
  status: input.isConclusive === false ? 'insufficient_evidence' : 'unverified',
  answer: input.answer,
  mode: input.mode,
  consensusReached: false,
  validatorRan: false,
  verificationStatus: null,
  isConclusive: input.isConclusive ?? false,
  roundsExecuted: 0,
  warnings: uniqueWarnings(input.warnings),
  sources: dedupeSources(input.sources),
  claims: input.claims || [],
  claimSummary:
    input.claimSummary ||
    (input.claims?.length
      ? summarizeClaimVerification(input.claims)
      : createEmptyClaimSummary()),
  provider: input.provider,
  model: input.model,
});
