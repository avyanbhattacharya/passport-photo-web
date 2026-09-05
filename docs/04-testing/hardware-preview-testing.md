# Hardware Preview Testing

## Purpose

Some browser-local features depend on real device hardware and browser support that CI runners cannot prove. WebGPU-backed AI is the first such case.

The hardware preview lane lets people test experimental browser capabilities without repository ownership and without merging the experiment into `main`.

## Isolation model

Current preview branch:

`test/webgpu-hardware-preview-v1`

The preview lane must remain separate from production unless a deliberate promotion decision is made.

Rules:

- do not require testers to have GitHub access;
- do not add the hardware lab to the public tool catalog;
- keep the lab `noindex,nofollow`;
- do not add it to the sitemap;
- do not merge preview-only deployment configuration into `main` by accident;
- keep test reports manual and opt-in;
- do not upload the tester's working image for inference;
- do not silently replace an unsupported local backend with a remote AI service.

## Tester workflow

1. Open the public preview URL supplied by the maintainer.
2. Wait for the compatibility result.
3. If supported, choose an ordinary non-sensitive image.
4. Run the hardware test.
5. Review the generated technical report.
6. Use **Copy Test Report** or **Download Test Report (.json)** only if willing to share the result.
7. Send the report to the maintainer through an agreed communication channel.

The tester does not need a GitHub account or repository permissions.

## Report schema

Schema identifier:

`clean-local-tools-hardware-test/v1`

The report may include:

- anonymous local test ID;
- timestamp;
- browser user-agent and platform strings;
- language;
- hardware concurrency where exposed;
- device memory where exposed;
- touch-point count where exposed;
- WebGPU API/adaptor availability;
- model execution-policy result;
- selected backend;
- fallback reason;
- model/framework identifiers;
- compatibility probe time;
- model-load-plus-inference time;
- pass/unsupported/error outcome.

The report must not contain:

- the selected image;
- image bytes;
- extracted image contents;
- filenames unless a future explicit design decision adds them;
- account identity;
- automatic telemetry submission.

## Expected outcome matrix

### Desktop Chrome or another supported Chromium browser

Preferred result: WebGPU is usable and the real model runs with the `webgpu` backend.

If a real operator invalidates or stalls the WebGPU device after the adapter probe succeeds, bounded initialization and inference watchdogs must let a certified desktop retry locally with WASM. The report must identify `wasm` as the selected backend and retain `webgpu-model-initialization-timeout`, `webgpu-inference-timeout`, or the concrete WebGPU rejection as the fallback reason. A generic outer `local-ai-worker-timeout` is not an acceptable recovery result for this known failure class.

### Desktop Safari

Preferred result: WebGPU where the current model/runtime combination supports it. A certified local fallback may be used only if the model's execution policy permits it.

### Mobile browsers

A heavy CPU/WASM fallback must not be assumed safe merely because it technically exists. If WebGPU is unavailable and the model does not explicitly certify the mobile fallback, the correct result is `unsupported`.

## Evidence levels

Keep these claims separate:

- **CI evidence:** architecture, regression behavior, worker/model contracts, WebKit/Chromium automation.
- **Preview-device evidence:** a specific physical browser/device successfully executed the workflow.
- **Production support claim:** only after enough representative evidence exists and the team deliberately supports that environment.

One successful tester device does not prove universal browser compatibility.

## Deployment direction

A branch-preview host such as Cloudflare Pages can expose the static branch at a shareable HTTPS URL. HTTPS matters because WebGPU is a secure-context API.

The preview deployment should build from the isolated test branch and should not modify the production `cleanlocaltools.com` deployment.

## Exit condition for the first WebGPU hardware milestone

The milestone is satisfied when:

1. preview CI is green;
2. the hardware lab is available over HTTPS without GitHub authentication;
3. at least one physical desktop Chrome test returns a real pretrained model result using WebGPU;
4. the generated report records the selected `webgpu` backend and timing;
5. at least one Safari-family test is attempted and its actual result is recorded accurately;
6. no unsupported device is forced into an unapproved heavy CPU fallback.
