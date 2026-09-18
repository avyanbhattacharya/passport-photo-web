# Optional local AI: not enabled by this starter

Adopt only when a real user task justifies model size, latency, accuracy and device coverage. Keep tool -> semantic client -> worker -> model adapter -> runtime separation. Pin framework/model revisions and document license, task and expected asset downloads.

Historical trial: transformers.js 3.8.1, onnx-community/mobilenetv4_conv_small.e2400_r224_in1k, image-classification, WebGPU preferred with policy-approved desktop WASM fallback. This is evidence from an experiment, not a recommendation to ship that model today.

Probe secure context and an actual adapter, then validate the real model. Apply initialization/inference/worker-supervisor deadlines. Some failures never reject; terminate poisoned/stuck workers and retry at most once with explicit forced fallback. Revalidate original input and policy. Mobile and unknown devices must not inherit expensive desktop fallback automatically.

Report policy decision, attempted backend, actual selected backend, fallback reason, stage timings, error code and prediction count. “not-loaded” must not conceal a completed fallback or a failed GPU attempt. Distinguish unsupported, timeout, decode failure, runtime failure, fallback pass and GPU pass.

Use unit mocks for hung promises/device loss/fallback policy; browser integration for worker protocol; public HTTPS previews for manual real-device tests. Test representative image accuracy separately. Never identify a physical Mac GPU from MacIntel or browser UA alone. Keep local reports manual-only and free of working images, private URLs and telemetry.

Do not copy the experimental runtime into a new project unless explicitly needed; this starter contains only the lesson and boundary.
