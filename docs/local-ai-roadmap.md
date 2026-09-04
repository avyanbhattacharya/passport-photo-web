# Local AI roadmap

## Foundation v1

- WebGPU capability detection
- compatibility-level adapter preference with core fallback
- Web Worker execution boundary
- deterministic neural-network compute probe
- local CPU fallback
- Chromium, desktop WebKit, and mobile WebKit smoke coverage

## Foundation v2

- pluggable model-adapter interface
- real browser inference runtime
- model download progress and cache policy
- WASM fallback for browsers without WebGPU
- memory budgeting and cancellation
- device capability telemetry that stays local by default

## First product candidates

Favor tasks with a strong privacy advantage and a small enough model to run comfortably in-browser, such as document classification, image quality checks, semantic grouping, and OCR-adjacent document understanding. Product models should not be added until measured browser performance and memory use are acceptable on both desktop and mobile.
