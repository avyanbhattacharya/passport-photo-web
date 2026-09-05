---
render: true
title: Project Principles
description: The privacy, simplicity, accessibility, and engineering principles behind Clean Local Tools. Your files never leave your machine.
route: /principles/
index: true
section: About Clean Local Tools
layout: brand
variant: principles
headline: Principles that keep the promise honest.
heroCopy: Privacy should be supported by product decisions, architecture, plain language, and tests—not left as a policy-page claim.
---

# Project Principles

These principles turn the privacy promise into product and engineering constraints. They should change only through a deliberate, documented project-level decision—not through convenience or drift.

## 1. Build for people, not data extraction

Clean Local Tools exists to provide useful tools. The user is the customer or beneficiary, not a source of behavioral data to harvest.

Do not introduce a business model whose value depends on collecting, selling, sharing, or profiling users' personal information.

## 2. Prefer local processing

When a task can be performed safely and reasonably in the browser, process the user's working data on the user's device.

Remote processing is not automatically forbidden for every imaginable future feature, but it must never be smuggled into a tool that promises local-only file processing. Any architectural exception requires explicit documentation, a clear user choice, and privacy wording that accurately describes the behavior.

## 3. No advertising as a product dependency

The intended experience is free of display advertising and ad-driven interface design. Do not make the tools noisy, deceptive, or deliberately inconvenient to increase ad impressions.

Voluntary support or other future funding mechanisms should not compromise the core utility or privacy model.

## 4. No unnecessary accounts

A utility that does not need identity should not require identity. Avoid login walls, email capture, or registration merely to increase engagement metrics.

## 5. Privacy is architecture

A privacy policy cannot compensate for an architecture that unnecessarily sends private files away from the user's device.

Privacy claims should be supported by implementation, network behavior, code review, and tests wherever practical.

## 6. Plain language before jargon

Users should understand what happens to their files without knowing what WebGPU, WebAssembly, a CDN, or a Web Worker is.

Technical documentation should still be precise enough for engineers and AI agents to reproduce and verify the implementation.

## 7. Progressive enhancement and graceful fallback

Cutting-edge browser capabilities are welcome when they create meaningful value, but a new API should not casually turn unsupported browsers into dead ends.

Prefer capability detection and an explicit fallback path. For local AI, WebGPU is an acceleration path where supported. CPU/WASM fallback is available only when the specific model and device class have been explicitly judged reasonable for that workload.

## 8. Local-first does not mean run at any cost

A private local feature should not punish the user's device merely because a slow fallback is technically possible.

For compute-intensive AI, each model must declare an execution policy. The policy determines which accelerated backend is preferred, which fallback backends are permitted, and on which device classes those fallbacks are acceptable.

If the required local execution path is unavailable or is expected to be unreasonably slow, memory-heavy, battery-intensive, or thermally expensive, the correct product behavior may be to stop cleanly and say that the AI feature is not supported on that device or browser yet.

Do not silently replace an unsupported local path with remote/cloud processing.

User-facing compatibility messages should be plain language first. Technical backend details may be shown separately for diagnostics.

## 9. Do not confuse novelty with usefulness

New browser technology is valuable only when it improves a real task. Avoid turning the product into a browser-API demonstration gallery.

## 10. Test meaningful changes

Every meaningful production change should be covered by an existing automated test or should add/update a regression test alongside the change.

Tests should protect user-visible behavior, privacy invariants, architecture constraints, responsive behavior, browser compatibility, and important failure paths.

## 11. Keep operations simple

The static architecture is a feature. Avoid adding servers, databases, queues, accounts, secrets, or recurring infrastructure unless they solve a problem that cannot reasonably be solved within the local-first model.

Operational simplicity lowers cost and makes long-term survival more likely.

## 12. Avoid single-person knowledge

If only one person knows how something works, it is unfinished.

Important architecture, deployment, DNS, CI, recovery, dependency, and maintenance information belongs in version-controlled documentation.

## 13. Preserve user identity in identity-document tools

Passport and identity-photo utilities must not use generative techniques to reconstruct, beautify, or invent facial identity. Deterministic operations such as crop, geometry, brightness/contrast, segmentation, and print layout may be used when appropriate, with clear limitations.

## Decision filter for a new tool

Before adding a tool, ask:

1. Is this useful to an ordinary person?
2. Is there a meaningful privacy advantage to doing it locally?
3. Can the browser perform it reliably enough?
4. Can unsupported capabilities degrade gracefully or fail clearly?
5. For compute-heavy features, has the fallback workload been explicitly approved for the target device class?
6. Can we test the important workflow?
7. Does it fit naturally with the existing private-tool ecosystem?
8. Can a future maintainer understand and operate it without private knowledge?

A tool does not need a perfect answer to every question, but serious exceptions should be explicit rather than accidental.
