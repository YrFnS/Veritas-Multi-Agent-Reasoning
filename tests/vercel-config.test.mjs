import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const config = JSON.parse(
  await readFile(new URL('../vercel.json', import.meta.url), 'utf8')
);

test('Vercel serves direct SPA routes with baseline security headers', () => {
  assert.equal(config.framework, 'vite');
  assert.deepEqual(config.rewrites, [
    { source: '/(.*)', destination: '/index.html' },
  ]);

  const headers = Object.fromEntries(
    config.headers[0].headers.map(({ key, value }) => [key, value])
  );
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.equal(
    headers['Permissions-Policy'],
    'camera=(), geolocation=(), payment=(), usb=()'
  );
});
