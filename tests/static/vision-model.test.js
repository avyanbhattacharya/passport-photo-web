const test = require('node:test');
const assert = require('node:assert/strict');
const vision = require('../../assets/local-ai/vision-model-adapter.js');

test('vision model metadata is pinned, local-only, and explicit about compute policy', () => {
  assert.equal(vision.TRANSFORMERS_VERSION, '3.8.1');
  assert.match(vision.TRANSFORMERS_MODULE_URL, /@huggingface\/transformers@3\.8\.1/);
  assert.equal(vision.MODEL.id, 'onnx-community/mobilenetv4_conv_small.e2400_r224_in1k');
  assert.equal(vision.MODEL.task, 'image-classification');
  assert.equal(vision.MODEL.localOnly, true);
  assert.equal(vision.MODEL.remoteAssetsRequiredOnFirstUse, true);
  assert.equal(vision.MODEL.preferredBackend, 'webgpu');
  assert.equal(vision.MODEL.fallbackBackend, 'wasm');
  assert.equal(vision.MODEL.executionPolicy.fallbackMode, 'desktop-only');
  assert.equal(vision.MODEL.executionPolicy.unsupportedCode, 'local-ai-device-not-supported');
  assert.equal(vision.DEFAULT_WEBGPU_INITIALIZATION_TIMEOUT_MS, 30000);
  assert.equal(vision.DEFAULT_WEBGPU_INFERENCE_TIMEOUT_MS, 30000);
});

test('WebGPU preflight requires an actual adapter, not merely navigator.gpu', async () => {
  assert.deepEqual(await vision.probeWebGPU({}, true), { usable: false, reason: 'webgpu-unavailable' });
  assert.deepEqual(await vision.probeWebGPU({ gpu: { async requestAdapter() { return null; } } }, true), { usable: false, reason: 'webgpu-adapter-unavailable' });
  assert.deepEqual(await vision.probeWebGPU({ gpu: { async requestAdapter() { return { name: 'adapter' }; } } }, true), { usable: true, reason: 'available' });
});

test('execution policy prefers WebGPU, permits certified desktop fallback, and rejects unsafe fallback', () => {
  assert.equal(vision.detectDeviceClass({ userAgentData: { mobile: false } }), 'desktop');
  assert.equal(vision.detectDeviceClass({ userAgentData: { mobile: true } }), 'mobile');
  assert.equal(vision.detectDeviceClass({}), 'unknown');

  const gpu = vision.decideExecution({ usable: true, reason: 'available' }, 'mobile', vision.MODEL.executionPolicy);
  assert.deepEqual(gpu, { supported: true, backend: 'webgpu', reason: 'available', deviceClass: 'mobile' });

  const desktopFallback = vision.decideExecution({ usable: false, reason: 'webgpu-unavailable' }, 'desktop', vision.MODEL.executionPolicy);
  assert.equal(desktopFallback.supported, true);
  assert.equal(desktopFallback.backend, 'wasm');

  const mobileFallback = vision.decideExecution({ usable: false, reason: 'webgpu-unavailable' }, 'mobile', vision.MODEL.executionPolicy);
  assert.equal(mobileFallback.supported, false);
  assert.equal(mobileFallback.backend, null);
  assert.equal(mobileFallback.code, vision.UNSUPPORTED_CODE);

  const unknownFallback = vision.decideExecution({ usable: false, reason: 'webgpu-unavailable' }, 'unknown', vision.MODEL.executionPolicy);
  assert.equal(unknownFallback.supported, false);
  assert.equal(unknownFallback.code, vision.UNSUPPORTED_CODE);
});

test('vision adapter prefers WebGPU and passes the local Blob directly to the pipeline', async () => {
  const calls = [];
  const image = new Blob(['fake-image'], { type: 'image/jpeg' });
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      calls.push({ phase: 'load', task, model, options });
      return async (input, runOptions) => {
        calls.push({ phase: 'infer', input, runOptions });
        return [{ label: 'tiger', score: 0.9 }, { label: 'cat', score: 0.08 }];
      };
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    navigatorLike: { userAgentData: { mobile: true }, gpu: { async requestAdapter() { return { name: 'test-adapter' }; } } },
    secureContext: true
  });
  const result = await adapter.classify(image, { topK: 2 });
  assert.equal(result.backend, 'webgpu');
  assert.equal(result.localOnly, true);
  assert.deepEqual(result.predictions, [{ label: 'tiger', score: 0.9 }, { label: 'cat', score: 0.08 }]);
  assert.equal(calls[0].options.device, 'webgpu');
  assert.equal(calls[1].input, image);
  assert.equal(calls[1].runOptions.top_k, 2);
});

