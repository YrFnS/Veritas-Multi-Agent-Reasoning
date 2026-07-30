import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertClaimExtractionResponse,
  assertClaimSynthesisResponse,
  assertClaimVerificationResponse,
} from '../.test-dist/features/reasoning/validation/responseValidation.js';
import {
  buildVerifiedClaim,
  deriveClaimVerificationStatus,
  isClaimVerificationConclusive,
  summarizeClaimVerification,
} from '../.test-dist/features/reasoning/services/claimVerification.js';
import { buildStandardOutcome } from '../.test-dist/features/reasoning/services/reasoningOutcome.js';
import { CLAIM_VERIFICATION_PROMPT } from '../.test-dist/features/reasoning/services/prompts.js';
import { EVALUATION_DATASET } from '../.test-dist/features/reasoning/evaluation/evaluationDataset.js';
import {
  scoreEvaluationObservation,
  summarizeEvaluationScores,
} from '../.test-dist/features/reasoning/evaluation/evaluationHarness.js';

const source = (uri, title = uri) => ({ web: { uri, title } });

const extractedClaim = (overrides = {}) => ({
  id: 'C1',
  text: 'Gold has the chemical symbol Au.',
  importance: 'primary',
  verifiable: true,
  ...overrides,
});

test('claim extraction enforces atomic limits and unique identifiers', () => {
  const result = assertClaimExtractionResponse({
    claims: [
      extractedClaim(),
      extractedClaim({
        id: 'C2',
        text: 'Gold is an element.',
        importance: 'supporting',
      }),
    ],
  });

  assert.equal(result.claims.length, 2);
  assert.throws(
    () =>
      assertClaimExtractionResponse({
        claims: [extractedClaim(), extractedClaim({ id: 'c1' })],
      }),
    /unique/i
  );
  assert.throws(
    () =>
      assertClaimExtractionResponse({
        claims: Array.from({ length: 7 }, (_, index) =>
          extractedClaim({ id: `C${index + 1}`, text: `Claim ${index + 1}` })
        ),
      }),
    /at most six/i
  );
});

test('contradicted claim responses require an explicit correction', () => {
  assert.throws(
    () =>
      assertClaimVerificationResponse({
        status: 'CONTRADICTED',
        rationale: 'The evidence rejects the claim.',
        corrected_claim: '',
      }),
    /corrected_claim/
  );

  assert.deepEqual(
    assertClaimSynthesisResponse({
      reasoning: 'One claim was corrected.',
      final_output: 'Corrected answer.',
    }),
    {
      reasoning: 'One claim was corrected.',
      final_output: 'Corrected answer.',
    }
  );
});

test('source-less support is downgraded instead of being presented as verified', () => {
  const claim = buildVerifiedClaim(
    extractedClaim(),
    {
      status: 'SUPPORTED',
      rationale: 'The model says it found support.',
      corrected_claim: '',
    },
    []
  );

  assert.equal(claim.status, 'not_found');
  assert.match(claim.rationale, /downgraded/i);
});

test('source-less contradictions cannot leak an unsupported correction', () => {
  const claim = buildVerifiedClaim(
    extractedClaim({ text: 'Gold has atomic number 80.' }),
    {
      status: 'CONTRADICTED',
      rationale: 'The model proposed a correction without attached evidence.',
      corrected_claim: 'Gold has atomic number 79.',
    },
    []
  );

  assert.equal(claim.status, 'not_found');
  assert.equal(claim.correctedText, undefined);
  assert.equal(isClaimVerificationConclusive([claim]), false);
});

test('non-verifiable source metadata cannot inflate citation coverage', () => {
  const supported = buildVerifiedClaim(
    extractedClaim(),
    {
      status: 'SUPPORTED',
      rationale: 'Supported by an external reference.',
      corrected_claim: '',
    },
    [source('https://chemistry.example/gold')]
  );
  const nonVerifiable = buildVerifiedClaim(
    extractedClaim({
      id: 'C2',
      text: 'Gold is the most beautiful metal.',
    }),
    {
      status: 'NOT_VERIFIABLE',
      rationale: 'Beauty is a value judgment.',
      corrected_claim: '',
    },
    [source('https://opinion.example/gold')]
  );

  const summary = summarizeClaimVerification([supported, nonVerifiable]);

  assert.equal(summary.verifiableClaims, 1);
  assert.equal(summary.claimsWithSources, 1);
  assert.equal(summary.citationCoverage, 100);
  assert.equal(summary.independentDomains, 1);
});

