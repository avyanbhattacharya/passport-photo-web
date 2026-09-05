'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const limit = 2 * 1024 * 1024;
  const allowed = new Set('article section main header footer nav aside div p span h1 h2 h3 h4 h5 h6 strong em b i u s small sub sup blockquote pre code ul ol li dl dt dd table caption thead tbody tfoot tr th td figure figcaption br hr img'.split(' '));
  const dropped = new Set('script style link meta base title iframe frame frameset object embed svg math template noscript form input button textarea select option video audio source track canvas head'.split(' '));
  let history = [], cursor = 0, original = '', selected = null, ready = false, generation = 0;
  const frame = $('preview');
  // Parse only in an inert template. Never attach imported nodes or attributes.
  // WebKit requires sandbox allow-scripts for parent-installed event callbacks.
  // CSP still forbids script resources/inline markup; reconstruction is the primary boundary.
  function sanitize(source) {
    const template = document.createElement('template');
    template.innerHTML = source;
    const output = document.createElement('div');
    let count = 0;
    function copy(node, target, depth) {
      if (++count > 15000 || depth > 100) throw new Error('This document is too complex. Try a smaller section.');
      if (node.nodeType === Node.TEXT_NODE) { target.append(document.createTextNode(node.textContent)); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.localName;
      if (dropped.has(tag) || node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return;
      if (tag === 'img') {
        const src = node.getAttribute('src') || '';
        if (!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src)) return;
        const img = document.createElement('img'); img.src = src; img.alt = node.getAttribute('alt') || 'Image'; target.append(img); return;
      }
      const next = allowed.has(tag) ? document.createElement(tag) : target;
      if (next !== target) {
        for (const attr of ['colspan', 'rowspan']) {
          const value = Number(node.getAttribute(attr));
          if (['td', 'th'].includes(tag) && Number.isInteger(value) && value > 0 && value <= 100) next.setAttribute(attr, value);
        }
        target.append(next);
      }
      for (const child of node.childNodes) copy(child, next, depth + 1);
    }
    for (const child of template.content.childNodes) copy(child, output, 0);
    if (!output.textContent.trim() && !output.querySelector('img')) throw new Error('No printable content found. Choose an HTML file containing text or embedded images.');
    return output.innerHTML;
  }
  function styles() {
    return `@page{size:${$('paper').value} ${$('orientation').value};margin:${$('margin').value}mm}*{box-sizing:border-box}body{margin:0;padding:20px;font-family:Arial,sans-serif;font-size:${$('fontSize').value}pt;line-height:1.5;color:#202124;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #ccc;padding:6px}pre{white-space:pre-wrap}h1,h2,h3{line-height:1.2;break-after:avoid}img,tr{break-inside:avoid}p{orphans:3;widows:3}[data-selected]{outline:2px solid #1a73e8;background:#e8f0fe}*:focus-visible{outline:2px dashed #1a73e8}@media print{body{padding:0} [data-selected],*:focus{outline:none!important;background:transparent!important}}`;
  }
  function controls() {
    $('undo').disabled = !ready || cursor === 0;
    $('redo').disabled = !ready || cursor === history.length - 1;
    $('remove').disabled = !ready || !selected;
    $('parent').disabled = !ready || !selected || selected.parentElement === frame.contentDocument.body;
    for (const id of ['images', 'print', 'reset']) $(id).disabled = !ready;
  }
  function select(element) {
    if (selected) selected.removeAttribute('data-selected');
    selected = element;
    if (selected) selected.setAttribute('data-selected', '');
    $('selection').textContent = selected ? `Selected: ${selected.tagName.toLowerCase()} — ${(selected.textContent.trim() || selected.getAttribute('alt') || 'element').slice(0, 80)}` : 'Nothing selected';
    controls();
  }
  function render() {
    ready = false; selected = null; controls(); $('selection').textContent = 'Nothing selected';
    frame.onload = () => {
      const doc = frame.contentDocument;
      if (!doc.body || !doc.querySelector('#printStyles')) return;
      for (const el of doc.body.querySelectorAll('*')) {
        el.tabIndex = 0;
        el.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); select(el); });
        el.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); select(el); }
        });
      }
      ready = true; controls();
    };
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><title>Clean HTML print copy</title><style id="printStyles">${styles()}</style></head><body>${history[cursor]}</body></html>`;
  }
  function edit(action) {
    if (!ready) return;
    select(null); action();
    const clone = frame.contentDocument.body.cloneNode(true);
    for (const el of clone.querySelectorAll('[tabindex]')) el.removeAttribute('tabindex');
    const html = clone.innerHTML;
    if (html === history[cursor]) return;
    history = history.slice(0, cursor + 1); history.push(html);
    if (history.length > 20) history.shift();
    cursor = history.length - 1; render(); $('status').textContent = 'Content removed. The remaining document reflows automatically. Undo keeps up to 19 recent changes.';
  }
  function open(source, name) {
    if (new Blob([source]).size > limit) throw new Error('Choose HTML smaller than 2 MB.');
    const clean = sanitize(source);
    original = clean; history = [clean]; cursor = 0;
    $('fileName').textContent = name; $('editor').hidden = false;
    $('error').textContent = ''; $('status').textContent = 'Clean reading layout ready. Select content to begin.'; render();
  }
  $('htmlFile').addEventListener('change', async event => {
    const token = ++generation, file = event.target.files[0]; if (!file) return;
    try {
      if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') throw new Error('Please choose an HTML (.html or .htm) file.');
      if (file.size > limit) throw new Error('Choose HTML smaller than 2 MB.');
      const text = await file.text(); if (token !== generation) return; open(text, file.name);
    } catch (error) { if (token === generation) $('error').textContent = error.message; }
    event.target.value = '';
  });
  $('openPaste').onclick = () => { ++generation; try { open($('source').value, 'Pasted HTML'); } catch (error) { $('error').textContent = error.message; } };
  $('remove').onclick = () => { const target = selected; if (target) edit(() => target.remove()); };
  $('parent').onclick = () => { if (selected && selected.parentElement !== frame.contentDocument.body) select(selected.parentElement); };
  $('images').onclick = () => edit(() => frame.contentDocument.querySelectorAll('img').forEach(img => img.remove()));
  $('undo').onclick = () => { if (ready && cursor > 0) { cursor--; render(); } };
  $('redo').onclick = () => { if (ready && cursor < history.length - 1) { cursor++; render(); } };
  $('reset').onclick = () => { history = [original]; cursor = 0; render(); $('status').textContent = 'All edits reset.'; };
  for (const id of ['paper', 'orientation', 'margin', 'fontSize']) $(id).onchange = () => { if (ready) frame.contentDocument.querySelector('#printStyles').textContent = styles(); };
  $('print').onclick = () => {
    if (!ready) return;
    const doc = frame.contentDocument;
    if (!doc.body.textContent.trim() && !doc.querySelector('img')) { $('status').textContent = 'Keep some content before printing. Undo a removal or reset edits.'; return; }
    select(null);
    try { frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch { $('status').textContent = 'Printing is unavailable in this browser. Try a desktop browser.'; }
  };
})();
