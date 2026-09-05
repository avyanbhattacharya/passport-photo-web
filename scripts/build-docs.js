#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const posix = path.posix;

const ROOT = path.resolve(__dirname, '..');
const DOCS_ROOT = path.join(ROOT, 'docs');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const GENERATED_START = '  <!-- generated-docs:start -->';
const GENERATED_END = '  <!-- generated-docs:end -->';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseFrontMatter(source, relativePath) {
  const normalized = source.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return { meta: {}, body: normalized };
  const end = normalized.indexOf('\n---\n', 4);
  if (end < 0) throw new Error(`${relativePath}: front matter is not closed`);
  const meta = {};
  for (const line of normalized.slice(4, end).split('\n')) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (!match) throw new Error(`${relativePath}: invalid front matter line: ${line}`);
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value === 'true') value = true;
    if (value === 'false') value = false;
    meta[match[1]] = value;
  }
  return { meta, body: normalized.slice(end + 5) };
}

function findMarkdownFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...findMarkdownFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(absolute);
  }
  return files.sort();
}

function validatePage(page, routes) {
  const { meta, source } = page;
  for (const field of ['title', 'description', 'route', 'section']) {
    if (!meta[field] || typeof meta[field] !== 'string') throw new Error(`${source}: missing ${field} front matter`);
  }
  if (!/^\/[a-z0-9/-]*\/$/.test(meta.route)) throw new Error(`${source}: route must start and end with /`);
  if (meta.route.includes('//') || meta.route.includes('..')) throw new Error(`${source}: unsafe route`);
  const layout = meta.layout || 'document';
  if (!['document', 'brand'].includes(layout)) throw new Error(`${source}: unsupported layout ${layout}`);
  if (layout === 'brand') {
    if (meta.index !== true) throw new Error(`${source}: brand pages must be public/indexable`);
    if (!['mission', 'principles'].includes(meta.variant)) throw new Error(`${source}: unsupported brand variant ${meta.variant}`);
    for (const field of ['headline', 'heroCopy']) {
      if (!meta[field] || typeof meta[field] !== 'string') throw new Error(`${source}: brand layout requires ${field}`);
    }
  }
  if (routes.has(meta.route)) throw new Error(`${source}: duplicate route ${meta.route}`);
  routes.add(meta.route);
}

function collectPages(rootDir = ROOT) {
  const docsRoot = path.join(rootDir, 'docs');
  const pages = [];
  const routes = new Set();
  for (const absolute of findMarkdownFiles(docsRoot)) {
    const source = posix.normalize(path.relative(rootDir, absolute).split(path.sep).join('/'));
    const parsed = parseFrontMatter(fs.readFileSync(absolute, 'utf8'), source);
    if (parsed.meta.render !== true) continue;
    const page = { ...parsed, source };
    validatePage(page, routes);
    const relativeOutput = page.meta.route === '/'
      ? 'index.html'
      : posix.join(page.meta.route.slice(1), 'index.html');
    page.output = relativeOutput;
    pages.push(page);
  }
  return pages.sort((a, b) => a.meta.route.localeCompare(b.meta.route));
}

function rewriteLink(url, currentSource, routeMap) {
  if (/^(?:[a-z]+:|#|\/)/i.test(url)) return url;
  const [pathname, fragment] = url.split('#', 2);
  if (!pathname.endsWith('.md')) return url;
  const resolved = posix.normalize(posix.join(posix.dirname(currentSource), pathname));
  const route = routeMap.get(resolved);
  if (!route) return url;
  return fragment ? `${route}#${fragment}` : route;
}

function renderInline(value, currentSource, routeMap) {
  const tokens = [];
  const token = html => {
    const marker = `DOCSTOKEN${tokens.length}END`;
    tokens.push(html);
    return marker;
  };
  let text = String(value);
  text = text.replace(/`([^`]+)`/g, (_, code) => token(`<code>${escapeHtml(code)}</code>`));
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, destination) => {
    const href = rewriteLink(destination.trim(), currentSource, routeMap);
    return token(`<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`);
  });
  text = escapeHtml(text);
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(^|\s)\*([^*]+)\*(?=\s|[.,;:!?]|$)/g, '$1<em>$2</em>');
  text = text.replace(/DOCSTOKEN(\d+)END/g, (_, index) => tokens[Number(index)]);
  return text;
}

function isBlockStart(line) {
  return /^(?:#{1,6}\s+|```|>\s?|\s*[-*+]\s+|\s*\d+\.\s+|\s*(?:---+|\*\*\*+)\s*$)/.test(line);
}

