---
render: true
title: Low-Level Design
description: Implementation conventions and invariants for Clean Local Tools.
route: /docs/architecture/lld/
index: false
section: Technical documentation
---

# Low-Level Design (LLD)

## Purpose

This document describes implementation-level conventions and invariants that should survive individual refactors. It is intentionally a living document. When a subsystem becomes complex enough to deserve its own LLD, link that document from here.

**Status on `main`:** ordinary browser-local tool conventions apply to production. Local AI contracts and model-specific details document the isolated `test/webgpu-hardware-preview-v1` experiment and are retained here as design constraints, not as a claim that the runtime is deployed on `main`.

## Repository model

### Clean HTML Printer

The HTML printer introduces an untrusted-markup import boundary and an isolated editable print document. See [Clean HTML Printer](clean-html-printer.md) for the sanitization allowlist, sandbox/CSP layers, reflow behavior, history limits and print verification boundary.

Public tools are generally directory-based routes containing their own browser application assets. Shared infrastructure should be placed in clearly named shared locations rather than copied into every tool once reuse becomes meaningful.

Before modifying an existing file, read the current branch version first. Do not reconstruct a large production file from an old copy or partial tool output.

## Local file lifecycle

A local file tool should generally follow this lifecycle:

1. Obtain a `File` only after user selection/drop/camera action.
2. Validate type/size/format as early as practical.
3. Decode/process inside browser memory or explicitly documented local browser storage.
4. Avoid network APIs for the working file.
5. Produce output using a `Blob`, Canvas export, PDF library output, or equivalent local representation.
6. Create a temporary object URL where needed.
7. Trigger an explicit download/print/user action.
8. Revoke object URLs and release large references when they are no longer required.

The original input must not be modified on disk by surprise.

## Main-thread rule

UI responsiveness matters. Small deterministic operations can run on the main thread. Work likely to produce noticeable blocking should be evaluated for a Web Worker or another browser-supported off-main-thread mechanism.

AI inference should normally sit behind a worker boundary.

## Local AI message boundary

The local AI client and worker should communicate using explicit message shapes. Message types should be stable, versionable if necessary, and testable without requiring every tool to understand backend internals.

Conceptual contract:

```text
Tool
  -> request(operation, input, options)
Local AI client
  -> worker message { id, operation, payload }
Worker
  -> evaluate compatibility/execution policy
  -> choose/initialize backend
  -> execute model/operation
  -> response { id, ok, backend, result | structured error }
Client
  -> resolve/reject original request
```

Structured compatibility errors should preserve a stable machine-readable code such as `local-ai-device-not-supported` in addition to a human-readable message.

## WebGPU initialization

WebGPU must be capability-detected rather than inferred from a browser user-agent string.

API presence alone is insufficient. A model that depends on WebGPU must perform a bounded adapter preflight because some environments expose `navigator.gpu` while still failing to return a usable adapter.

Conceptual sequence:

```text
Is navigator.gpu available?
        |
       no
        |
        v
 evaluate model fallback policy

navigator.gpu available
        |
        v
request adapter with timeout
        |
 adapter unavailable/failure
        |
        v
 evaluate model fallback policy

adapter available
        |
        v
initialize WebGPU model/backend
```

Initialization must be bounded. A browser/driver that exposes an API but fails to initialize correctly must not leave the user waiting indefinitely.

Backend selection should be observable for tests and diagnostics, but ordinary users should not need to understand GPU terminology to use a tool.

## Model adapter direction

Tools should request semantic operations rather than instantiate a specific AI framework directly.

Prefer:

```text
feature -> model adapter -> execution policy -> runtime/backend
```

Avoid:

```text
feature -> framework-specific global object -> hard-coded model/CDN/GPU assumptions
```

This makes it possible to change model format, inference library, hosting, caching, or acceleration strategy without rewriting every tool.

## Execution policy

Each compute-intensive model must declare its acceptable execution paths. The policy is part of the model contract, not a generic global fallback switch.

At minimum, document:

- preferred backend;
- allowed fallback backend(s);
- fallback mode such as `always`, `desktop-only`, or `never`;
- supported/unsupported device classes;
- model-specific performance evidence used to approve a fallback;
- stable unsupported error code.

The current experimental MobileNetV4 adapter uses:

```text
preferred backend: WebGPU
fallback backend: WASM
fallback policy: desktop-only
unsupported code: local-ai-device-not-supported
```

Device classification should avoid brittle browser-name checks. The current adapter accepts an explicit device class when the caller has one and otherwise uses `navigator.userAgentData.mobile` where available. If the device class cannot be established and the fallback is only certified for desktop, the conservative result is unsupported rather than assuming the heavy CPU path is safe.

This conservative behavior is deliberate.

## Fallback behavior

Fallback is part of the feature, not an exception handler added at the end.

When WebGPU is unavailable, adapter acquisition fails, model initialization fails, or GPU inference fails, the model adapter must re-evaluate the execution policy before switching backends.

Do **not** automatically run CPU/WASM merely because it exists.

For a model whose fallback is not approved on the current device class:

1. stop before loading the heavy fallback where possible;
2. return `local-ai-device-not-supported`;
3. explain in plain language that the feature needs supported browser/device acceleration or an approved local fallback;
4. reassure the user that the file was not uploaded or sent to a cloud fallback.

Do not silently send the work to a remote AI service as a fallback for a local-only feature.

## Browser storage

Temporary in-memory processing is preferred by default.

If IndexedDB, Cache Storage, OPFS, or another persistent local store is introduced:

- state why persistence is needed;
- document what is stored;
- document lifetime/cleanup;
- avoid storing sensitive working files longer than necessary;
- provide a clearing path when appropriate;
- add tests for the persistence contract.

## External dependencies

For every runtime dependency that can affect a tool:

- pin or otherwise control the version where feasible;
- know the source URL or self-hosted path;
- understand license obligations;
- avoid dynamic latest-version URLs;
- consider what happens if the dependency cannot be downloaded;
- do not claim Offline Ready unless the dependency is available offline in the tested workflow.

## Errors

User-facing errors should answer, in plain language:

- what could not be done;
- whether the original file is safe/unchanged;
- what the user can try next.

Diagnostic details may be logged for development, but do not log private file contents or extracted sensitive information.

For unsupported local AI, the preferred user-facing shape is equivalent to:

> This AI feature isn't supported on this device yet. It requires browser hardware acceleration, or an explicitly certified local fallback, to run privately and efficiently. Your file has not been uploaded or processed elsewhere.

## Identity-photo constraint

Passport-photo processing must not regenerate facial identity. Keep deterministic image operations separate from generative AI experimentation.

## Performance constraints

Large browser-local files can create memory pressure. Avoid unnecessary full-size copies and base64 expansion when Blob/ArrayBuffer/object-URL workflows are available.

Compute-heavy models need measured fallback evidence before a device class is certified. “It eventually finishes” is not sufficient evidence.

Performance optimization must not weaken correctness or privacy behavior.

## Definition of implementation completeness

A new subsystem is not complete until:

- behavior exists;
- failure/fallback paths are defined;
- compute policy is explicit for heavy local models;
- tests cover meaningful behavior;
- CI is green;
- relevant architecture/operations docs are updated;
- user-facing privacy and compatibility claims accurately describe the implementation.
