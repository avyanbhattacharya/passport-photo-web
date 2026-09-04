const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Cloudflare hardware preview opens the lab and stays out of search indexes', () => {
  const redirects = read('_redirects');
  const headers = read('_headers');
  assert.match(redirects, /^\/ \/labs\/local-ai\/ 302\s*$/m, 'preview root should redirect to the hardware lab');
  assert.match(headers, /X-Robots-Tag:\s*noindex, nofollow/i, 'preview responses should not be indexed');
  assert.match(headers, /Referrer-Policy:\s*no-referrer/i, 'preview should minimize referrer leakage');
  assert.match(headers, /\/labs\/local-ai\/\*[\s\S]*Cache-Control:\s*no-store/i, 'hardware lab should not be cached while iterating');
});