test('vision adapter initializes WASM directly only for a certified desktop fallback', async () => {
  const loads = [];
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      loads.push(options);
      return async () => [{ label: 'document', score: 0.7 }];
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    navigatorLike: { userAgentData: { mobile: false } },
    secureContext: true
  });
  const compatibility = await adapter.compatibility();
  assert.equal(compatibility.supported, true);
  assert.equal(compatibility.backend, 'wasm');
  assert.equal(compatibility.deviceClass, 'desktop');
  const result = await adapter.classify(new Blob(['x'], { type: 'image/png' }));
  assert.equal(result.backend, 'wasm');
  assert.equal(loads.length, 1);
  assert.equal(loads[0].device, 'wasm');
  assert.equal(loads[0].dtype, 'q8');
  assert.equal(result.fallbackReason, 'webgpu-unavailable');
});

test('forced desktop worker preserves the supervisor timeout as its fallback reason', async () => {
  const fakeModule = {
    env: {},
    async pipeline() { return async () => [{ label: 'screen', score: 0.9 }]; }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    deviceClass: 'desktop',
    navigatorLike: {},
    preferWebGPU: false,
    webGPUDisabledReason: 'webgpu-worker-timeout'
  });
  const result = await adapter.classify(new Blob(['x'], { type: 'image/png' }));
  assert.equal(result.backend, 'wasm');
  assert.equal(result.fallbackReason, 'webgpu-worker-timeout');
});

test('vision adapter rejects CPU/WASM fallback on mobile instead of running at any cost', async () => {
  let modelLoaded = false;
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => {
      modelLoaded = true;
      return { env: {}, async pipeline() { throw new Error('should-not-load'); } };
    },
    navigatorLike: { userAgentData: { mobile: true } },
    secureContext: true
  });
  const compatibility = await adapter.compatibility();
  assert.equal(compatibility.supported, false);
  assert.equal(compatibility.code, vision.UNSUPPORTED_CODE);
  assert.equal(compatibility.deviceClass, 'mobile');
  await assert.rejects(
    adapter.classify(new Blob(['x'], { type: 'image/png' })),
    error => error.code === vision.UNSUPPORTED_CODE && /not supported on this device/i.test(error.message)
  );
  assert.equal(modelLoaded, false);
});

test('unknown device class is conservative when only desktop fallback is certified', async () => {
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => ({ env: {}, async pipeline() { throw new Error('should-not-load'); } }),
    navigatorLike: {},
    secureContext: true
  });
  const compatibility = await adapter.compatibility();
  assert.equal(compatibility.supported, false);
  assert.equal(compatibility.deviceClass, 'unknown');
  assert.equal(compatibility.code, vision.UNSUPPORTED_CODE);
});

test('vision adapter avoids poisoning the runtime when WebGPU adapter is unavailable on desktop', async () => {
  const loads = [];
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      loads.push(options.device);
      return async () => [{ label: 'paper', score: 0.6 }];
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    navigatorLike: { userAgentData: { mobile: false }, gpu: { async requestAdapter() { return null; } } },
    secureContext: true
  });
  const result = await adapter.classify(new Blob(['x'], { type: 'image/png' }));
  assert.deepEqual(loads, ['wasm']);
  assert.equal(result.backend, 'wasm');
  assert.equal(result.fallbackReason, 'webgpu-adapter-unavailable');
});

test('desktop may fall back to WASM when WebGPU model initialization fails', async () => {
  const loads = [];
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      loads.push(options.device);
      if (options.device === 'webgpu') throw new Error('gpu-model-load-failed');
      return async () => [{ label: 'paper', score: 0.6 }];
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    deviceClass: 'desktop',
    navigatorLike: { gpu: { async requestAdapter() { return { name: 'test-adapter' }; } } },
    secureContext: true
  });
  const result = await adapter.classify(new Blob(['x'], { type: 'image/png' }));
  assert.deepEqual(loads, ['webgpu', 'wasm']);
  assert.equal(result.backend, 'wasm');
  assert.equal(result.fallbackReason, 'gpu-model-load-failed');
});

test('mobile does not fall back after WebGPU model initialization failure', async () => {
  const loads = [];
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      loads.push(options.device);
      throw new Error('gpu-model-load-failed');
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    deviceClass: 'mobile',
    navigatorLike: { gpu: { async requestAdapter() { return { name: 'test-adapter' }; } } },
    secureContext: true
  });
  await assert.rejects(adapter.classify(new Blob(['x'], { type: 'image/png' })), error => error.code === vision.UNSUPPORTED_CODE);
  assert.deepEqual(loads, ['webgpu']);
});

