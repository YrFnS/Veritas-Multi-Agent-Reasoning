import type {
  AgentConfig,
  ClaimVerificationSummary,
  IReasoningCore,
  LogEntry,
  SourceMetadata,
  SystemConfig,
  VerificationStatus,
  VerifiedClaim,
} from '../types.js';
import {
  CLAIM_EXTRACTION_PROMPT,
  CLAIM_SYNTHESIS_PROMPT,
  CLAIM_VERIFICATION_PROMPT,
  generateSystemInstruction,
} from './prompts.js';
import {
  CLAIM_EXTRACTION_SCHEMA,
  CLAIM_SYNTHESIS_SCHEMA,
  CLAIM_VERIFICATION_SCHEMA,
} from './schemas.js';
import {
  assertClaimExtractionResponse,
  assertClaimSynthesisResponse,
  assertClaimVerificationResponse,
} from '../validation/responseValidation.js';
import {
  buildClaimVerificationReport,
  buildVerifiedClaim,
  collectClaimSources,
  createEmptyClaimSummary,
  deriveClaimVerificationStatus,
  isClaimVerificationConclusive,
  summarizeClaimVerification,
} from './claimVerification.js';
import { createLogEntry } from './reasoningRuntime.js';

interface ClaimValidationInput {
  userPrompt: string;
  verdict: string;
  validator: AgentConfig;
  config: SystemConfig;
  core: IReasoningCore;
  model: string;
  onLog: (log: LogEntry) => void;
  signal?: AbortSignal;
}

export interface ClaimValidationResult {
  answer: string;
  validatorRan: boolean;
  verificationStatus: VerificationStatus;
  isConclusive: boolean;
  claims: VerifiedClaim[];
  summary: ClaimVerificationSummary;
  sources: SourceMetadata[];
  warnings: string[];
}

const statusLabel = (claim: VerifiedClaim): string =>
  claim.status.replace('_', ' ').toUpperCase();

const summaryLine = (summary: ClaimVerificationSummary): string =>
  `${summary.supportedClaims}/${summary.verifiableClaims} supported, ` +
  `${summary.contradictedClaims} contradicted, ` +
  `${summary.mixedClaims + summary.notFoundClaims} unresolved, ` +
  `${summary.citationCoverage}% citation coverage`;

