import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const csp = read('netlify.toml').match(/Content-Security-Policy = "([^"]+)"/)[1];
const directive = name => (csp.split(';').map(s => s.trim()).find(s => s.startsWith(name + ' ')) || '').split(/\s+/).slice(1);

test("script-src erlaubt nur /js/ – nicht 'self' und keine von Netlify eingefügten Skripte", () => {
  const src = directive('script-src');
  assert.ok(src.length, 'script-src fehlt');
  assert.ok(!src.includes("'self'"), "'self' würde /.netlify/scripts/… erlauben");
  for (const s of src) assert.match(s, /^https:\/\/[^/]+\/js\/$/, `unerwartete Quelle: ${s}`);
});

test('Alle Skripte der Seite liegen unter /js/', () => {
  const html = read('public/index.html');
  const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(srcs, ['js/main.js']);
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/, 'keine Inline-Skripte');
  assert.ok(readdirSync(new URL('../public/js/', import.meta.url)).includes('main.js'));
});

test('Service Worker ist über worker-src erlaubt', () => {
  assert.deepEqual(directive('worker-src'), ["'self'"]);
});
