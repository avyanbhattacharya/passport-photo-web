(function (root, factory) {
  const api = factory(root.LocalAIWebGPU);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LocalAIModelAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (runtime) {
  'use strict';

  const VERSION = '0.1.0';
  const FOUNDATION_MODEL = Object.freeze({
    id: 'clean-local-tools-foundation-mlp-v1',
    task: 'foundation-classification-probe',
    input: Object.freeze({ type: 'float32', shape: Object.freeze([4]) }),
    output: Object.freeze({ type: 'probabilities', classes: 3 }),
    localOnly: true,
    experimental: true
  });

  function requireRuntime() {
    if (!runtime) throw new Error('local-ai-runtime-unavailable');
    return runtime;
  }

  function describe(modelId) {
    if (!modelId || modelId === FOUNDATION_MODEL.id) return FOUNDATION_MODEL;
    throw new Error(`unknown-local-model:${modelId}`);
  }

  function createFoundationAdapter(options) {
    const opts = options || {};
    const localRuntime = opts.runtime || requireRuntime();
    const model = describe(opts.modelId);
    return Object.freeze({
      model,
      async infer(input, context) {
        const ctx = context || {};
        if (ctx.backend === 'webgpu' && ctx.device) {
          const result = await localRuntime.inferWebGPU(ctx.device, input);
          return { model: model.id, backend: 'webgpu', ...result };
        }
        const result = localRuntime.inferCPU(input);
        return { model: model.id, backend: 'cpu-js', ...result };
      }
    });
  }

  return Object.freeze({ VERSION, FOUNDATION_MODEL, describe, createFoundationAdapter });
});
