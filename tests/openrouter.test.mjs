import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OPENROUTER_CHAT_COMPLETIONS_URL,
  OpenRouterCore,
} from '../.test-dist/features/reasoning/services/openRouterCore.js';
import {
  OPENROUTER_MODELS_URL,
  fetchOpenRouterModels,
  isFreeOpenRouterModel,
  parseOpenRouterModelCatalog,
  requireOpenRouterModelId,
  searchOpenRouterModels,
} from '../.test-dist/features/reasoning/services/openRouterModels.js';
import {
  readProviderKeys,
  redactProviderSecrets,
  resolveProviderApiKey,
  writeProviderKey,
} from '../.test-dist/features/reasoning/services/providerKeys.js';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('OpenRouter model catalog parsing supports search, free filtering, and manual selection', async () => {
  const payload = {
    data: [
      {
        id: 'vendor/alpha',
        name: 'Alpha Reasoner',
        description: 'Focused analysis',
        context_length: 131072,
        pricing: { prompt: '0', completion: '0' },
      },
      {
        id: 'vendor/beta',
        name: 'Beta Writer',
        context_length: 32768,
        pricing: { prompt: '0.000001', completion: '0.000002' },
      },
      { name: 'Missing ID' },
    ],
  };
  const models = parseOpenRouterModelCatalog(payload);

  assert.equal(models.length, 2);
  assert.equal(models[0].contextLength, 131072);
  assert.equal(isFreeOpenRouterModel(models[0]), true);
  assert.deepEqual(
    searchOpenRouterModels(models, 'focused', false).map((model) => model.id),
    ['vendor/alpha']
  );
  assert.deepEqual(
    searchOpenRouterModels(models, '', true).map((model) => model.id),
    ['vendor/alpha']
  );
  assert.equal(requireOpenRouterModelId('manual/provider-model'), 'manual/provider-model');
  assert.throws(() => requireOpenRouterModelId('  '), /Select an OpenRouter model/);
  assert.throws(() => parseOpenRouterModelCatalog({ data: 'bad' }), /malformed/);

  let capturedUrl = '';
  let capturedInit;
  const fetched = await fetchOpenRouterModels({
    forceRefresh: true,
    fetcher: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  assert.equal(capturedUrl, OPENROUTER_MODELS_URL);
  assert.equal(capturedInit.method, 'GET');
  assert.equal(capturedInit.cache, 'reload');
  assert.equal(fetched.length, 2);
  await assert.rejects(
    fetchOpenRouterModels({
      fetcher: async () => {
        throw new Error('offline');
      },
    }),
    /Enter a model ID manually/
  );
});

test('browser-local provider storage never falls back and secret text is redacted', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const placeholder = 'not-a-real-credential';

  writeProviderKey('openrouter', placeholder, storage);
  assert.equal(resolveProviderApiKey('openrouter', storage), placeholder);
  assert.throws(() => resolveProviderApiKey('gemini', storage), /GEMINI/);
  assert.equal(
    redactProviderSecrets(`Server echoed ${placeholder}`, [placeholder]),
    'Server echoed [REDACTED]'
  );
  assert.equal(
    redactProviderSecrets('Token sk-or-v1-abcdefghijklmnop was rejected'),
    'Token [REDACTED] was rejected'
  );

  writeProviderKey('openrouter', '', storage);
  assert.deepEqual(readProviderKeys(storage), {});
  storage.setItem('veritas_api_keys', '{bad json');
  assert.deepEqual(readProviderKeys(storage), {});
});

test('OpenRouter request uses only the selected model and Authorization bearer header', async () => {
  const placeholder = 'not-a-real-credential';
  let capturedUrl = '';
  let capturedInit;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const core = new OpenRouterCore(placeholder);
  const result = await core.generateJSON(
    'vendor/user-selected-model',
    'System prompt',
    'User prompt',
    {
      type: 'object',
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
    }
  );

  const headers = new Headers(capturedInit.headers);
  const body = JSON.parse(capturedInit.body);
  assert.equal(capturedUrl, OPENROUTER_CHAT_COMPLETIONS_URL);
  assert.equal(capturedInit.method, 'POST');
  assert.equal(headers.get('authorization'), `Bearer ${placeholder}`);
  assert.equal(body.model, 'vendor/user-selected-model');
  assert.equal(body.messages[0].content, 'System prompt');
  assert.equal(body.messages[1].content, 'User prompt');
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(capturedUrl.includes(placeholder), false);
  assert.equal(capturedInit.body.includes(placeholder), false);
  assert.deepEqual(result.data, { ok: true });
});

test('OpenRouter malformed responses and server errors fail safely without key disclosure', async () => {
  const placeholder = 'not-a-real-credential';
  const core = new OpenRouterCore(placeholder);

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: 42 } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  await assert.rejects(
    core.generateJSON('vendor/model', 'System', 'Prompt', { type: 'object' }),
    /malformed completion/
  );

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ error: { message: `Request rejected for ${placeholder}` } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  await assert.rejects(
    core.generateJSON('vendor/model', 'System', 'Prompt', { type: 'object' }),
    (error) => {
      assert.match(error.message, /\[REDACTED\]/);
      assert.equal(error.message.includes(placeholder), false);
      return true;
    }
  );
});
