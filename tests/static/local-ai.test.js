const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const runtime = require('../../assets/local-ai/webgpu-runtime.js');
const asyncUtils = require('../../assets/local-ai/async-utils.js');
const modelAdapter = require('../../assets/local-ai/model-adapter.js');

function assertCloseArray(actual, expected, tolerance = 1e-6) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i += 1) assert.ok(Math.abs(actual[i] - expected[i]) <= tolerance, `index ${i}: ${actual[i]} vs ${expected[i]}`);
}

test('foundation model is deterministic and normalized', () => {
  const result = runtime.inferCPU([0.2, 0.4, 0.6, 0.8]);
  assert.equal(result.logits.length, 3);
  assert.equal(result.probabilities.length, 3);
  const sum = result.probabilities.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-10);
  const typed = runtime.inferCPU(new Float32Array([0.2, 0.4, 0.6, 0.8]));
  assertCloseArray(result.logits, typed.logits);
  assertCloseArray(result.probabilities, typed.probabilities);
});

test('model adapter exposes a local-only semantic contract and CPU fallback', async () => {
  assert.equal(modelAdapter.FOUNDATION_MODEL.localOnly, true);
  assert.equal(modelAdapter.FOUNDATION_MODEL.task, 'foundation-classification-probe');
  assert.deepEqual(modelAdapter.FOUNDATION_MODEL.input.shape, [4]);
  const adapter = modelAdapter.createFoundationAdapter({ runtime });
  const result = await adapter.infer([0.2, 0.4, 0.6, 0.8], { backend: 'cpu-js' });
  assert.equal(result.backend, 'cpu-js');
  assert.equal(result.model, modelAdapter.FOUNDATION_MODEL.id);
  assertCloseArray(result.probabilities, runtime.inferCPU([0.2, 0.4, 0.6, 0.8]).probabilities);
  assert.throws(() => modelAdapter.describe('remote-magic-model'), /unknown-local-model/);
});

test('model adapter delegates WebGPU without leaking GPU details into callers', async () => {
  const calls = [];
  const fakeRuntime = {
    inferCPU() { throw new Error('cpu should not run'); },
    async inferWebGPU(device, input) {
      calls.push({ device, input });
      return { logits: [1, 2, 3], probabilities: [0.1, 0.2, 0.7] };
    }
  };
  const adapter = modelAdapter.createFoundationAdapter({ runtime: fakeRuntime });
  const device = { label: 'test-device' };
  const result = await adapter.infer([1, 2, 3, 4], { backend: 'webgpu', device });
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.model, modelAdapter.FOUNDATION_MODEL.id);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].device, device);
});

test('input validation rejects malformed model input', () => {
  assert.throws(() => runtime.inferCPU([1, 2, 3]), /exactly 4/);
  assert.throws(() => runtime.inferCPU([1, 2, 3, Infinity]), /finite/);
  assert.throws(() => runtime.inferCPU('1234'), /array/);
});

test('WebGPU capability detection respects secure context and availability', () => {
  assert.deepEqual(runtime.webGPUSupport(null, true), { available: false, reason: 'webgpu-unavailable' });
  assert.deepEqual(runtime.webGPUSupport({ gpu: { requestAdapter() {} } }, false), { available: false, reason: 'secure-context-required' });
  assert.deepEqual(runtime.webGPUSupport({ gpu: { requestAdapter() {} } }, true), { available: true, reason: 'available' });
});

test('adapter selection prefers compatibility mode and falls back to core', async () => {
  const calls = [];
  const compatibility = { name: 'compat' };
  const gpu = { async requestAdapter(options) { calls.push(options); return compatibility; } };
  const selected = await runtime.requestBestAdapter(gpu, { powerPreference: 'low-power' });
  assert.equal(selected.adapter, compatibility);
  assert.equal(selected.featureLevel, 'compatibility');
  assert.equal(calls[0].featureLevel, 'compatibility');

  const fallbackCalls = [];
  const core = { name: 'core' };
  const fallbackGpu = {
    async requestAdapter(options) {
      fallbackCalls.push(options);
      if (options.featureLevel === 'compatibility') throw new Error('unsupported dictionary value');
      return core;
    }
  };
  const fallback = await runtime.requestBestAdapter(fallbackGpu, {});
  assert.equal(fallback.adapter, core);
  assert.equal(fallback.featureLevel, 'core');
  assert.equal(fallbackCalls.length, 2);
});

test('createRuntime only requests optional features exposed by adapter', async () => {
  const requested = [];
  const device = {
    limits: { maxBufferSize: 1, maxStorageBufferBindingSize: 2, maxComputeWorkgroupSizeX: 3 },
    lost: Promise.resolve({ reason: 'destroyed', message: '' })
  };
  const adapter = {
    features: new Set(['shader-f16', 'core-features-and-limits']),
    async requestDevice(options) { requested.push(options); return device; }
  };
  const navigatorLike = { gpu: { async requestAdapter() { return adapter; } } };
  const created = await runtime.createRuntime({ navigatorLike, secureContext: true, preferFloat16: true });
  assert.equal(created.backend, 'webgpu');
  assert.deepEqual(requested[0].requiredFeatures.sort(), ['core-features-and-limits', 'shader-f16']);
  assert.equal(created.capabilities.limits.maxComputeWorkgroupSizeX, 3);
});

