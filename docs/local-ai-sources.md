# WebGPU foundation source notes

Reviewed September 2026.

- MDN WebGPU API: WebGPU is secure-context only and supports general-purpose GPU compute.
- MDN GPU/requestAdapter: compatibility-level adapters can broaden support and `core-features-and-limits` must be feature-detected.
- MDN GPU interface: WebGPU is available from Web Workers where supported.
- WebKit Safari 26 release notes: Safari 26 added WebGPU on macOS, iOS, iPadOS, and visionOS.
- Hugging Face Transformers.js WebGPU guide: Transformers.js can execute browser model inference with WebGPU through ONNX Runtime Web.

The implementation intentionally feature-detects rather than user-agent detects.
