'use strict';
// No proxy: this request goes directly from the user's browser to the chosen website.
(function (root) {
  function validate(raw) {
    let url;
    try { url = new URL(raw.trim()); } catch { throw new Error('Enter a full http:// or https:// URL.'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) URL without a username or password.');
    url.hash = '';
    return url;
  }
  async function load(raw, { signal, fetcher = fetch, limit = 2 * 1024 * 1024 } = {}) {
    const url = validate(raw);
    const response = await fetcher(url.href, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store', signal });
    if (!response.ok) throw new Error(`The website returned HTTP ${response.status}. Save the page as HTML or paste its HTML instead.`);
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (type !== 'text/html') { await response.body?.cancel(); throw new Error('This URL did not return HTML. Choose a webpage, or use a local HTML file.'); }
    if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new Error('This page exceeds the 2 MB limit. Save a smaller section as HTML.'); }
    if (!response.body) throw new Error('The website returned no readable content.');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let total = 0, html = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > limit) throw new Error('This page exceeds the 2 MB limit. Save a smaller section as HTML.');
        html += decoder.decode(value, { stream: true });
      }
      return { html: html + decoder.decode(), label: url.hostname };
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  const api = { validate, load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HTMLURLLoader = api;
})(globalThis);
