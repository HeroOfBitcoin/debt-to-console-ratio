import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const health = JSON.parse(
  await readFile(new URL('../dist/healthz.json', import.meta.url), 'utf8'),
);

test('browser reads debt from the validated packaged snapshot', () => {
  assert.match(appSource, /data\/debt\.json/);
  assert.doesNotMatch(appSource, /api\.fiscaldata\.treasury\.gov/);
});

test('CSP permits only browser endpoints that the app actually uses', () => {
  assert.match(html, /connect-src 'self' https:\/\/api\.coingecko\.com/);
  assert.doesNotMatch(html, /api\.fiscaldata\.treasury\.gov/);
});

test('production build exposes a stable health descriptor', () => {
  assert.deepEqual(health, {
    ok: true,
    service: 'debt-to-console-ratio',
    schema_version: 1,
  });
});
