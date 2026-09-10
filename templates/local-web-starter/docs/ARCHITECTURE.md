# Architecture

## Default stack

Runtime: static semantic HTML, CSS, plain browser JavaScript. Build/test: Node 24, built-in node:test, Playwright 1.62.1. Dependencies are development-only and locked. Hosting target: Cloudflare Pages static output. No framework or AI dependency is included just to make this a template.

public contains runtime sources only. scripts/build.cjs owns dist. docs contains trusted repository Markdown compiled into noindex HTML. tests contains cheap Node tests and real browser tests. site.config.json owns name, canonical production origin and production branch. The build refuses a placeholder production domain.

## Data path

Explicit input -> validate/bound -> browser-local processing -> verify result -> Blob/download or print -> release object URLs/resources. Original files remain unchanged. Use workers when processing becomes expensive; workers do not remove the need for watchdogs or resource limits.

The sample app makes no fetch requests and its production CSP disallows connections. Adding a URL-import feature requires a deliberate CSP/connect-src change and user-facing explanation; do not weaken this policy globally without reviewing the new boundary.

## HTML and CSS

Share a small site shell; let tools own their workflows. Keep keyboard labels, live status, visible focus, touch targets, mobile overflow checks and reduced visual clutter. Test real outputs, not only enabled buttons. Site titles and origins must be changed before public release.

## Docs compilation

The starter compiler supports headings, paragraphs and tilde-fenced code, escaping HTML. It is deliberately smaller than the original project's renderer; it does not pretend to support tables, embedded HTML or full Markdown links. URLs in the source handbook remain readable text. Source docs are rebuilt into dist/docs using the same stylesheet. Generated outputs are ignored; a clean build is the source of deployment truth. Add parser tests before extending syntax.

## Hosting boundary

Only dist is public. _headers is interpreted by Pages, not by the simple local server. Verify real deployed headers separately. The dev server is loopback-only and is not a hardened production server. New browser APIs, third-party libraries, input formats, storage or backend services require an ADR and new tests.
