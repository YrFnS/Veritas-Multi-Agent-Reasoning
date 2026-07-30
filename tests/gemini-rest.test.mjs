import test from 'node:test';
import assert from 'node:assert/strict';

import { GeminiCore } from '../.test-dist/features/reasoning/services/geminiCore.js';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('Gemini REST transport sends structured output and search settings', async () => {
  let capturedUrl = '';
  let capturedInit;

  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: '{"answer":"Au"}' }],
            },
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://example.com/gold',
                    title: 'Gold reference',
                  },
                },
              ],
            },
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
  const result = await core.generateJSON(
    'gemini-3.6-flash',
    'Use evidence.',
    'What is the symbol for gold?',
    {
      type: 'object',
      properties: {
        answer: { type: 'string' },
      },
      required: ['answer'],
      additionalProperties: false,
    },
    true,
    { thinkingBudget: 0 }
  );

  assert.match(
    capturedUrl,
    /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.6-flash:generateContent$/
  );

  const headers = new Headers(capturedInit.headers);
  assert.equal(headers.get('x-goog-api-key'), 'test-key');
  assert.equal(headers.get('content-type'), 'application/json');

  const body = JSON.parse(capturedInit.body);
  assert.equal(body.systemInstruction.parts[0].text, 'Use evidence.');
  assert.equal(
    body.contents[0].parts[0].text,
    'What is the symbol for gold?'
  );
  assert.deepEqual(body.tools, [{ googleSearch: {} }]);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.generationConfig.responseJsonSchema.type, 'object');
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
  assert.equal(body.generationConfig.temperature, undefined);

  assert.deepEqual(result.data, { answer: 'Au' });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].web.title, 'Gold reference');
});

test('Gemini REST transport does not retry deterministic client errors', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify({ error: { message: 'Invalid API key.' } }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  const core = new GeminiCore('bad-key');
  await assert.rejects(
    core.generateJSON(
      'gemini-3.6-flash',
      'System',
      'Prompt',
      {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
      },
      false
    ),
    /Invalid API key/
  );

  assert.equal(calls, 1);
});

test('Gemini REST transport extracts generated speech audio', async () => {
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.generationConfig.responseModalities, ['AUDIO']);
    assert.equal(
      body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig
        .voiceName,
      'Kore'
    );

    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/pcm',
                    data: 'AAEC',
                  },
                },
              ],
            },
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
  assert.equal(await core.generateSpeech('Read this.'), 'AAEC');
});
