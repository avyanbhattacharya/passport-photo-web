const test = require('node:test');
const assert = require('node:assert/strict');
const vision = require('../../assets/local-ai/vision-model-adapter.js');

test('vision model metadata is pinned, local-only, and explicit about first-use downloads', () => {
  assert.equal(vision.TRANSFORMERS_VERSION, '3.8.1');
  assert.match(vision.TRANSFORMERS_MODULE_URL, /@huggingface\/transformers@3\.8\.1/);
  assert.equal(vision.MODEL.id, 'onnx-community/mobilenetv4_conv_small.e2400_r224_in1k');
  assert.equal(vision.MODEL.task, 'image-classification');
  assert.equal(vision.MODEL.localOnly, true);
  assert.equal(vision.MODEL.remoteAssetsRequiredOnFirstUse, true);
  assert.equal(vision.MODEL.preferredBackend, 'webgpu');
  assert.equal(vision.MODEL.fallbackBackend, 'wasm');
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
    navigatorLike: { gpu: { requestAdapter() {} } },
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

test('vision adapter initializes WASM directly when WebGPU is unavailable', async () => {
  const loads = [];
  const fakeModule = {
    env: {},
    async pipeline(task, model, options) {
      loads.push(options);
      return async () => [{ label: 'document', score: 0.7 }];
    }
  };
  const adapter = vision.createVisionAdapter({ moduleLoader: async () => fakeModule, navigatorLike: {}, secureContext: true });
  const result = await adapter.classify(new Blob(['x'], { type: 'image/png' }));
  assert.equal(result.backend, 'wasm');
  assert.equal(loads.length, 1);
  assert.equal(loads[0].device, 'wasm');
  assert.equal(loads[0].dtype, 'q8');
  assert.equal(result.fallbackReason, 'webgpu-unavailable');
});

test('vision adapter falls back to WASM when WebGPU model initialization fails', async () => {
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
    navigatorLike: { gpu: { requestAdapter() {} } },
    secureContext: true
  });
  const result = await adapter.classify(new Blob(['x'], { type: 'image/png' }));
  assert.deepEqual(loads, ['webgpu', 'wasm']);
  assert.equal(result.backend, 'wasm');
  assert.equal(result.fallbackReason, 'gpu-model-load-failed');
});

test('vision adapter retries on WASM if WebGPU inference fails after loading', async () => {
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
    navigatorLike: { gpu: { requestAdapter() {} } },
    secureContext: true
  });
  const result = await adapter.classify(new Blob(['x'], { type: 'image/jpeg' }));
  assert.deepEqual(loads, ['webgpu', 'wasm']);
  assert.equal(result.backend, 'wasm');
  assert.equal(result.fallbackReason, 'gpu-inference-failed');
});

test('vision adapter rejects non-image-like inputs and caps top-k output', async () => {
  const fakeModule = {
    env: {},
    async pipeline() {
      return async () => Array.from({ length: 20 }, (_, index) => ({ label: `label-${index}`, score: 1 / (index + 1) }));
    }
  };
  const adapter = vision.createVisionAdapter({ moduleLoader: async () => fakeModule, navigatorLike: {}, secureContext: true });
  await assert.rejects(adapter.classify('not-a-blob'), /image Blob or File/);
  const result = await adapter.classify(new Blob(['x'], { type: 'image/png' }), { topK: 99 });
  assert.equal(result.predictions.length, 10);
});
