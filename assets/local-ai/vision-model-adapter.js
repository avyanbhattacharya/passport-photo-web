(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LocalAIVisionModelAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.2.0';
  const TRANSFORMERS_VERSION = '3.8.1';
  const TRANSFORMERS_MODULE_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}`;
  const MODEL = Object.freeze({
    id: 'onnx-community/mobilenetv4_conv_small.e2400_r224_in1k',
    task: 'image-classification',
    input: 'image-blob',
    localOnly: true,
    experimental: true,
    framework: 'transformers.js',
    frameworkVersion: TRANSFORMERS_VERSION,
    remoteAssetsRequiredOnFirstUse: true,
    preferredBackend: 'webgpu',
    fallbackBackend: 'wasm'
  });

  function supportsWebGPU(navigatorLike, secureContext) {
    const nav = navigatorLike || null;
    return secureContext !== false && !!(nav && nav.gpu && typeof nav.gpu.requestAdapter === 'function');
  }

  async function probeWebGPU(navigatorLike, secureContext, timeoutMs) {
    if (!supportsWebGPU(navigatorLike, secureContext)) {
      return { usable: false, reason: secureContext === false ? 'secure-context-required' : 'webgpu-unavailable' };
    }
    const waitMs = Math.max(100, Number(timeoutMs || 2000));
    let timer;
    try {
      const timeout = new Promise(resolve => {
        timer = setTimeout(() => resolve({ timedOut: true }), waitMs);
      });
      const adapterAttempt = Promise.resolve()
        .then(() => navigatorLike.gpu.requestAdapter({ powerPreference: 'high-performance' }))
        .then(adapter => ({ adapter }))
        .catch(error => ({ error }));
      const result = await Promise.race([adapterAttempt, timeout]);
      if (result && result.timedOut) return { usable: false, reason: 'webgpu-adapter-timeout' };
      if (result && result.error) return { usable: false, reason: result.error.message || 'webgpu-adapter-failed' };
      if (!result || !result.adapter) return { usable: false, reason: 'webgpu-adapter-unavailable' };
      return { usable: true, reason: 'available' };
    } finally {
      clearTimeout(timer);
    }
  }

  async function defaultModuleLoader(url) {
    return import(url);
  }

  function validateImageInput(input) {
    if (typeof Blob !== 'undefined' && input instanceof Blob) return input;
    if (input && typeof input === 'object' && typeof input.arrayBuffer === 'function' && typeof input.type === 'string') return input;
    throw new TypeError('Vision model input must be an image Blob or File.');
  }

  function normalizePredictions(output, topK) {
    const predictions = Array.isArray(output) ? output : [];
    return predictions.slice(0, topK).map(item => ({
      label: String(item.label || ''),
      score: Number(item.score || 0)
    }));
  }

  function createVisionAdapter(options) {
    const opts = options || {};
    const moduleLoader = opts.moduleLoader || defaultModuleLoader;
    const moduleUrl = opts.moduleUrl || TRANSFORMERS_MODULE_URL;
    const navigatorLike = Object.prototype.hasOwnProperty.call(opts, 'navigatorLike') ? opts.navigatorLike : (typeof navigator !== 'undefined' ? navigator : null);
    const secureContext = Object.prototype.hasOwnProperty.call(opts, 'secureContext') ? opts.secureContext : (typeof isSecureContext === 'boolean' ? isSecureContext : true);
    const preferWebGPU = opts.preferWebGPU !== false;
    const webGPUProbeTimeoutMs = opts.webGPUProbeTimeoutMs || 2000;
    const modelId = opts.modelId || MODEL.id;
    let modulePromise = null;
    let classifierPromise = null;
    let activeBackend = null;
    let lastFallbackReason = null;

    async function loadModule() {
      if (!modulePromise) modulePromise = Promise.resolve(moduleLoader(moduleUrl));
      const loaded = await modulePromise;
      if (!loaded || typeof loaded.pipeline !== 'function') throw new Error('transformers-pipeline-unavailable');
      if (loaded.env) loaded.env.allowLocalModels = false;
      return loaded;
    }

    async function buildPipeline(backend) {
      const loaded = await loadModule();
      const pipelineOptions = backend === 'webgpu'
        ? { device: 'webgpu', dtype: 'fp32' }
        : { device: 'wasm', dtype: 'q8' };
      const classifier = await loaded.pipeline(MODEL.task, modelId, pipelineOptions);
      activeBackend = backend;
      return classifier;
    }

    async function getClassifier() {
      if (classifierPromise) return classifierPromise;
      classifierPromise = (async () => {
        if (preferWebGPU) {
          const probe = await probeWebGPU(navigatorLike, secureContext, webGPUProbeTimeoutMs);
          if (probe.usable) {
            try {
              return await buildPipeline('webgpu');
            } catch (error) {
              lastFallbackReason = error && (error.message || error.code) ? (error.message || error.code) : 'webgpu-model-initialization-failed';
            }
          } else {
            lastFallbackReason = probe.reason;
          }
        } else {
          lastFallbackReason = 'webgpu-disabled';
        }
        return buildPipeline('wasm');
      })();
      return classifierPromise;
    }

    async function switchToWasm(reason) {
      lastFallbackReason = reason || 'webgpu-inference-failed';
      classifierPromise = Promise.resolve(buildPipeline('wasm'));
      return classifierPromise;
    }

    return Object.freeze({
      model: MODEL,
      status() {
        return {
          model: modelId,
          task: MODEL.task,
          backend: activeBackend || 'not-loaded',
          preferredBackend: MODEL.preferredBackend,
          fallbackBackend: MODEL.fallbackBackend,
          localOnly: true,
          remoteAssetsRequiredOnFirstUse: true,
          fallbackReason: lastFallbackReason,
          framework: MODEL.framework,
          frameworkVersion: MODEL.frameworkVersion
        };
      },
      async classify(input, options) {
        const image = validateImageInput(input);
        const topK = Math.min(10, Math.max(1, Number((options || {}).topK || 5)));
        let classifier = await getClassifier();
        try {
          const output = await classifier(image, { top_k: topK });
          return {
            model: modelId,
            task: MODEL.task,
            backend: activeBackend,
            localOnly: true,
            predictions: normalizePredictions(output, topK),
            fallbackReason: lastFallbackReason
          };
        } catch (error) {
          if (activeBackend !== 'webgpu') throw error;
          classifier = await switchToWasm(error && error.message ? error.message : 'webgpu-inference-failed');
          const output = await classifier(image, { top_k: topK });
          return {
            model: modelId,
            task: MODEL.task,
            backend: 'wasm',
            localOnly: true,
            predictions: normalizePredictions(output, topK),
            fallbackReason: lastFallbackReason
          };
        }
      }
    });
  }

  return Object.freeze({ VERSION, MODEL, TRANSFORMERS_VERSION, TRANSFORMERS_MODULE_URL, supportsWebGPU, probeWebGPU, validateImageInput, normalizePredictions, createVisionAdapter });
});