test('desktop watchdog falls back to WASM when WebGPU model initialization never settles', async () => {
  const loads = [];
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      loads.push(options.device);
      if (options.device === 'webgpu') return new Promise(() => {});
      return async () => [{ label: 'document', score: 0.75 }];
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    deviceClass: 'desktop',
    webGPUInitializationTimeoutMs: 10,
    navigatorLike: { gpu: { async requestAdapter() { return { name: 'test-adapter' }; } } },
    secureContext: true
  });
  const result = await adapter.classify(new Blob(['x'], { type: 'image/png' }));
  assert.deepEqual(loads, ['webgpu', 'wasm']);
  assert.equal(result.backend, 'wasm');
  assert.equal(result.fallbackReason, 'webgpu-model-initialization-timeout');
});

test('mobile watchdog rejects stalled WebGPU model initialization without WASM', async () => {
  const loads = [];
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      loads.push(options.device);
      return new Promise(() => {});
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    deviceClass: 'mobile',
    webGPUInitializationTimeoutMs: 10,
    navigatorLike: { gpu: { async requestAdapter() { return { name: 'test-adapter' }; } } },
    secureContext: true
  });
  await assert.rejects(
    adapter.classify(new Blob(['x'], { type: 'image/png' })),
    error => error.code === vision.UNSUPPORTED_CODE && error.reason === 'webgpu-model-initialization-timeout'
  );
  assert.deepEqual(loads, ['webgpu']);
});

test('desktop retries on WASM if WebGPU inference fails after loading', async () => {
  const loads = [];
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      loads.push(options.device);
      if (options.device === 'webgpu') return async () => { throw new Error('gpu-inference-failed'); };
      return async () => [{ label: 'screen', score: 0.8 }];
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    deviceClass: 'desktop',
    navigatorLike: { gpu: { async requestAdapter() { return { name: 'test-adapter' }; } } },
    secureContext: true
  });
  const result = await adapter.classify(new Blob(['x'], { type: 'image/jpeg' }));
  assert.deepEqual(loads, ['webgpu', 'wasm']);
  assert.equal(result.backend, 'wasm');
  assert.equal(result.fallbackReason, 'gpu-inference-failed');
});

test('desktop watchdog falls back to WASM when WebGPU inference never settles', async () => {
  const loads = [];
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      loads.push(options.device);
      if (options.device === 'webgpu') return async () => new Promise(() => {});
      return async () => [{ label: 'screen', score: 0.82 }];
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    deviceClass: 'desktop',
    webGPUInferenceTimeoutMs: 10,
    navigatorLike: { gpu: { async requestAdapter() { return { name: 'test-adapter' }; } } },
    secureContext: true
  });
  const result = await adapter.classify(new Blob(['x'], { type: 'image/png' }));
  assert.deepEqual(loads, ['webgpu', 'wasm']);
  assert.equal(result.backend, 'wasm');
  assert.equal(result.fallbackReason, 'webgpu-inference-timeout');
  assert.deepEqual(result.predictions, [{ label: 'screen', score: 0.82 }]);
  const status = adapter.status();
  assert.equal(status.executionPolicy, 'gpu-preferred');
  assert.equal(status.policyDecision, 'wasm');
  assert.equal(status.policyReason, 'webgpu-inference-timeout');
});

test('mobile watchdog does not run unapproved WASM after stalled WebGPU inference', async () => {
  const loads = [];
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      loads.push(options.device);
      return async () => new Promise(() => {});
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    deviceClass: 'mobile',
    webGPUInferenceTimeoutMs: 10,
    navigatorLike: { gpu: { async requestAdapter() { return { name: 'test-adapter' }; } } },
    secureContext: true
  });
  await assert.rejects(
    adapter.classify(new Blob(['x'], { type: 'image/png' })),
    error => error.code === vision.UNSUPPORTED_CODE && error.reason === 'webgpu-inference-timeout'
  );
  assert.deepEqual(loads, ['webgpu']);
});

test('vision adapter rejects non-image-like inputs and caps top-k output', async () => {
  const fakeModule = {
    env: {},
    async pipeline() {
      return async () => Array.from({ length: 20 }, (_, index) => ({ label: `label-${index}`, score: 1 / (index + 1) }));
    }
  };
  const adapter = vision.createVisionAdapter({
    moduleLoader: async () => fakeModule,
    deviceClass: 'desktop',
    navigatorLike: {},
    secureContext: true
  });
  await assert.rejects(adapter.classify('not-a-blob'), /image Blob or File/);
  const result = await adapter.classify(new Blob(['x'], { type: 'image/png' }), { topK: 99 });
  assert.equal(result.predictions.length, 10);
});
