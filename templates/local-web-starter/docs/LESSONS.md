# Lessons from Clean Local Tools

## Provenance and facts (not universal promises)

Source repository: avyanbhattacharya/passport-photo-web.
Production reference: 6b1acbb66880ca338ceb7dcd06090d2bdb47c934 (brand/docs layout).
HTML Printer reference: 64ecf4f69b1ef784a6d11b91309aea4eef484e6b.
HTML Printer green CI: https://github.com/avyanbhattacharya/passport-photo-web/actions/runs/33985475870 (2026-09-05).
Protected historical branch: baseline/clean-local-tools-ci-v1; never move it.
AI branches: feature/webgpu-ai-foundation-v1 and test/webgpu-hardware-preview-v1.
These identifiers are historical references, not destinations for a new project's deployment.

## Product and design

The promise became “Your files never leave your machine.” Keep wording honest: downloading model/runtime assets is network activity but not file upload; opening a URL deliberately contacts the target. Privacy is architecture, not just a footer. Offline is earned by tested asset caching and blocked-network workflows, not by being a static page.

Public About/Principles needed designed layouts matching the production homepage, not plain Markdown dumps. Markdown stays source of truth; public storytelling and restrained technical/noindex pages are different layouts. Shared CSS and cache-aware builds avoid visual drift.

## CI

Deep tests were more useful than broad shallow checks, but runaway pipelines prevented scale. Keep node:test cheap, Playwright workflows deterministic, worker counts modest, explicit job timeouts, fail-fast steps, browser caches and failure artifacts. Never silently increase timeouts until a hang looks green.

Playwright visible-text assertions ignore style elements. Inspect textContent with evaluate and a supported string matcher; do not assume asymmetric matchers work in every locator assertion. Fix test mistakes separately from app defects.

## HTML printer

White overlays do not reclaim page space; remove DOM nodes and simplify fixed-layout HTML. Raw HTML requires fresh-node allowlist reconstruction; drop active tags, arbitrary attributes, URLs and styles. Keep raster data images only unless another explicit loading path is designed.

WebKit blocked parent-installed event handlers in the initial no-scripts sandbox. The tested editor required allow-scripts with allow-same-origin and allow-modals. That combination is NOT a security boundary by itself. Strict reconstruction plus default-src none CSP remained essential. Never place raw HTML or arbitrary URLs in that frame. Regression tests checked malicious markup and network requests across engines.

URL imports need browser CORS permission. Do not promise arbitrary URLs work or add a proxy silently. Omit credentials and referrers, bound bytes and time, cancel superseded loads, explain failure and keep file/paste fallbacks. Redirect rejection is an intentional V1 limitation.

## WebGPU hardware

On a tested Mac/Chrome combination navigator.gpu and adapter creation succeeded, but the real model failed around Transpose/TransposeShared compute pipelines in Dawn/Metal, followed by invalid bind groups/mapAsync errors and about 120-second worker timeouts. API detection was not proof of usable inference.

Later hardware preview recovered by terminating a stuck WebGPU worker and retrying once in a fresh forced-WASM worker under desktop policy. A manual report passed with 5 predictions in about 53.6 seconds and selectedBackend wasm / fallbackReason webgpu-worker-timeout. That is a fallback pass, NOT a GPU pass.

The classifier's five guesses did not describe the user's photo. Runtime success and task/model accuracy need separate validation. Hardware data and reports stayed manual-only; no automatic telemetry or working-file upload. Do not reuse diagnostic user-agent hints as a certified GPU model or exact OS version.

## Maintenance

Merge main into long-lived AI branches while preserving branch-specific experiments and docs. Do not cherry-pick everything back into production. Brand/design docs were selectively promoted; runtime experiments were not. Name the repository separately from the product brand: passport-photo-web remained the repository even as the product became Clean Local Tools.
