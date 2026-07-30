import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSystemConfig,
  validateAndNormalizeSystemConfig,
} from '../.test-dist/features/reasoning/validation/configValidation.js';
import {
  assertAnalystResponse,
  assertJudgeResponse,
  assertValidatorResponse,
} from '../.test-dist/features/reasoning/validation/responseValidation.js';
import { waitForRetry } from '../.test-dist/features/reasoning/services/abortUtils.js';
import { ANALYST_REVISION_PROMPT } from '../.test-dist/features/reasoning/services/prompts.js';
import {
  readProviderKeys,
  resolveProviderApiKey,
  writeProviderKey,
} from '../.test-dist/features/reasoning/services/providerKeys.js';
import { buildStandardOutcome } from '../.test-dist/features/reasoning/services/reasoningOutcome.js';
import {
  buildVerifiedClaim,
  summarizeClaimVerification,
} from '../.test-dist/features/reasoning/services/claimVerification.js';
import {
  createWebSource,
  dedupeSources,
} from '../.test-dist/features/reasoning/services/sourceUtils.js';
import { parseStrictJson } from '../.test-dist/features/reasoning/services/strictJson.js';

const baseAgents = [
  {
    role: 'analyst',
    name: 'A',
    color: 'text-cyan',
    style: 'a',
    task: 'a',
    icon: 'A',
  },
  {
    role: 'skeptic',
    name: 'S',
    color: 'text-red',
    style: 's',
    task: 's',
    icon: 'S',
  },
  {
    role: 'judge',
    name: 'J',
    color: 'text-gold',
    style: 'j',
    task: 'j',
    icon: 'J',
  },
];

const baseConfig = {
  global_rules: 'Be accurate.',
  max_rounds: 3,
  provider: { type: 'gemini', model: 'gemini-3.6-flash' },
  agents: baseAgents,
};

const trustedSource = {
  web: {
    uri: 'https://example.com/evidence',
    title: 'Evidence',
  },
};

const materialClaim = {
  id: 'C1',
  text: 'The answer contains a checkable factual claim.',
  importance: 'primary',
  verifiable: true,
};

