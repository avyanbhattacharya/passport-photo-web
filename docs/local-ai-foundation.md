# Local AI Foundation v1

This branch establishes a browser-local AI execution layer for Clean Local Tools.

## Goals

- Prefer WebGPU when the browser exposes a usable adapter.
- Remain functional when WebGPU is unavailable by falling back to local CPU JavaScript.
- Run inference inside a Web Worker so model work does not block the page UI.
- Keep user inputs on the device.
- Keep tool code independent from a specific future model provider or inference library.
- Test Chrome/Chromium and WebKit paths independently.

## Runtime layers

`client.js` owns request/response communication with a dedicated worker.

`ai-worker.js` chooses the best local backend and contains fallback behavior.

`webgpu-runtime.js` owns WebGPU capability checks, adapter/device setup, compute shaders, and a deterministic neural-network probe.

The tiny MLP included in v1 is intentionally not a product model. It is a deterministic executable contract proving that the same neural-network computation can run locally through the CPU path and, on supported hardware, through WebGPU.

## Cross-browser strategy

The runtime asks for a WebGPU compatibility-level adapter first, then falls back to a core adapter when needed. Optional GPU features are requested only when the adapter exposes them. A browser without WebGPU does not fail the application: the worker moves to a local CPU backend.

Safari 26 added WebGPU across Apple's current platforms, but WebGPU remains a capability that must be detected at runtime rather than assumed. The fallback architecture is therefore permanent, not temporary scaffolding.

## Testing contract

- Node tests validate deterministic inference, validation, capability detection, compatibility-adapter selection, and optional feature negotiation.
- Chromium browser tests validate the actual worker/client lifecycle and end-to-end local inference.
- Desktop WebKit and iPhone WebKit run the same foundation smoke test, proving graceful operation even when GPU access differs from Chromium CI.
- The lab page is intentionally `noindex` and is not part of the public tool catalog.

## Next layer

The next milestone is a model adapter interface for a real browser inference runtime such as Transformers.js / ONNX Runtime Web. That adapter should preserve this contract:

1. model input stays local;
2. WebGPU is preferred when usable;
3. CPU/WASM fallback is explicit;
4. model loading and inference happen in a worker where supported;
5. UI code never depends directly on the inference vendor.
