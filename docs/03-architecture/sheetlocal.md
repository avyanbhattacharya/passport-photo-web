---
render: true
title: SheetLocal Architecture
description: Local CSV analysis architecture and trust boundaries.
route: /docs/architecture/sheetlocal/
index: false
section: Architecture
---

# SheetLocal Architecture

SheetLocal is a browser-local tool for understanding CSV and TSV files. It is deliberately useful before it is ambitious: the first release profiles a selected file and runs a small set of explicit analyses without uploading the file or requiring a model download.

## Current scope

- A user selects a CSV or TSV file, up to 5 MB.
- A short-lived Web Worker parses the text away from the UI thread.
- The application infers simple text, number, and ISO-style date columns, then shows a preview and profile.
- Guided actions provide an overview, top categories, period comparison, duplicate rows, unusual numeric values, and missing-data counts.
- A report is assembled in the browser and downloaded locally. SheetLocal never writes to the original selected file.

CSV comes first because it is the smallest dependable foundation. Excel support, editing, and language assistance are not implied by this first route.

## Privacy boundary

The selected file is handled only in browser memory. The SheetLocal application makes no API request, has no account, analytics, or remote model download, and does not send spreadsheet contents to a server. The built-in example data is embedded in the application so it also works without a network request.

The product claim is therefore specific: **your file never leaves your machine while using SheetLocal.** It does not claim that every possible browser environment is offline-capable unless the built static site has been loaded and verified in that environment.

## Guided analysis before an LLM

The first release maps a narrow vocabulary to approved deterministic analyses. For example, “find missing values” selects the missing-data action; it does not execute arbitrary SQL, generate code, or guess at an opaque calculation. This keeps results reproducible, constrains memory and performance, and lets people understand what was computed.

A tiny local language layer may later explain already-computed results, but it must remain optional. The spreadsheet profile and every guided action must continue to work when no model can run on the device. There is no cloud fallback.

## Verification

Static checks enforce the local-only architecture, the route and catalog entries, and the handbook publication. Browser coverage imports a CSV fixture, verifies the profile and guided results, tests the duplicate path, and confirms reports download locally. Existing cross-browser route smoke tests include `/sheetlocal/`.

When changing this tool, retain its hard boundaries: no network transport of working files, no silent model download, bounded input size, and evidence visible alongside analysis results.
