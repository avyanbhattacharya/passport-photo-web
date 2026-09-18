const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('SheetLocal is a bounded, local-only guided CSV tool', () => {
  const page = read('src/pages/sheetlocal/index.astro');
  const app = read('sheetlocal/app.js');
  const style = read('src/styles/sheetlocal.css');
  const docs = read('docs/03-architecture/sheetlocal.md');
  const homepage = read('index.html');
  const sitemap = read('sitemap.xml');
  const sync = read('scripts/sync-astro-public.js');

  assert.match(page, /Understand a spreadsheet without uploading it\./);
  assert.match(page, /Your files never leave your machine\./);
  assert.match(page, /Nothing is uploaded for processing\./);
  assert.match(page, /accept="\.csv,\.tsv,text\/csv,text\/tab-separated-values"/);
  assert.match(page, /id="questionInput"/);
  assert.match(page, /id="downloadReport"/);
  assert.match(app, /MAX_BYTES = 5 \* 1024 \* 1024/);
  assert.match(app, /new Worker\(/);
  assert.match(app, /URL\.createObjectURL/);
  assert.match(app, /function interpretQuestion/);
  assert.match(app, /function topCategories/);
  assert.match(app, /function duplicateRows/);
  assert.doesNotMatch(app, /fetch\s*\(|XMLHttpRequest|WebLLM|transformers|https?:\/\//i);
  assert.match(style, /@media\(max-width:760px\)/);
  assert.match(docs, /no API request/);
  assert.match(docs, /no cloud fallback/);
  assert.match(homepage, /href="sheetlocal\/"/);
  assert.match(sitemap, /https:\/\/cleanlocaltools\.com\/sheetlocal\//);
  assert.match(sync, /'sheetlocal'/);
});
