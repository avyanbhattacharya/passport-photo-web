const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const privacy = 'Your files never leave your machine.';
const pages = [
  ['/', 'index.html', 'https://cleanlocaltools.com/'],
  ['/passport-photo/', 'passport-photo/index.html', 'https://cleanlocaltools.com/passport-photo/'],
  ['/japa-counter/', 'japa-counter/index.html', 'https://cleanlocaltools.com/japa-counter/'],
  ['/japa-counter/tap.html', 'japa-counter/tap.html', 'https://cleanlocaltools.com/japa-counter/tap.html'],
  ['/compress-pdf/', 'compress-pdf/index.html', 'https://cleanlocaltools.com/compress-pdf/'],
  ['/merge-pdf/', 'merge-pdf/index.html', 'https://cleanlocaltools.com/merge-pdf/'],
  ['/resize-image/', 'resize-image/index.html', 'https://cleanlocaltools.com/resize-image/'],
  ['/clean-pdf-printer/', 'clean-pdf-printer/index.html', 'https://cleanlocaltools.com/clean-pdf-printer/'],
  ['/document-flattener/', 'document-flattener/index.html', 'https://cleanlocaltools.com/document-flattener/'],
  ['/image-to-pdf/', 'image-to-pdf/index.html', 'https://cleanlocaltools.com/image-to-pdf/'],
  ['/split-pdf/', 'split-pdf/index.html', 'https://cleanlocaltools.com/split-pdf/'],
  ['/heic-to-jpg/', 'heic-to-jpg/index.html', 'https://cleanlocaltools.com/heic-to-jpg/'],
  ['/remove-photo-metadata/', 'remove-photo-metadata/index.html', 'https://cleanlocaltools.com/remove-photo-metadata/'],
  ['/qr-code-maker/', 'qr-code-maker/index.html', 'https://cleanlocaltools.com/qr-code-maker/']
];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function appSourceFor(htmlPath) {
  const appPath = path.join(path.dirname(htmlPath), 'app.js');
  const absolute = path.join(root, appPath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
}

test('all public pages have canonical, indexable, privacy-aware metadata', () => {
  for (const [route, htmlPath, canonical] of pages) {
    const html = read(htmlPath);
    const runtime = appSourceFor(htmlPath);
    const searchable = `${html}\n${runtime}`;

    assert.match(html, new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i'), `${route} canonical`);
    assert.doesNotMatch(html, /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i, `${route} must remain indexable`);
    assert.ok(searchable.includes(privacy), `${route} privacy tagline`);
    assert.match(searchable, /meta[^\n]{0,300}description[^\n]{0,500}Your files never leave your machine/i, `${route} search description privacy copy`);
  }
});

test('sitemap contains every public canonical URL', () => {
  const sitemap = read('sitemap.xml');
  for (const [, , canonical] of pages) {
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), `${canonical} missing from sitemap`);
  }
});

test('homepage links to every public tool route', () => {
  const homepage = read('index.html');
  for (const [route] of pages.slice(1)) {
    assert.ok(homepage.includes(`href="${route}"`) || homepage.includes(`href='${route}'`), `${route} missing from homepage`);
  }
});

test('browser tests avoid fixed sleeps and runaway per-assertion timeouts', () => {
  const testsDir = path.join(root, 'tests');
  const specs = fs.readdirSync(testsDir).filter(name => name.endsWith('.spec.js'));
  for (const spec of specs) {
    const source = fs.readFileSync(path.join(testsDir, spec), 'utf8');
    assert.doesNotMatch(source, /waitForTimeout\s*\(/, `${spec} contains a fixed sleep`);
    for (const match of source.matchAll(/timeout\s*:\s*(\d+)/g)) {
      assert.ok(Number(match[1]) <= 30000, `${spec} contains timeout ${match[1]}ms`);
    }
  }
});

test('every tool family keeps a dedicated deep browser spec', () => {
  const expected = [
    'passport-photo.spec.js', 'japa-touchless.spec.js', 'japa-tap.spec.js',
    'compress-pdf.spec.js', 'merge-pdf.spec.js', 'resize-image.spec.js',
    'clean-pdf-printer.spec.js', 'document-flattener.spec.js', 'image-to-pdf.spec.js',
    'split-pdf.spec.js', 'heic-to-jpg.spec.js', 'remove-photo-metadata.spec.js',
    'qr-code-maker.spec.js'
  ];
  for (const spec of expected) assert.ok(fs.existsSync(path.join(root, 'tests', spec)), `${spec} missing`);
});