function headingId(value, usedIds) {
  const base = value
    .replace(/[`*_\[\]()]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) id = `${base}-${suffix++}`;
  usedIds.add(id);
  return id;
}

function renderMarkdown(markdown, currentSource, routeMap) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const output = [];
  const usedIds = new Set();
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^```\s*([a-zA-Z0-9_-]*)\s*$/);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) code.push(lines[index++]);
      if (index >= lines.length) throw new Error(`${currentSource}: unclosed code fence`);
      index += 1;
      const language = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : '';
      output.push(`<pre><code${language}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const id = headingId(heading[2], usedIds);
      output.push(`<h${level} id="${id}">${renderInline(heading[2], currentSource, routeMap)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ''));
      output.push(`<blockquote><p>${renderInline(quote.join(' '), currentSource, routeMap)}</p></blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (unordered) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!match) break;
        items.push(`<li>${renderInline(match[1], currentSource, routeMap)}</li>`);
        index += 1;
      }
      output.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(/^\s*\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(`<li>${renderInline(match[1], currentSource, routeMap)}</li>`);
        index += 1;
      }
      output.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
      output.push('<hr>');
      index += 1;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(' '), currentSource, routeMap)}</p>`);
  }
  return output.join('\n');
}

function splitDocument(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const usedIds = new Set();
  const preamble = [];
  const sections = [];
  let title = '';
  let current = null;
  let foundTitle = false;
  let inFence = false;

  for (const line of lines) {
    if (/^```/.test(line)) inFence = !inFence;
    if (!inFence && !foundTitle) {
      const titleMatch = line.match(/^#\s+(.+)$/);
      if (titleMatch) {
        title = titleMatch[1].trim();
        foundTitle = true;
        continue;
      }
      if (line.trim()) throw new Error('brand document must begin with an H1');
      continue;
    }
    if (!inFence) {
      const sectionMatch = line.match(/^##\s+(.+)$/);
      if (sectionMatch) {
        current = { title: sectionMatch[1].trim(), id: headingId(sectionMatch[1], usedIds), lines: [] };
        sections.push(current);
        continue;
      }
    }
    (current ? current.lines : preamble).push(line);
  }

  if (!foundTitle) throw new Error('brand document must contain an H1');
  return {
    title,
    preamble: preamble.join('\n').trim(),
    sections: sections.map(section => ({ ...section, body: section.lines.join('\n').trim() }))
  };
}

function renderBrandVisual(variant) {
  if (variant === 'principles') {
    return `<div class="brand-visual" role="img" aria-label="A promise supported by architecture and tests">
      <div class="brand-visual-label">HOW TRUST IS EARNED</div>
      <div class="brand-proof">
        <div class="brand-proof-step"><span>01</span><div><strong>Promise</strong><small>Say clearly what happens to the file.</small></div></div>
        <div class="brand-proof-step"><span>02</span><div><strong>Architecture</strong><small>Keep processing on the user&#39;s device.</small></div></div>
        <div class="brand-proof-step"><span>03</span><div><strong>Tests</strong><small>Prove the important behavior stays true.</small></div></div>
      </div>
      <p class="brand-visual-note">Privacy is a product constraint, not a footer claim.</p>
    </div>`;
  }
  return `<div class="brand-visual" role="img" aria-label="Your file is processed on your device">
    <div class="brand-visual-label">YOUR FILE STAYS HERE</div>
    <div class="brand-file-flow">
      <div class="brand-flow-step"><span class="brand-flow-index">1</span><span>Choose your file</span></div>
      <span class="brand-flow-arrow">→</span>
      <div class="brand-flow-step is-local"><span class="brand-flow-index">2</span><strong>Work happens here</strong></div>
    </div>
    <p class="brand-visual-note">Nothing is uploaded for processing.</p>
  </div>`;
}

function renderBrandHero(page, document) {
  const secondaryHref = page.meta.variant === 'principles' ? '/about/' : '/principles/';
  const secondaryLabel = page.meta.variant === 'principles' ? 'Read our mission →' : 'Read our principles →';
  return `<section class="brand-hero"><div class="wrap brand-hero-grid"><div class="brand-hero-copy"><span class="eyebrow">${escapeHtml(page.meta.section)}</span><h1>${escapeHtml(page.meta.headline)}</h1><div class="brand-deck"><p>${escapeHtml(page.meta.heroCopy)}</p></div><div class="brand-actions"><a class="button" href="/#all-tools">Browse tools</a><a class="text-link" href="${secondaryHref}">${secondaryLabel}</a></div></div>${renderBrandVisual(page.meta.variant)}</div></section>`;
}

function renderBrandValues() {
  return `<section class="brand-values" aria-label="Clean Local Tools values"><div class="wrap brand-values-grid"><div class="brand-value"><div class="brand-value-label">PRIVATE</div><strong>Your files stay with you.</strong><p>Working files are not uploaded for processing.</p></div><div class="brand-value"><div class="brand-value-label">LOCAL</div><strong>Work happens on your device.</strong><p>The browser does the job where the file already is.</p></div><div class="brand-value"><div class="brand-value-label">SIMPLE</div><strong>Nothing unnecessary.</strong><p>No account, upload queue, advertising, or hidden exchange.</p></div></div></section>`;
}

function renderComparison() {
  return `<div class="brand-comparison" role="group" aria-label="Remote upload workflow compared with local processing"><div class="brand-comparison-card"><strong>Typical online tool</strong><div class="brand-comparison-steps"><span>Choose file</span><span class="brand-comparison-arrow">→</span><span>Upload</span><span class="brand-comparison-arrow">→</span><span>Result</span></div><p>The file leaves your device before the work happens.</p></div><div class="brand-comparison-card is-local"><strong>Clean Local Tools</strong><div class="brand-comparison-steps"><span>Choose file</span><span class="brand-comparison-arrow">→</span><span>Work here</span><span class="brand-comparison-arrow">→</span><span>Result</span></div><p>The working file remains on your device.</p></div></div>`;
}

function renderStorySection(page, section, routeMap, number, alternate = false) {
  const extra = section.id === 'why-this-matters' ? renderComparison() : '';
  return `<section class="brand-story-section brand-section--${escapeHtml(section.id)}${alternate ? ' alt' : ''}"><div class="wrap brand-story-grid"><header class="brand-story-heading"><span class="brand-section-number">${String(number).padStart(2, '0')}</span><h2 id="${escapeHtml(section.id)}">${renderInline(section.title, page.source, routeMap)}</h2></header><div class="brand-story-copy">${renderMarkdown(section.body, page.source, routeMap)}${extra}</div></div></section>`;
}

function renderTrustSection(page, sections, routeMap) {
  const cards = sections.map((section, index) => `<article class="brand-trust-card"><div class="brand-trust-card-label"><span>${String(index + 4).padStart(2, '0')}</span><h2 id="${escapeHtml(section.id)}">${renderInline(section.title, page.source, routeMap)}</h2></div>${renderMarkdown(section.body, page.source, routeMap)}</article>`).join('');
  return `<section class="brand-story-section brand-trust-section alt"><div class="wrap"><header class="brand-group-heading"><span class="eyebrow">THE STANDARD</span><h2>Promises must be provable.</h2></header><div class="brand-trust-grid">${cards}</div></div></section>`;
}

function renderAboutClosing(page, section, routeMap) {
  return `<section class="brand-closing-section"><div class="wrap"><div class="brand-closing-panel"><div><span class="eyebrow">LONG-TERM SUCCESS</span><h2 id="${escapeHtml(section.id)}">${renderInline(section.title, page.source, routeMap)}</h2><div class="brand-closing-copy">${renderMarkdown(section.body, page.source, routeMap)}</div></div><a class="button" href="/#all-tools">Explore the tools</a></div></div></section>`;
}

function renderAboutBrandPage(page, document, routeMap) {
  const trustIds = new Set(['the-promise', 'offline-is-an-earned-property']);
  const trust = document.sections.filter(section => trustIds.has(section.id));
  const rendered = [];
  let trustRendered = false;
  let storyNumber = 1;
  for (const section of document.sections) {
    if (trustIds.has(section.id)) {
      if (!trustRendered) rendered.push(renderTrustSection(page, trust, routeMap));
      trustRendered = true;
      storyNumber += 1;
      continue;
    }
    if (section.id === 'success') {
      rendered.push(renderAboutClosing(page, section, routeMap));
      continue;
    }
    rendered.push(renderStorySection(page, section, routeMap, storyNumber, section.id === 'vision'));
    storyNumber += 1;
  }
  return `<main class="brand-main brand-about">${renderBrandHero(page, document)}${renderBrandValues()}${rendered.join('')}</main>`;
}

function parsePrincipleTitle(title) {
  const match = title.match(/^(\d+)\.\s+(.+)$/);
  return match ? { number: Number(match[1]), title: match[2] } : { number: null, title };
}

function renderPrinciplesBrandPage(page, document, routeMap) {
  const decision = document.sections.find(section => section.id === 'decision-filter-for-a-new-tool');
  const principles = document.sections.filter(section => section !== decision);
  const intro = document.preamble
    ? `<section class="principles-intro"><div class="wrap">${renderMarkdown(document.preamble, page.source, routeMap)}</div></section>`
    : '';
  const cards = principles.map(section => {
    const parsed = parsePrincipleTitle(section.title);
    const wide = section.body.length > 600 ? ' is-wide' : '';
    return `<article class="principle-card${wide}"><div class="principle-number">${String(parsed.number || '').padStart(2, '0')}</div><h2 id="${escapeHtml(section.id)}">${renderInline(parsed.title, page.source, routeMap)}</h2><div>${renderMarkdown(section.body, page.source, routeMap)}</div></article>`;
  }).join('');
  const decisionHtml = decision
    ? `<section class="decision-section"><div class="wrap decision-grid"><header class="decision-heading"><span class="eyebrow">BEFORE WE BUILD</span><h2 id="${escapeHtml(decision.id)}">${renderInline(decision.title, page.source, routeMap)}</h2></header><div class="decision-copy">${renderMarkdown(decision.body, page.source, routeMap)}</div></div></section>`
    : '';
  const closing = `<section class="brand-closing-section"><div class="wrap"><div class="brand-closing-panel"><div><span class="eyebrow">THE PROMISE</span><h2>Useful tools. No hidden tradeoff.</h2><div class="brand-closing-copy"><p>The principles exist to keep privacy, simplicity, and usefulness intact as the project grows.</p></div><nav class="brand-related" aria-label="Related pages"><a class="text-link" href="/about/">Read our mission →</a><a class="text-link" href="/">Return home →</a></nav></div><a class="button" href="/#all-tools">Explore the tools</a></div></div></section>`;
  return `<main class="brand-main brand-principles">${renderBrandHero(page, document)}${intro}<section class="principles-list"><div class="wrap"><header class="principles-list-head"><div><span class="eyebrow">OPERATING PRINCIPLES</span><h2>How we make decisions</h2></div><p>Each principle translates the privacy promise into a practical product or engineering constraint.</p></header><div class="principle-grid">${cards}</div></div></section>${decisionHtml}${closing}</main>`;
}

function renderBrandPage(page, routeMap) {
  const document = splitDocument(page.body);
  return page.meta.variant === 'principles'
    ? renderPrinciplesBrandPage(page, document, routeMap)
    : renderAboutBrandPage(page, document, routeMap);
}

function assetVersion(relativePath, rootDir = ROOT) {
  return crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(rootDir, relativePath)))
    .digest('hex')
    .slice(0, 12);
}

function renderHomepageSiteCss(current, siteCssVersion) {
  const link = `<link rel="stylesheet" href="/assets/site.css?v=${siteCssVersion}" data-generated-site-css>`;
  const pattern = /<link rel="stylesheet" href="\/assets\/site\.css\?v=[a-f0-9]+" data-generated-site-css>/;
  if (pattern.test(current)) return current.replace(pattern, link);
  return current.replace('<style>', `${link}\n<style>`);
}

function renderPage(page, routeMap, versions = {}) {
  const { meta } = page;
  const siteCssVersion = versions.siteCssVersion || assetVersion('assets/site.css');
  const docsCssVersion = versions.docsCssVersion || assetVersion('assets/docs.css');
  const canonical = `https://cleanlocaltools.com${meta.route}`;
  const robots = meta.index === true
    ? 'index,follow,max-image-preview:large,max-snippet:-1'
    : 'noindex,follow,noarchive';
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: meta.title,
    description: meta.description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Clean Local Tools', url: 'https://cleanlocaltools.com/' }
  }).replace(/</g, '\\u003c');
  const layout = meta.layout || 'document';
  const main = layout === 'brand'
    ? renderBrandPage(page, routeMap)
    : `<main class="doc-main"><div class="wrap"><article class="doc-article"><div class="doc-kicker">${escapeHtml(meta.section)}</div>${meta.index === false ? '<aside class="doc-status"><strong>Technical documentation</strong><span>This page records architecture and experimental direction. It is not a user-facing tool.</span></aside>' : ''}<div class="doc-content">${renderMarkdown(page.body, page.source, routeMap)}</div><nav class="doc-related" aria-label="Related pages"><a href="/">Home</a><a href="/about/">Mission &amp; vision</a><a href="/principles/">Principles</a></nav></article></div></main>`;
  const aboutCurrent = meta.route === '/about/' ? ' aria-current="page"' : '';
  const principlesCurrent = meta.route === '/principles/' ? ' aria-current="page"' : '';
  return `<!doctype html>
<!-- Generated from ${escapeHtml(page.source)} by scripts/build-docs.js. Do not edit directly. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff">
<meta name="description" content="${escapeHtml(meta.description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(meta.title)} | Clean Local Tools">
<meta property="og:description" content="${escapeHtml(meta.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="Clean Local Tools">
<title>${escapeHtml(meta.title)} | Clean Local Tools</title>
<script type="application/ld+json">${structuredData}</script>
<link rel="stylesheet" href="/assets/site.css?v=${siteCssVersion}">
<link rel="stylesheet" href="/assets/docs.css?v=${docsCssVersion}">
</head>
<body class="docs-page ${layout === 'brand' ? `docs-public brand-page brand-${escapeHtml(meta.variant)}` : 'docs-technical'}">
<header class="topbar"><div class="wrap"><div class="brand"><a href="/">Clean Local Tools</a></div><nav class="topnav" aria-label="Primary"><a class="toplink" href="/#all-tools">All tools</a><a class="toplink" href="/about/"${aboutCurrent}>About</a><a class="toplink" href="/principles/"${principlesCurrent}>Principles</a></nav></div></header>
${main}
<footer><div class="wrap site-footer-row"><span>© 2026 Clean Local Tools · Your files never leave your machine.</span><nav class="site-footer-nav" aria-label="Footer"><a class="toplink" href="/about/">About</a><a class="toplink" href="/principles/">Principles</a></nav></div></footer>
</body>
</html>
`;
}