test('standard config accepts an optional fourth validator agent', () => {
  const result = validateAndNormalizeSystemConfig({
    ...baseConfig,
    agents: [
      ...baseAgents,
      {
        role: 'validator',
        name: 'V',
        color: 'text-green',
        style: 'v',
        task: 'v',
        icon: 'V',
      },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.config?.agents.length, 4);
});

test('workflow config accepts variable agents and migrates a missing provider', () => {
  const config = parseSystemConfig({
    global_rules: 'Run the workflow.',
    max_rounds: 0,
    agents: baseAgents.slice(0, 2),
    workflow: [
      { id: 'one', name: 'ONE', agentName: 'a', instruction: 'Analyze.' },
      { id: 'two', name: 'TWO', agentName: 'S', instruction: 'Review.' },
    ],
  });

  assert.equal(config.agents.length, 2);
  assert.equal(config.provider.model, 'gemini-3.6-flash');
});

test('standard config rejects a missing judge', () => {
  const result = validateAndNormalizeSystemConfig({
    ...baseConfig,
    agents: baseAgents.slice(0, 2),
  });

  assert.equal(result.success, false);
  assert.match(result.errors.join('\n'), /role 'judge'/);
});

test('configuration rejects duplicate agent names and unknown workflow agents', () => {
  const duplicate = validateAndNormalizeSystemConfig({
    ...baseConfig,
    agents: [baseAgents[0], { ...baseAgents[1], name: 'a' }, baseAgents[2]],
  });
  const unknownWorkflowAgent = validateAndNormalizeSystemConfig({
    ...baseConfig,
    max_rounds: 0,
    workflow: [
      {
        id: 'one',
        name: 'ONE',
        agentName: 'missing',
        instruction: 'Run.',
      },
    ],
  });

  assert.equal(duplicate.success, false);
  assert.match(duplicate.errors.join('\n'), /unique/i);
  assert.equal(unknownWorkflowAgent.success, false);
  assert.match(unknownWorkflowAgent.errors.join('\n'), /unknown agent/i);
});

test('confirmed validation needs claim-linked external evidence to be verified', () => {
  const supportedClaim = buildVerifiedClaim(
    materialClaim,
    {
      status: 'SUPPORTED',
      rationale: 'The evidence supports the claim.',
      corrected_claim: '',
    },
    [trustedSource]
  );
  const claimSummary = summarizeClaimVerification([supportedClaim]);
  const verified = buildStandardOutcome({
    answer: 'Answer',
    consensusReached: true,
    validatorRan: true,
    verificationStatus: 'CONFIRMED',
    isConclusive: true,
    roundsExecuted: 1,
    claims: [supportedClaim],
    claimSummary,
    provider: 'gemini',
    model: 'gemini-3.6-flash',
  });
  const noClaimEvidence = buildStandardOutcome({
    answer: 'Answer',
    consensusReached: true,
    validatorRan: true,
    verificationStatus: 'CONFIRMED',
    isConclusive: true,
    roundsExecuted: 1,
    sources: [trustedSource],
    provider: 'gemini',
    model: 'gemini-3.6-flash',
  });

  assert.equal(verified.status, 'verified');
  assert.equal(verified.sources.length, 1);
  assert.equal(verified.claimSummary.citationCoverage, 100);
  assert.equal(noClaimEvidence.status, 'unverified');
  assert.match(noClaimEvidence.warnings.join('\n'), /downgraded/i);
});

test('claim-linked source-backed corrections are labeled corrected', () => {
  const correctedClaim = buildVerifiedClaim(
    materialClaim,
    {
      status: 'CONTRADICTED',
      rationale: 'The original claim was wrong.',
      corrected_claim: 'The corrected factual claim.',
    },
    [trustedSource]
  );
  const claimSummary = summarizeClaimVerification([correctedClaim]);
  const outcome = buildStandardOutcome({
    answer: 'Corrected answer',
    consensusReached: false,
    validatorRan: true,
    verificationStatus: 'CORRECTED',
    isConclusive: true,
    roundsExecuted: 3,
    claims: [correctedClaim],
    claimSummary,
    provider: 'gemini',
    model: 'gemini-3.6-flash',
  });

  assert.equal(outcome.status, 'corrected');
  assert.equal(outcome.claims[0].status, 'contradicted');
});

test('inconclusive evidence takes precedence over a verification label', () => {
  const outcome = buildStandardOutcome({
    answer: 'Evidence remains insufficient.',
    consensusReached: true,
    validatorRan: true,
    verificationStatus: 'CONFIRMED',
    isConclusive: false,
    roundsExecuted: 1,
    sources: [trustedSource],
    provider: 'gemini',
    model: 'gemini-3.6-flash',
  });

  assert.equal(outcome.status, 'insufficient_evidence');
});

test('unresolved objections produce a disputed result without source-backed validation', () => {
  const outcome = buildStandardOutcome({
    answer: 'Answer',
    consensusReached: false,
    validatorRan: false,
    verificationStatus: null,
    isConclusive: true,
    roundsExecuted: 3,
    provider: 'openrouter',
    model: 'example/model',
  });

  assert.equal(outcome.status, 'disputed');
});

test('provider keys never fall back across providers and can be forgotten', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  writeProviderKey('gemini', 'gemini-only', storage);
  assert.equal(resolveProviderApiKey('gemini', storage), 'gemini-only');
  assert.throws(
    () => resolveProviderApiKey('openrouter', storage),
    /OPENROUTER/
  );

  writeProviderKey('gemini', '', storage);
  assert.deepEqual(readProviderKeys(storage), {});
});

test('malformed model responses are rejected and validator can report unverified', () => {
  assert.throws(
    () => assertAnalystResponse({ factual_answer: 'x', confidence: 90 }),
    /evidence_summary/
  );
  assert.throws(
    () => assertJudgeResponse({ debate_summary: 'x', final_verdict: 'y' }),
    /is_conclusive/
  );

  const validator = assertValidatorResponse({
    verification_status: 'UNVERIFIED',
    reasoning: 'Evidence was insufficient.',
    final_output: 'Unable to verify.',
  });
  assert.equal(validator.verification_status, 'UNVERIFIED');
});

test('strict JSON parser accepts fenced JSON but rejects truncation', () => {
  assert.deepEqual(parseStrictJson('```json\n{"ok":true}\n```', 'Test'), {
    ok: true,
  });
  assert.throws(() => parseStrictJson('{"ok":', 'Test'), /rejected/);
});

test('source normalization rejects unsafe URLs and removes duplicates', () => {
  assert.equal(createWebSource('javascript:alert(1)', 'Unsafe'), null);
  const sources = dedupeSources([
    trustedSource,
    { web: { ...trustedSource.web } },
    { web: { uri: 'not-a-url', title: 'Invalid' } },
  ]);

  assert.equal(sources.length, 1);
  assert.match(sources[0].web.uri, /^https:/);
});

test('analyst revision prompt retains every material context field', () => {
  const prompt = ANALYST_REVISION_PROMPT(
    'original question',
    'current draft',
    'full history',
    'specific critique',
    'proposed correction'
  );

  for (const phrase of [
    'original question',
    'current draft',
    'full history',
    'specific critique',
    'proposed correction',
  ]) {
    assert.match(prompt, new RegExp(phrase));
  }
});

test('retry waits are abortable', async () => {
  const controller = new AbortController();
  const pending = waitForRetry(5_000, controller.signal);
  controller.abort();

  await assert.rejects(pending, /ABORT_SEQUENCE_RECEIVED/);
});
