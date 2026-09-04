const test = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../../assets/local-ai/webgpu-runtime.js');
const asyncUtils = require('../../assets/local-ai/async-utils.js');

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
