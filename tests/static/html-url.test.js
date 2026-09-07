const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, load } = require('../../clean-html-printer/url-loader.js');
test('HTML URL validation excludes active schemes and embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'file:///tmp/a', 'https://user:pass@example.com/', 'not a url']) assert.throws(() => validate(url));
  assert.equal(validate('https://example.com/a#private').href, 'https://example.com/a');
});
test('HTML URL fetch omits credentials/referrer, refuses redirects and returns HTML', async () => {
  const result = await load('https://example.com/', { fetcher: async (url, options) => {
    assert.equal(url, 'https://example.com/');
    assert.equal(options.credentials, 'omit'); assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(options.redirect, 'error'); assert.equal(options.mode, 'cors');
    return new Response('<h1>Hello</h1>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } });
  assert.equal(result.html, '<h1>Hello</h1>');
});
test('HTML URL rejects status, MIME and streamed oversized bodies', async () => {
  await assert.rejects(load('https://example.com/', { fetcher: async () => new Response('', { status: 403 }) }), /HTTP 403/);
  await assert.rejects(load('https://example.com/', { fetcher: async () => new Response('{}', { headers: { 'content-type': 'application/json' } }) }), /did not return HTML/);
  await assert.rejects(load('https://example.com/', { limit: 8, fetcher: async () => new Response('<p>too long</p>', { headers: { 'content-type': 'text/html' } }) }), /2 MB/);
});
