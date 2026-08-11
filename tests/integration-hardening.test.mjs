import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGeminiThinkingConfig,
  GeminiCore,
  shouldOmitGeminiSampling,
} from '../.test-dist/features/reasoning/services/geminiCore.js';
import { tokenizeCode } from '../.test-dist/features/reasoning/services/codeHighlight.js';
import { parseAgentInspectionCommand } from '../.test-dist/features/reasoning/services/agentInspection.js';
import { readFinalSpeechTranscript } from '../.test-dist/features/reasoning/services/voiceTranscript.js';
import { validateAndNormalizeSystemConfig } from '../.test-dist/features/reasoning/validation/configValidation.js';

const agents = [
  {
    role: 'analyst',
    name: 'Fact Checker Prime',
    color: 'text-cyan',
    style: 'precise',
    task: 'analyze',
    icon: 'A',
  },
  {
    role: 'skeptic',
    name: 'مدقق-نهائي',
    color: 'text-red',
    style: 'critical',
    task: 'audit',
    icon: 'S',
  },
  {
    role: 'judge',
    name: 'Final Judge',
    color: 'text-gold',
    style: 'balanced',
    task: 'decide',
    icon: 'J',
  },
];

const baseConfig = {
  global_rules: 'Be accurate.',
  max_rounds: 3,
  provider: { type: 'gemini', model: 'gemini-3.6-flash' },
  agents,
};

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('agent inspection commands support configured names, roles, spaces, and Unicode', () => {
  const spaced = parseAgentInspectionCommand(
    '  @Fact Checker Prime : explain your evidence',
    agents
  );
  const unicode = parseAgentInspectionCommand(
    '@مدقق-نهائي: ما هي مهمتك؟',
    agents
  );
  const roleAlias = parseAgentInspectionCommand(
    '@judge: summarize the decision',
    agents
  );

  assert.equal(spaced?.targetAgent.name, 'Fact Checker Prime');
  assert.equal(spaced?.query, 'explain your evidence');
  assert.equal(unicode?.targetAgent.name, 'مدقق-نهائي');
  assert.equal(unicode?.query, 'ما هي مهمتك؟');
  assert.equal(roleAlias?.targetAgent.name, 'Final Judge');
  assert.equal(
    parseAgentInspectionCommand('@Fact Checker Prime:', agents),
    null
  );
});

test('speech transcript extraction ignores interim results and joins final segments once', () => {
  const transcript = readFinalSpeechTranscript({
    resultIndex: 0,
    results: [
      { isFinal: false, 0: { transcript: 'interim words' } },
      { isFinal: true, 0: { transcript: 'final words' } },
      { isFinal: true, 0: { transcript: ' only ' } },
    ],
  });

  assert.equal(transcript, 'final words only');
  assert.equal(
    readFinalSpeechTranscript({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'partial' } }],
    }),
    ''
  );
});

test('code tokenization preserves text without generating injectable markup', () => {
  const code =
    'const payload = {"html":"<img src=x onerror=alert(1)>"}; // untrusted';
  const tokens = tokenizeCode(code);

  assert.equal(
    tokens.map((token) => token.text).join(''),
    code
  );
  assert.ok(tokens.some((token) => token.kind === 'keyword'));
  assert.ok(tokens.some((token) => token.kind === 'jsonKey'));
  assert.ok(tokens.some((token) => token.kind === 'comment'));
  assert.equal(
    tokens.some((token) => token.text.includes('<span class=')),
    false
  );
});

test('configuration rejects fractional integer-only provider controls', () => {
  const result = validateAndNormalizeSystemConfig({
    ...baseConfig,
    agents: [
      { ...agents[0], topK: 2.5 },
      { ...agents[1], thinkingBudget: 1024.5 },
      agents[2],
    ],
  });

  assert.equal(result.success, false);
  assert.match(result.errors.join('\n'), /topK must be an integer/);
  assert.match(result.errors.join('\n'), /thinkingBudget must be an integer/);
});

test('Gemini thinking configuration follows the selected model family', () => {
  assert.deepEqual(buildGeminiThinkingConfig('gemini-2.5-flash', 2048), {
    thinkingBudget: 2048,
  });
  assert.deepEqual(buildGeminiThinkingConfig('models/gemini-3.6-flash', 0), {
    thinkingLevel: 'MINIMAL',
  });
  assert.deepEqual(
    buildGeminiThinkingConfig('gemini-3.1-pro-preview', 0),
    { thinkingLevel: 'LOW' }
  );
  assert.equal(buildGeminiThinkingConfig('gemini-1.5-pro', 2048), undefined);
  assert.equal(shouldOmitGeminiSampling('gemini-2.5-flash'), false);
  assert.equal(shouldOmitGeminiSampling('gemini-3.6-flash'), true);
  assert.equal(shouldOmitGeminiSampling('gemini-4-flash'), true);
});

test('Gemini 2.5 REST requests send thinkingBudget instead of thinkingLevel', async () => {
  let capturedBody;
  globalThis.fetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: { parts: [{ text: '{"ok":true}' }] },
          },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  const core = new GeminiCore('test-key');
  await core.generateJSON(
    'gemini-2.5-flash',
    'System',
    'Prompt',
    {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
      additionalProperties: false,
    },
    false,
    { thinkingBudget: 2048, temperature: 0.3, topK: 8 }
  );

  assert.deepEqual(capturedBody.generationConfig.thinkingConfig, {
    thinkingBudget: 2048,
  });
  assert.equal(
    capturedBody.generationConfig.thinkingConfig.thinkingLevel,
    undefined
  );
  assert.equal(capturedBody.generationConfig.temperature, 0.3);
  assert.equal(capturedBody.generationConfig.topK, 8);
});