export const runClaimLevelValidation = async (
  input: ClaimValidationInput
): Promise<ClaimValidationResult> => {
  const {
    userPrompt,
    verdict,
    validator,
    config,
    core,
    model,
    onLog,
    signal,
  } = input;
  const warnings: string[] = [];

  if (signal?.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');
  onLog(
    createLogEntry(
      validator.role,
      validator.name,
      'Extracting atomic claims for independent verification...',
      true
    )
  );

  const extractionResponse = await core.generateJSON(
    model,
    generateSystemInstruction(validator, config),
    CLAIM_EXTRACTION_PROMPT(userPrompt, verdict),
    CLAIM_EXTRACTION_SCHEMA,
    false,
    validator,
    signal
  );
  const extraction = assertClaimExtractionResponse(extractionResponse.data);

  if (extraction.claims.length === 0) {
    const summary = createEmptyClaimSummary();
    warnings.push(
      'No atomic factual claims were extracted, so external verification could not be completed.'
    );
    onLog(
      createLogEntry(
        validator.role,
        validator.name,
        'CLAIM CHECK UNVERIFIED\n\nNo externally checkable factual claims were identified.',
        false,
        {
          claims: extraction.claims,
          verifiedClaims: [],
          claimSummary: summary,
          verification_status: 'UNVERIFIED',
          reasoning: warnings[0],
          final_output: verdict,
        }
      )
    );

    return {
      answer: verdict,
      validatorRan: true,
      verificationStatus: 'UNVERIFIED',
      isConclusive: false,
      claims: [],
      summary,
      sources: [],
      warnings,
    };
  }

  const verifiedClaims: VerifiedClaim[] = [];

  for (const [index, claim] of extraction.claims.entries()) {
    if (signal?.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');

    onLog(
      createLogEntry(
        validator.role,
        validator.name,
        `Verifying claim ${index + 1}/${extraction.claims.length}: ${claim.id}...`,
        true
      )
    );

    if (!claim.verifiable) {
      const verifiedClaim = buildVerifiedClaim(
        claim,
        {
          status: 'NOT_VERIFIABLE',
          rationale:
            'The extracted statement is an opinion, recommendation, prediction, or otherwise lacks an external truth condition.',
          corrected_claim: '',
        },
        []
      );
      verifiedClaims.push(verifiedClaim);
      onLog(
        createLogEntry(
          validator.role,
          validator.name,
          `${claim.id} — ${statusLabel(verifiedClaim)}\n${verifiedClaim.rationale}`,
          false,
          { verifiedClaims: [verifiedClaim] }
        )
      );
      continue;
    }

    const response = await core.generateJSON(
      model,
      generateSystemInstruction(validator, config),
      CLAIM_VERIFICATION_PROMPT(userPrompt, verdict, claim),
      CLAIM_VERIFICATION_SCHEMA,
      true,
      validator,
      signal
    );
    const data = assertClaimVerificationResponse(response.data);
    const verifiedClaim = buildVerifiedClaim(claim, data, response.sources);
    verifiedClaims.push(verifiedClaim);

    onLog(
      createLogEntry(
        validator.role,
        validator.name,
        `${claim.id} — ${statusLabel(verifiedClaim)}\n${verifiedClaim.rationale}`,
        false,
        { verifiedClaims: [verifiedClaim] },
        verifiedClaim.sources
      )
    );
  }

  const summary = summarizeClaimVerification(verifiedClaims);
  const verificationStatus = deriveClaimVerificationStatus(summary);
  const sources = collectClaimSources(verifiedClaims);
  const isConclusive = isClaimVerificationConclusive(verifiedClaims);

  if (summary.notFoundClaims > 0) {
    warnings.push(
      `${summary.notFoundClaims} claim(s) could not be matched to reliable external evidence.`
    );
  }
  if (summary.mixedClaims > 0) {
    warnings.push(
      `${summary.mixedClaims} claim(s) had mixed or only partial evidence.`
    );
  }
  if (summary.notVerifiableClaims > 0) {
    warnings.push(
      `${summary.notVerifiableClaims} claim(s) were not externally verifiable.`
    );
  }
  if (summary.verifiableClaims > 0 && summary.citationCoverage < 100) {
    warnings.push(
      `Citation coverage was ${summary.citationCoverage}% across verifiable claims.`
    );
  }

  let finalOutput = verdict;
  let synthesisReasoning = summaryLine(summary);
  const needsSynthesis = verifiedClaims.some(
    (claim) => claim.status !== 'supported'
  );

  if (needsSynthesis) {
    if (signal?.aborted) throw new Error('ABORT_SEQUENCE_RECEIVED');
    onLog(
      createLogEntry(
        validator.role,
        validator.name,
        'Rewriting the answer from the claim verification report...',
        true
      )
    );

    const synthesisResponse = await core.generateJSON(
      model,
      generateSystemInstruction(validator, config),
      CLAIM_SYNTHESIS_PROMPT(
        userPrompt,
        verdict,
        buildClaimVerificationReport(verifiedClaims)
      ),
      CLAIM_SYNTHESIS_SCHEMA,
      false,
      validator,
      signal
    );
    const synthesis = assertClaimSynthesisResponse(synthesisResponse.data);
    finalOutput = synthesis.final_output;
    synthesisReasoning = synthesis.reasoning;
  }

  const statusPrefix =
    verificationStatus === 'CONFIRMED'
      ? '✅ CLAIM CHECK CONFIRMED'
      : verificationStatus === 'CORRECTED'
        ? '⚠ CLAIM CHECK CORRECTED'
        : '⚠ CLAIM CHECK UNVERIFIED';

  onLog(
    createLogEntry(
      validator.role,
      validator.name,
      `${statusPrefix}\n\n${summaryLine(summary)}\n\n${finalOutput}`,
      false,
      {
        claims: extraction.claims,
        verifiedClaims,
        claimSummary: summary,
        verification_status: verificationStatus,
        reasoning: synthesisReasoning,
        final_output: finalOutput,
      },
      sources
    )
  );

  return {
    answer: finalOutput,
    validatorRan: true,
    verificationStatus,
    isConclusive,
    claims: verifiedClaims,
    summary,
    sources,
    warnings,
  };
};
