# Architecture Overview

## Purpose

This document gives a new human or AI maintainer a fast mental model of Clean Local Tools before they read implementation details.

## System in one picture

```text
                        CLEAN LOCAL TOOLS
                              |
                     Static website / PWA
                              |
        +---------------------+---------------------+
        |                     |                     |
     PDF tools            Image tools          Other tools
        |                     |                     |
        +---------------------+---------------------+
                              |
                    Browser-local execution
                              |
             +----------------+----------------+
             |                                 |
       JS / Canvas / WASM                  Local AI layer
             |                                 |
       Web Workers where                  Worker boundary
         appropriate                           |
                                      Model/runtime adapter
                                               |
                                      +--------+--------+
                                      |                 |
                                    WebGPU          CPU/WASM
                                  when usable       fallback

        USER WORKING FILES REMAIN INSIDE THE DEVICE BOUNDARY
```

## Trust boundary

The most important architectural boundary is the user's device.

Working documents and images selected for a local-processing tool should remain inside browser-controlled memory/storage on that device. They must not be transmitted to a remote processing endpoint while the tool presents the master promise **“Your files never leave your machine.”**

The website itself is delivered over the network. Some current tools also download JavaScript libraries, WebAssembly modules, or machine-learning model assets from third-party CDNs. Downloading application assets is different from uploading the user's working file, but it means those tools are not necessarily fully offline.

## Application shape

The project intentionally uses a low-infrastructure architecture:

- static HTML;
- CSS;
- browser JavaScript;
- browser APIs such as Canvas, File APIs, camera APIs, workers, service workers, and increasingly WebGPU;
- selected third-party browser libraries/models;
- no general-purpose application backend;
- no database containing user working files;
- no server-side file-processing pipeline.

GitHub Pages currently hosts production. Cloudflare currently manages the domain/DNS. Neither should be treated as part of the document-processing runtime.

## Tool isolation

Most tools live in their own route/directory and should be understandable as small applications. Shared architectural foundations may be introduced when they provide real leverage, such as the local AI runtime.

Avoid creating a large framework dependency merely to make all tools look structurally identical. Shared abstractions should solve recurring problems.

## Local AI direction

Local AI is being introduced as a reusable infrastructure layer rather than embedded directly into individual tool pages.

Conceptually:

```text
Tool UI
  |
Local AI client
  |
Web Worker message boundary
  |
Model/runtime adapter
  |
Capability selection
  |
+------------------+------------------+
|                                     |
WebGPU accelerated path           local fallback
                                     CPU/WASM
```

Key properties:

- feature code should not need to know the details of GPU initialization;
- WebGPU is an acceleration path, not a requirement for the entire site;
- unsupported or unhealthy GPU initialization must fail safely and within a bounded time;
- expensive inference should stay away from the main UI thread when practical;
- Safari/WebKit compatibility should be achieved through capability detection and fallback rather than browser-name checks;
- models should eventually be accessed through adapters so the product is not permanently coupled to one AI framework.

## Browser compatibility strategy

The architecture follows progressive enhancement.

A capability is detected at runtime. If it is available and successfully initializes, the optimized path can be used. Otherwise the tool should provide a local fallback or clearly explain that a specific optional feature is unavailable.

Automated tests currently exercise Chromium, desktop WebKit, and a mobile WebKit/iPhone profile. A passing WebKit test proves application behavior in that automated browser environment. It does not automatically prove physical GPU behavior on every Safari/iPhone hardware combination.

## Privacy architecture

The desired processing lifecycle is:

```text
User chooses file
       |
       v
Browser memory / local browser storage if needed
       |
       v
Local transformation / inference
       |
       v
Result Blob / object URL
       |
       v
User downloads or prints result
       |
       v
Temporary working state released
```

Avoid persistent storage unless it provides a clear user benefit. If persistent local storage such as OPFS is introduced later, document retention and clearing behavior explicitly.

## Deployment architecture

```text
Git repository
     |
GitHub Actions quality gates
     |
    main
     |
GitHub Pages
     |
cleanlocaltools.com
```

The domain should remain portable. The static site can theoretically move to another competent static host without redesigning the local-processing tools.

## Architectural priorities

When priorities conflict, use this order as a guide:

1. Correctness and user safety.
2. Truthful privacy behavior and claims.
3. Useful user experience.
4. Browser compatibility and graceful fallback.
5. Maintainability and testability.
6. Performance.
7. Novel technology.

A faster or more fashionable implementation is not an improvement if it weakens the privacy model or becomes impossible for future maintainers to verify.
