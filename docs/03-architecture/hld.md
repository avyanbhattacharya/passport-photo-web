---
render: true
title: High-Level Design
description: High-level component, trust-boundary, and data-flow design for Clean Local Tools.
route: /docs/architecture/hld/
index: false
section: Technical documentation
---

# High-Level Design (HLD)

## Scope

This HLD describes the major Clean Local Tools components, their responsibilities, trust boundaries, and interactions. It intentionally avoids function-level implementation detail.

**Status on `main`:** sections describing existing static tools and browser-local processing are current. Local AI sections document an experimental target architecture validated on `test/webgpu-hardware-preview-v1`; they do not claim that the AI runtime is deployed in production.

## Primary components

### 1. Static application shell

Responsibilities:

- deliver each tool's HTML/CSS/JavaScript;
- provide navigation, branding, accessibility, responsive layout, SEO metadata, and privacy explanation;
- initiate local processing after explicit user actions.

There is no general application server required to execute a tool.

### 2. Tool modules

Each public tool owns its workflow and domain-specific processing. Current categories include PDF, image/document, identity-photo, QR, and Japa utilities.

A tool should own only what is specific to its job. Reusable technical concerns may be promoted into shared foundations when repeated use justifies the abstraction.

### 3. Browser processing layer

This is where ordinary deterministic processing occurs using combinations of:

- JavaScript;
- Canvas;
- browser File/Blob APIs;
- PDF/image libraries;
- WebAssembly where appropriate;
- Web Workers for expensive work that should not block interaction.

### 4. Experimental local AI foundation

The local AI layer provides a stable boundary between product features and AI execution technology.

Responsibilities:

- detect relevant capabilities;
- probe whether WebGPU is genuinely usable rather than checking API presence only;
- prefer WebGPU when usable;
- apply a model-specific execution policy before choosing a fallback;
- permit CPU/WASM fallback only for model/device combinations that have been explicitly approved;
- stop cleanly with a compatibility result when no reasonable local backend is available;
- keep expensive execution behind a worker boundary where practical;
- expose a tool-facing API that does not require every tool to understand GPU lifecycle details;
- bound initialization so a broken/slow capability does not indefinitely hang a tool;
- never convert an unsupported local path into a hidden remote/cloud inference path.

Model adapters isolate model/framework-specific code from tool code.

The high-level decision flow is:

```text
Model requirements + device/browser capabilities
                  |
                  v
          Execution policy
          /      |       \
         /       |        \
     WebGPU   approved    unsupported
       |      CPU/WASM        |
       v         |             v
      run       run      explain and stop
```

The policy is intentionally model-specific. A lightweight model may permit a WASM fallback on desktop-class devices, while a heavier model may require WebGPU everywhere. Technical capability and acceptable product experience are separate questions.

### 5. Third-party runtime assets

Some production tools retrieve libraries from CDNs. The experimental local AI implementation also retrieves model/runtime assets.

These assets are application dependencies, not destinations for user working files. Nevertheless they create network availability, supply-chain, caching, and long-term-maintenance concerns.

Direction of travel:

- know exactly which external assets a tool needs;
- pin versions where feasible;
- test failure behavior;
- evaluate self-hosting important assets;
- only award an Offline Ready claim after automated offline verification.

### 6. Service worker / local caching

Some application areas, notably the passport-photo experience, use service-worker/PWA behavior. Service workers may cache application assets but must not silently redefine the privacy or persistence model.

Future broader offline support should be deliberate and tested.

### 7. CI quality gates

GitHub Actions is the current verification system. The quality pipeline combines inexpensive static/architecture checks with real browser workflows.

Production changes should not be considered complete merely because code was committed. Required gates must pass.

## Data flow

Typical file-processing flow:

```text
Browser downloads application assets
              |
              v
User explicitly chooses local file
              |
              v
File object exists in browser
              |
              v
Tool processes locally
              |
       optional local AI
              |
              v
Output created as browser Blob/data
              |
              v
User downloads / prints result
```

Forbidden for a local-only file tool:

```text
User file -> hidden upload -> remote processing -> result
```

If a future feature genuinely needs remote processing, it must be architecturally and visibly separated from the local-only promise.

## Failure model

The application must expect failure at several boundaries:

- unsupported browser APIs;
- WebGPU unavailable;
- GPU adapter/device initialization failure;
- model execution policy refusing an unsafe/uncertified fallback;
- worker startup or message failure;
- third-party CDN unavailable;
- malformed/encrypted/unsupported input;
- memory pressure from large files/images;
- browser-specific rendering or input behavior;
- user cancellation or navigation.

“Unsupported on this device/browser” is a valid, deliberate product outcome for advanced local AI. It is preferable to unexpectedly consuming excessive CPU, battery, memory, or thermal budget.

Failures should not corrupt the original local file. Prefer understandable user-facing errors and recoverable state.

## Security and privacy boundaries

### Inside the device boundary

- selected working files;
- decoded image/PDF content;
- intermediate processing buffers;
- local model inputs;
- generated output prior to download.

### Network-visible application activity

- page and static asset requests;
- CDN library/model requests where currently used;
- normal DNS/TLS/HTTP metadata associated with loading the application.

Do not blur these two categories in documentation or marketing.

## Non-goals of the current architecture

The system is not currently intended to be:

- a cloud document repository;
- a collaborative editing backend;
- an account/profile platform;
- an ad-tech surface;
- a server-side AI inference service;
- an identity-photo generator that invents or reconstructs facial features.

## Evolution rule

When introducing a new major component, document:

1. the problem it solves;
2. why the browser/local approach is or is not sufficient;
3. the new data flows and trust boundaries;
4. failure/fallback behavior;
5. browser support;
6. compute policy and supported device classes for heavy local features;
7. tests proving the important properties;
8. operational burden;
9. an ADR if the decision is architecturally significant.
