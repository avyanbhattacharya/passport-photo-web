# Test Results and Evidence

## Purpose

This page records significant quality-gate evidence and explains how to interpret it. It is not intended to become a hand-maintained list of every CI run forever.

The authoritative current result is the latest required GitHub Actions run for the commit/PR being evaluated.

## Known-green historical baseline

Branch:

`baseline/clean-local-tools-ci-v1`

Commit:

`b00b46fda186831d7a1ae006e1eec39ddc61bcd6`

This branch was intentionally frozen as a reusable known-green reference for the Clean Local Tools application and CI foundation. It should not be moved during ordinary development.

The warm quality-gate run used when establishing that CI baseline was run `33800087515`. At that point typical warm wall-clock time was approximately one minute, with browser installation skipped on cache hits. Runtime can vary substantially with GitHub-hosted runner and package-network conditions.

## Local AI / WebGPU Foundation V1 evidence

Feature branch:

`feature/webgpu-ai-foundation-v1`

Pull request quality-gate run:

`33830703449`

Head commit at successful run:

`7c9182c3520392b303b58a8080f37825a8af2050`

Result:

```text
Quality gates                         PASS

Static checks                         PASS
  Site metadata and catalog           PASS
  Test architecture and hygiene       PASS
  Local AI foundation                 PASS

Deep Chromium                         PASS
  Core, Japa, local AI deep tests     PASS
  PDF deep tests                      PASS
  Image and catalog deep tests        PASS

WebKit and iPhone smoke               PASS
  Desktop WebKit smoke                PASS
  iPhone WebKit smoke                 PASS
```

What this proves:

- the feature branch passed the repository's required automated quality architecture at that commit;
- local-AI foundation static assertions passed;
- local-AI browser tests passed in Chromium;
- the broader existing tool suite remained green in its configured deep groups;
- desktop and mobile WebKit smoke remained green.

What this does **not** prove:

- that every physical Chrome/Safari device has a working GPU configuration;
- that Playwright WebKit is identical to every shipping Safari build;
- that a physical iPhone GPU exercised WebGPU during CI;
- that future real AI models will have the same performance/memory behavior as the foundation test workload;
- that the whole site is offline-ready.

## First real pretrained browser model evidence

Model:

`onnx-community/mobilenetv4_conv_small.e2400_r224_in1k`

Framework:

Transformers.js `3.8.1`

Successful one-time quality-gate run:

`33841261148`

Successful head commit:

`2a9cc15069aa27a9a6afe96b67cedfa3de6a8ca9`

The run temporarily included `npm run test:chromium:real-ai` in the required Chromium job. The smoke test generated a synthetic 224×224 PNG inside the browser, passed its `Blob` through `LocalAIClient` and the worker/model-adapter boundary, downloaded the real pretrained framework/model assets, performed local image classification, and returned valid ranked predictions.

The important steps in that run were:

```text
Static checks                         PASS
Local AI static/model-adapter tests   PASS
Core/Japa/local AI Chromium tests     PASS
Real local AI model smoke             PASS
PDF deep tests                        PASS
Image/catalog deep tests              PASS
Desktop WebKit smoke                  PASS
Mobile WebKit smoke                   PASS
```

### Failure that improved the design

The first one-time real-model attempt was run `33840829567` at commit `084a4bc018df165775ac60be2f6eb057b39c8a78`. It failed with a useful environmental condition: headless Chromium exposed `navigator.gpu`, but `requestAdapter()` could not obtain a GPU adapter. Transformers.js therefore attempted its WebGPU backend and reported that no usable GPU adapter was available.

This exposed an architectural bug in our original capability check: **API presence is not equivalent to a usable WebGPU backend.**

The vision adapter was changed to perform a bounded `requestAdapter()` preflight before initializing the Transformers.js WebGPU pipeline. If no real adapter is returned, it chooses the local WASM pipeline directly instead of first partially initializing the WebGPU inference runtime. Regression tests now protect this behavior.

### What the successful real-model run proves

- a genuine pretrained ONNX vision model can be loaded and executed from the Clean Local Tools worker/model-adapter architecture;
- model inference accepts a local browser `Blob` rather than requiring an upload API;
- first-use external model/runtime asset loading works in the tested Chromium CI environment;
- the real-model architecture has a usable local fallback when WebGPU cannot obtain an adapter;
- the rest of the existing application and WebKit smoke suite remained green in the same quality-gate run.

### What it does not prove

- that the GitHub Actions runner executed the model on WebGPU rather than the local WASM fallback;
- physical GPU performance on Chrome, Safari, macOS, Windows, Android, or iPhone;
- that every Safari version supports the same WebGPU model operations;
- that MobileNetV4 is itself the eventual user-facing AI product;
- that model assets are available offline after first use;
- a fixed first-use download size or memory footprint across browsers/backends.

Physical-browser WebGPU evidence should be recorded separately when we exercise the model on hardware where an actual GPU adapter is available.

### Required CI after the experiment

The real-model browser smoke deliberately remains available as:

`npm run test:chromium:real-ai`

It is **not** intended to run on every normal pull request because it downloads sizeable third-party model/runtime assets and would make the required quality gate unnecessarily dependent on external model hosting. Normal CI uses deterministic adapter tests plus the lightweight foundation model. Run the real-model smoke explicitly for model/framework upgrades and before promoting an AI capability to a public tool.

## Performance observation from the AI foundation runs

Dependency-install duration on GitHub-hosted runners has varied from a few seconds to several minutes. The actual deterministic browser-test phases are comparatively short. Treat individual CI duration as an observation rather than a performance guarantee.

Real-model first-load runtime also includes external framework/model downloads, so it should be measured separately from warm local inference before a feature becomes user-facing.

## Recording future milestones

Add an entry here when a result establishes a meaningful architectural milestone, for example:

- first confirmed real-model WebGPU execution on physical hardware;
- first automated no-working-file-network-leak test around a real model;
- first Offline Ready tool proven under network isolation;
- major CI architecture change;
- major browser compatibility expansion.

For each milestone record:

- branch/tag/commit;
- CI run identifier;
- important gates and results;
- what the evidence proves;
- what it explicitly does not prove;
- relevant runtime/performance observations.

This prevents future maintainers or AI agents from turning a green badge into a broader claim than the test actually supports.
