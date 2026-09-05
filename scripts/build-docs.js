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

function assetVersion(relativePath, rootDir = ROOT) {
  return crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(rootDir, relativePath)))
    .digest('hex')
    .slice(0, 12);
}

function renderPage(page, routeMap, docsCssVersion = assetVersion('assets/docs.css')) {
  const { meta } = page;
  const canonical = `https://cleanlocaltools.com${meta.route}`;
  const robots = meta.index === true
    ? 'index,follow,max-image-preview:large,max-snippet:-1'
    : 'noindex,follow,noarchive';
  const content = renderMarkdown(page.body, page.source, routeMap);
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: meta.title,
    description: meta.description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Clean Local Tools', url: 'https://cleanlocaltools.com/' }
  }).replace(/</g, '\\u003c');
  const technicalNote = meta.index === false
    ? '<aside class="doc-status"><strong>Technical documentation</strong><span>This page records architecture and experimental direction. It is not a user-facing tool.</span></aside>'
    : '';
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
<link rel="stylesheet" href="/assets/docs.css?v=${docsCssVersion}">
</head>
<body class="docs-page ${meta.index === true ? 'docs-public' : 'docs-technical'}">
<header class="doc-topbar"><div class="wrap"><div class="doc-brand"><a href="/">Clean Local Tools</a></div><nav aria-label="Primary"><a href="/#all-tools">All tools</a><a href="/about/">About</a></nav></div></header>
<main class="doc-main"><div class="wrap"><article class="doc-article"><div class="doc-kicker">${escapeHtml(meta.section)}</div>${technicalNote}<div class="doc-content">${content}</div><nav class="doc-related" aria-label="Related pages"><a href="/">Home</a><a href="/about/">Mission &amp; vision</a><a href="/principles/">Principles</a></nav></article></div></main>
<footer class="doc-footer"><div class="wrap"><span>© 2026 Clean Local Tools · Your files never leave your machine.</span><a href="/about/">About</a></div></footer>
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
  const docsCssVersion = assetVersion('assets/docs.css', rootDir);
  const outputs = new Map(pages.map(page => [page.output, renderPage(page, routeMap, docsCssVersion)]));
  const sitemapPath = path.join(rootDir, 'sitemap.xml');
  outputs.set('sitemap.xml', renderSitemap(fs.readFileSync(sitemapPath, 'utf8'), pages));
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

module.exports = { escapeHtml, parseFrontMatter, collectPages, rewriteLink, renderInline, renderMarkdown, assetVersion, renderPage, renderSitemap, build, writeBuild, checkBuild };