function renderSitemap(current, pages) {
  const publicEntries = pages
    .filter(page => page.meta.index === true)
    .map(page => `  <url><loc>https://cleanlocaltools.com${page.meta.route}</loc></url>`)
    .join('\n');
  const generated = `${GENERATED_START}\n${publicEntries}\n${GENERATED_END}`;
  const pattern = /  <!-- generated-docs:start -->[\s\S]*?  <!-- generated-docs:end -->/;
  if (pattern.test(current)) return current.replace(pattern, generated);
  return current.replace(/\s*<\/urlset>\s*$/, `\n${generated}\n</urlset>\n`);
}

function build(rootDir = ROOT) {
  const pages = collectPages(rootDir);
  const routeMap = new Map(pages.map(page => [page.source, page.meta.route]));
  const siteCssVersion = assetVersion('assets/site.css', rootDir);
  const docsCssVersion = assetVersion('assets/docs.css', rootDir);
  const versions = { siteCssVersion, docsCssVersion };
  const outputs = new Map(pages.map(page => [page.output, renderPage(page, routeMap, versions)]));
  const sitemapPath = path.join(rootDir, 'sitemap.xml');
  outputs.set('sitemap.xml', renderSitemap(fs.readFileSync(sitemapPath, 'utf8'), pages));
  const homepagePath = path.join(rootDir, 'index.html');
  outputs.set('index.html', renderHomepageSiteCss(fs.readFileSync(homepagePath, 'utf8'), siteCssVersion));
  return { pages, outputs };
}

function writeBuild(rootDir = ROOT) {
  const result = build(rootDir);
  for (const [relative, content] of result.outputs) {
    const destination = path.join(rootDir, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
  }
  return result;
}

function checkBuild(rootDir = ROOT) {
  const result = build(rootDir);
  const stale = [];
  for (const [relative, expected] of result.outputs) {
    const destination = path.join(rootDir, relative);
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== expected) stale.push(relative);
  }
  if (stale.length) throw new Error(`Generated documentation is stale: ${stale.join(', ')}. Run npm run build:docs.`);
  return result;
}

if (require.main === module) {
  const mode = process.argv[2] || '--write';
  try {
    const result = mode === '--check' ? checkBuild() : mode === '--write' ? writeBuild() : null;
    if (!result) throw new Error(`Unknown mode: ${mode}`);
    process.stdout.write(`${mode === '--check' ? 'Verified' : 'Generated'} ${result.pages.length} documentation pages.\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { escapeHtml, parseFrontMatter, collectPages, rewriteLink, renderInline, renderMarkdown, splitDocument, assetVersion, renderHomepageSiteCss, renderBrandPage, renderPage, renderSitemap, build, writeBuild, checkBuild };