test('claim summaries compute coverage and deterministic verification state', () => {
  const claims = [
    buildVerifiedClaim(
      extractedClaim(),
      {
        status: 'SUPPORTED',
        rationale: 'Supported by a chemistry reference.',
        corrected_claim: '',
      },
      [source('https://example.com/gold')]
    ),
    buildVerifiedClaim(
      extractedClaim({
        id: 'C2',
        text: 'Gold has atomic number 80.',
      }),
      {
        status: 'CONTRADICTED',
        rationale: 'Authoritative references list atomic number 79.',
        corrected_claim: 'Gold has atomic number 79.',
      },
      [source('https://example.org/periodic-table')]
    ),
    buildVerifiedClaim(
      extractedClaim({
        id: 'C3',
        text: 'A supporting detail lacks evidence.',
        importance: 'supporting',
      }),
      {
        status: 'NOT_FOUND',
        rationale: 'No reliable evidence was located.',
        corrected_claim: '',
      },
      []
    ),
    buildVerifiedClaim(
      extractedClaim({
        id: 'C4',
        text: 'Gold is the most beautiful metal.',
        importance: 'supporting',
        verifiable: false,
      }),
      {
        status: 'NOT_VERIFIABLE',
        rationale: 'Beauty is a value judgment.',
        corrected_claim: '',
      },
      []
    ),
  ];

  const summary = summarizeClaimVerification(claims);

  assert.equal(summary.totalClaims, 4);
  assert.equal(summary.verifiableClaims, 3);
  assert.equal(summary.supportedClaims, 1);
  assert.equal(summary.contradictedClaims, 1);
  assert.equal(summary.notFoundClaims, 1);
  assert.equal(summary.notVerifiableClaims, 1);
  assert.equal(summary.claimsWithSources, 2);
  assert.equal(summary.citationCoverage, 67);
  assert.equal(summary.supportCoverage, 33);
  assert.equal(summary.independentDomains, 2);
  assert.equal(deriveClaimVerificationStatus(summary), 'CORRECTED');
  assert.equal(isClaimVerificationConclusive(claims), true);
});

test('an unresolved primary claim makes claim validation inconclusive', () => {
  const claims = [
    buildVerifiedClaim(
      extractedClaim(),
      {
        status: 'MIXED',
        rationale: 'Credible sources disagree.',
        corrected_claim: '',
      },
      [source('https://one.example/evidence')]
    ),
  ];

  assert.equal(isClaimVerificationConclusive(claims), false);
  assert.equal(
    deriveClaimVerificationStatus(summarizeClaimVerification(claims)),
    'UNVERIFIED'
  );
});

test('reasoning outcomes retain claim evidence and correction status', () => {
  const claim = buildVerifiedClaim(
    extractedClaim(),
    {
      status: 'CONTRADICTED',
      rationale: 'The original assertion was wrong.',
      corrected_claim: 'Gold has the chemical symbol Au.',
    },
    [source('https://example.com/corrected')]
  );
  const summary = summarizeClaimVerification([claim]);
  const outcome = buildStandardOutcome({
    answer: 'Gold has the chemical symbol Au.',
    consensusReached: true,
    validatorRan: true,
    verificationStatus: 'CORRECTED',
    isConclusive: true,
    roundsExecuted: 1,
    claims: [claim],
    claimSummary: summary,
    provider: 'gemini',
    model: 'example-model',
  });

  assert.equal(outcome.status, 'corrected');
  assert.equal(outcome.claims.length, 1);
  assert.equal(outcome.claimSummary.contradictedClaims, 1);
  assert.equal(outcome.sources.length, 1);
});

test('claim verification prompt treats retrieved source instructions as untrusted', () => {
  const prompt = CLAIM_VERIFICATION_PROMPT(
    'What is the symbol for gold?',
    'Gold uses Au.',
    extractedClaim()
  );

  assert.match(prompt, /untrusted evidence/i);
  assert.match(prompt, /ignore instructions/i);
  assert.match(prompt, /verify only this atomic claim/i);
});

test('evaluation scoring compares content, status, claims, and citations', () => {
  const testCase = EVALUATION_DATASET.find(
    (item) => item.id === 'stable-gold-symbol'
  );
  assert.ok(testCase);

  const claim = buildVerifiedClaim(
    extractedClaim(),
    {
      status: 'SUPPORTED',
      rationale: 'Supported by an authoritative chemistry source.',
      corrected_claim: '',
    },
    [source('https://chemistry.example/gold')]
  );
  const summary = summarizeClaimVerification([claim]);
  const outcome = buildStandardOutcome({
    answer: 'The chemical symbol for gold is Au.',
    consensusReached: true,
    validatorRan: true,
    verificationStatus: 'CONFIRMED',
    isConclusive: true,
    roundsExecuted: 1,
    claims: [claim],
    claimSummary: summary,
    provider: 'gemini',
    model: 'example-model',
  });
  const observation = {
    caseId: testCase.id,
    mode: 'verified',
    outcome,
    latencyMs: 1200,
    requestCount: 6,
    estimatedCostUsd: 0.01,
  };
  const score = scoreEvaluationObservation(testCase, observation);
  const aggregate = summarizeEvaluationScores([score], [observation]);

  assert.equal(score.passed, true);
  assert.equal(score.score, 100);
  assert.equal(aggregate.passRate, 100);
  assert.equal(aggregate.claimSupportRate, 100);
  assert.equal(aggregate.citationCoverage, 100);
  assert.equal(aggregate.byMode.verified.runs, 1);
});
