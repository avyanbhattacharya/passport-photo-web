# Local AI Models

## Purpose

This document records the concrete model/runtime choices behind Clean Local Tools local AI so future humans and AI agents do not need to reconstruct them from code or chat history.

## Architecture rule

Product features should request a semantic operation through a model adapter. They should not directly instantiate a model framework, GPU device, or remote AI service.

```text
Tool
  |
LocalAIClient
  |
Web Worker
  |
Model adapter
  |
Runtime / framework
  |
+-------------------+-------------------+
|                                       |
WebGPU preferred                         local fallback
                                         WASM / CPU
```

The user's working input remains inside the browser processing boundary. Downloading model/framework assets does not mean the user's input is uploaded for inference.

## Foundation model

The first model is intentionally tiny and deterministic:

- ID: `clean-local-tools-foundation-mlp-v1`
- Task: `foundation-classification-probe`
- Purpose: verify worker messaging, WebGPU compute, deterministic output, timeouts, and CPU fallback
- Production value: none by itself; it is an engineering probe

This model is embedded in repository JavaScript and therefore requires no model download.

## First real pretrained model

The first real pretrained model is an image classifier:

- Model ID: `onnx-community/mobilenetv4_conv_small.e2400_r224_in1k`
- Task: image classification
- Adapter: `assets/local-ai/vision-model-adapter.js`
- Framework: Transformers.js
- Pinned framework version: `3.8.1`
- Preferred execution: WebGPU
- Current WebGPU dtype: `fp32`
- Local fallback: ONNX Runtime Web WASM through Transformers.js
- Current fallback dtype: `q8`
- Input contract: browser `Blob`/`File`
- Output contract: ranked `{label, score}` predictions
- Status: experimental engineering capability, not yet a public Clean Local Tools product

Why MobileNetV4 was selected for this stage:

1. It is a genuine pretrained vision model rather than a synthetic compute probe.
2. Hugging Face documents this model specifically as a Transformers.js WebGPU image-classification example.
3. Image classification gives us a clear, inspectable result while exercising preprocessing, real model loading, inference, WebGPU, and WASM fallback.
4. It is small enough to be a reasonable first browser model compared with a browser LLM or large multimodal model.
5. It establishes a reusable pattern before we choose a more product-specific document model.

ImageNet labels are general-purpose object categories, so this model should **not** be mistaken for a document-understanding product. Its role is to prove the real-model execution architecture.

## Asset flow

On first real-model use, the browser may retrieve:

- pinned Transformers.js application code from jsDelivr;
- ONNX/model configuration and weight assets from the Hugging Face Hub;
- ONNX Runtime Web/WASM support assets required by Transformers.js.

The exact bytes downloaded depend on framework/model/backend/dtype behavior. Do not hard-code a download-size marketing claim without measuring the exact deployed configuration.

The selected local image is passed as a browser `Blob` into the worker and then to the local inference pipeline. The adapter contains no cloud-inference API or upload fallback.

## Lazy loading

The real vision model is opt-in and lazy loaded.

Calling `visionStatus()` must not download Transformers.js or model weights. Downloads begin only when image classification is explicitly requested.

This matters for performance, privacy clarity, and ordinary users who never use AI functionality.

## Backend selection

Current selection behavior:

```text
secure context + navigator.gpu available?
           |
          yes
           v
load WebGPU pipeline
     | success
     v
  classify
     |
 WebGPU inference failure
     v
rebuild as WASM pipeline

no WebGPU / WebGPU initialization failure
           |
           v
       WASM pipeline
```

No remote inference service is used as a fallback.

## Safari strategy

Safari compatibility is pursued through progressive enhancement, not browser-name detection.

If a Safari/WebKit environment exposes usable WebGPU and the model/runtime successfully initializes, the WebGPU path may be used. Otherwise the architecture falls back to WASM where supported.

Automated Playwright WebKit coverage verifies that the application and lazy model contract behave correctly in WebKit. It does not prove physical Safari GPU execution on every Mac/iPhone generation.

Real-device Safari/WebGPU validation should be recorded separately when performed.

## Testing strategy

Required CI intentionally does **not** download the external model on every run. That would make the core quality gate dependent on large external network assets and reduce reliability.

Instead:

- static tests inject a fake Transformers.js module and prove WebGPU preference, WASM fallback, inference-failure fallback, input handling, pinned metadata, and result normalization;
- browser tests prove the worker exposes the real-model semantic contract;
- browser tests prove model assets are not downloaded merely by opening the lab or querying model status;
- existing foundation inference continues to prove real worker execution without external dependencies.

A separate real-model smoke should be run for model/framework upgrades and before promoting the capability into a public tool. That smoke must verify an actual image result and record browser/backend/runtime evidence.

## Upgrade procedure

Before changing model ID, Transformers.js version, backend options, or dtype:

1. Read the current adapter and this document.
2. Review upstream release/model notes and license information.
3. Update adapter metadata and implementation together.
4. Update deterministic static tests.
5. Run a real-model smoke in at least Chromium.
6. Test WebKit/Safari fallback behavior.
7. Measure first-load download/performance if the capability is moving toward production.
8. Update this document with the new evidence.
9. Require normal CI to pass.

Do not change a CDN URL to an unpinned `latest` reference.

## Next model criteria

The next model should be chosen for user value rather than novelty. Strong candidates should satisfy most of these properties:

- solves a common document/image problem;
- has a strong privacy advantage when run locally;
- has manageable browser download and memory cost;
- supports WebGPU and a local fallback;
- has a clear license and provenance;
- can be tested deterministically enough for long-term maintenance;
- produces value ordinary users can understand without knowing AI terminology.
