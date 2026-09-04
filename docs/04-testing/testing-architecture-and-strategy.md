# Testing Architecture and Strategy

## Purpose

Testing is a first-class architectural component of Clean Local Tools. The project is expected to grow, and manual verification alone does not scale reliably across tools, browsers, responsive layouts, privacy guarantees, and new browser capabilities.

## Core policy

**Every meaningful production change must be covered by an existing automated test or add/update a regression test alongside the change.**

A green local edit is not sufficient. For repository work, completion means the required CI quality gates have actually finished successfully.

## Testing layers

```text
                 Real browser workflows
          Chromium / WebKit / mobile WebKit
                        ^
                        |
               Tool deep/regression tests
                        ^
                        |
             Static architecture checks
                        ^
                        |
                 Source invariants
```

These layers have different jobs. Do not force every assertion into an expensive browser test.

## Layer 1: static/source tests

Technology: Node's built-in test runner.

Purpose:

- validate sitemap/canonical/catalog relationships;
- protect important branding/privacy wording;
- protect test architecture and CI invariants;
- detect missing routes/assets/configuration patterns cheaply;
- validate architectural source invariants for shared foundations such as local AI.

Static tests should be fast enough to provide early feedback and should not require browser installation.

## Layer 2: Chromium deep tests

Technology: Playwright.

Purpose:

- exercise real user workflows;
- test JavaScript behavior that needs a browser;
- verify file selection, processing, output, interactions, and failure states;
- deeply test the primary browser path;
- exercise local AI client/worker behavior and WebGPU/fallback logic where the test environment permits.

Chromium is the primary deep-test browser to avoid multiplying the cost of every workflow across every engine.

## Layer 3: WebKit compatibility smoke

Technology: Playwright WebKit projects for desktop and iPhone-like mobile viewport/device behavior.

Purpose:

- catch browser-engine incompatibilities;
- catch mobile layout/input regressions;
- protect route loading and important shared behavior;
- verify graceful fallback where advanced APIs are unavailable in the automated environment.

Cross-browser smoke is intentionally narrower than Chromium deep coverage.

A passing Playwright WebKit run is not a claim that every physical Safari device/GPU combination has been tested.

## Layer 4: physical hardware preview testing

Some capabilities, especially WebGPU-backed AI, require evidence from real devices. The project therefore supports an isolated branch-preview lane where testers need only a public HTTPS URL, not repository access.

The detailed process, privacy contract, report schema, and first WebGPU milestone are documented in [Hardware Preview Testing](hardware-preview-testing.md).

Physical preview reports are evidence about the specific tested browser/device combination. They do not automatically create a universal production support claim.

## Browser test topology

The project uses Playwright rather than duplicating the entire suite across multiple E2E frameworks.

Current design principles:

- `fullyParallel: true`;
- limited CI workers to keep shared runners stable;
- Chromium for deep coverage;
- WebKit and mobile WebKit for targeted compatibility smoke;
- traces on first retry rather than every successful test;
- screenshots on failure;
- CI timeouts so hung browser/API behavior cannot consume unlimited runtime;
- browser binary caching in GitHub Actions;
- system dependencies still installed explicitly for reliability.

## Local AI test strategy

Local AI adds failure modes that ordinary deterministic tools do not have. Tests should cover the architecture, not merely a happy-path model output.

Required categories as the subsystem evolves:

1. capability detection;
2. WebGPU available and initializes successfully;
3. WebGPU missing;
4. adapter/device initialization failure;
5. initialization timeout/bounded failure;
6. fallback backend selection;
7. worker request/response correlation;
8. worker error propagation;
9. deterministic fixture/model output where feasible;
10. tool behavior independent of which local backend was selected;
11. no hidden remote-processing fallback;
12. WebKit/mobile compatibility behavior.

When a real model is introduced, keep at least one small deterministic fixture that makes inference correctness testable without large or flaky network downloads if possible.

## Privacy regression testing

Where practical, tests should make privacy architecture executable.

Examples:

- ensure tool code does not introduce an upload endpoint;
- intercept browser network requests during a local file workflow and fail if the working file is transmitted;
- verify expected external asset requests separately from working-data requests;
- eventually test Offline Ready tools with network disabled after caching.

A privacy statement that cannot be tested at all deserves extra architectural scrutiny.

## Responsive testing

Every public route should avoid unintended horizontal overflow at representative mobile sizes. High-value pages should have explicit responsive behavior tests rather than relying only on screenshots.

## External CDN risk

Some browser tests currently depend on real third-party CDNs for PDF/image libraries or models. This means a network/CDN problem can look like an application failure.

Future improvements should consider self-hosting or deterministic test fixtures for critical dependencies. Do not weaken assertions merely to make flaky external dependencies disappear.

## Test data

Use synthetic/non-sensitive fixtures committed to `tests/fixtures` where possible. Do not commit private user documents, identity images, credentials, or production personal data as test fixtures.

## CI architecture

The GitHub Actions quality workflow currently separates:

- Static checks;
- Deep Chromium;
- WebKit and iPhone smoke.

Jobs run independently so cheap checks finish quickly and browser-engine failures are easy to identify.

Browser caches reduce repeated binary download cost. The project previously tested a Playwright container approach and rejected it because the real CI experiment added startup overhead and reduced reliability. Do not reintroduce it without new evidence.

## Failure handling

When CI fails:

1. identify whether the failure is product behavior, test defect, external dependency, or infrastructure;
2. reproduce/inspect evidence rather than rerunning blindly;
3. fix the underlying problem;
4. add or improve regression coverage if the failure exposed a gap;
5. rerun real CI;
6. do not call the change complete until required gates are green.

## Long-running engineering protocol

For substantial work:

1. define the explicit exit condition;
2. establish a baseline;
3. make code and test changes together;
4. trigger real CI;
5. inspect actual results;
6. iterate until the agreed result is reached or a concrete external blocker exists;
7. report concrete intermediate results when useful;
8. never imply work continues after a response unless an actual scheduled automation exists.

## What tests are not

Tests are not a substitute for architectural reasoning, accessibility review, real-device testing, or privacy analysis. They are executable evidence that specific properties continue to hold.