test('async timeout utility resolves fast work and rejects stalled initialization', async () => {
  assert.equal(await asyncUtils.withTimeout(Promise.resolve('ready'), 50, 'timeout'), 'ready');
  const never = new Promise(() => {});
  await assert.rejects(asyncUtils.withTimeout(never, 5, 'webgpu-initialization-timeout'), error => error.code === 'webgpu-initialization-timeout');
});

test('client terminates an unresponsive WebGPU worker and retries in a forced-WASM worker', async () => {
  const workers = [];
  class FakeWorker {
    constructor(url) {
      this.url = url;
      this.terminated = false;
      workers.push(this);
    }
    postMessage(message) {
      if (!this.url.includes('visionBackend=wasm')) return;
      setTimeout(() => this.onmessage({
        data: {
          id: message.id,
          ok: true,
          type: 'classify-image',
          backend: 'wasm',
          fallbackReason: 'webgpu-worker-timeout',
          predictions: [{ label: 'screen', score: 0.8 }]
        }
      }), 0);
    }
    terminate() { this.terminated = true; }
  }
  const source = fs.readFileSync(path.resolve(__dirname, '../../assets/local-ai/client.js'), 'utf8');
  const context = { Worker: FakeWorker, Blob, setTimeout, clearTimeout };
  vm.runInNewContext(source, context);
  const client = new context.LocalAIClient({
    workerFactory: url => new FakeWorker(url),
    webGPUWorkerTimeoutMs: 10,
    modelTimeoutMs: 100
  });
  const result = await client.classifyImage(new Blob(['x'], { type: 'image/png' }));
  assert.equal(workers.length, 2);
  assert.equal(workers[0].terminated, true);
  assert.match(workers[1].url, /visionBackend=wasm/);
  assert.equal(result.backend, 'wasm');
  assert.equal(result.fallbackReason, 'webgpu-worker-timeout');
  client.close();
});

test('human and AI handbook keeps the durable project foundations present and linked', () => {
  const root = path.resolve(__dirname, '../..');
  const required = [
    'docs/README.md',
    'docs/01-purpose/mission-and-vision.md',
    'docs/01-purpose/principles.md',
    'docs/01-purpose/project-continuity.md',
    'docs/03-architecture/architecture-overview.md',
    'docs/03-architecture/hld.md',
    'docs/03-architecture/lld.md',
    'docs/03-architecture/local-ai-models.md',
    'docs/04-testing/testing-architecture-and-strategy.md',
    'docs/04-testing/test-results.md',
    'docs/05-development/adding-a-new-tool.md'
  ];
  for (const relative of required) assert.ok(fs.existsSync(path.join(root, relative)), `${relative} should exist`);

  const index = fs.readFileSync(path.join(root, 'docs/README.md'), 'utf8');
  for (const relative of required.slice(1)) {
    const fromDocs = relative.replace(/^docs\//, '');
    assert.match(index, new RegExp(fromDocs.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${relative} should be linked from docs/README.md`);
  }

  const mission = fs.readFileSync(path.join(root, 'docs/01-purpose/mission-and-vision.md'), 'utf8');
  assert.match(mission, /Democratize useful digital tools/i);
  assert.match(mission, /Your files never leave your machine/);
  assert.match(mission, /Offline is an earned property/);

  const principles = fs.readFileSync(path.join(root, 'docs/01-purpose/principles.md'), 'utf8');
  assert.match(principles, /No advertising as a product dependency/);
  assert.match(principles, /No unnecessary accounts/);
  assert.match(principles, /Privacy is architecture/);

  const continuity = fs.readFileSync(path.join(root, 'docs/01-purpose/project-continuity.md'), 'utf8');
  assert.match(continuity, /should not depend on the continued involvement of its founder/i);
  assert.match(continuity, /baseline\/clean-local-tools-ci-v1/);

  const modelDoc = fs.readFileSync(path.join(root, 'docs/03-architecture/local-ai-models.md'), 'utf8');
  assert.match(modelDoc, /mobilenetv4_conv_small\.e2400_r224_in1k/);
  assert.match(modelDoc, /Pinned framework version: `3\.8\.1`/);
  assert.match(modelDoc, /No remote inference service is used as a fallback/);

  const testing = fs.readFileSync(path.join(root, 'docs/04-testing/testing-architecture-and-strategy.md'), 'utf8');
  assert.match(testing, /Every meaningful production change/);
  assert.match(testing, /Chromium/);
  assert.match(testing, /WebKit/);
  assert.match(testing, /privacy regression testing/i);
});
