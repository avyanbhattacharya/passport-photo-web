(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LocalAIVisionModelAdapter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.6.0';
  const TRANSFORMERS_VERSION = '3.8.1';
  const TRANSFORMERS_MODULE_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}`;
  const UNSUPPORTED_CODE = 'local-ai-device-not-supported';
  const DEFAULT_WEBGPU_INITIALIZATION_TIMEOUT_MS = 30000;
  const DEFAULT_WEBGPU_INFERENCE_TIMEOUT_MS = 30000;
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
    fallbackBackend: 'wasm',
    executionPolicy: Object.freeze({
      fallbackMode: 'desktop-only',
      unsupportedCode: UNSUPPORTED_CODE,
      principle: 'local-first-does-not-mean-run-at-any-cost'
    })
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

  function detectDeviceClass(navigatorLike, explicitDeviceClass) {
    if (explicitDeviceClass === 'desktop' || explicitDeviceClass === 'mobile') return explicitDeviceClass;
    const nav = navigatorLike || null;
    if (nav && nav.userAgentData && typeof nav.userAgentData.mobile === 'boolean') return nav.userAgentData.mobile ? 'mobile' : 'desktop';
    return 'unknown';
  }

  function decideExecution(probe, deviceClass, policy) {
    const currentPolicy = policy || MODEL.executionPolicy;
    if (probe && probe.usable) return { supported: true, backend: 'webgpu', reason: 'available', deviceClass };
    const reason = probe && probe.reason ? probe.reason : 'webgpu-unavailable';
    if (currentPolicy.fallbackMode === 'always') return { supported: true, backend: 'wasm', reason, deviceClass };
    if (currentPolicy.fallbackMode === 'desktop-only' && deviceClass === 'desktop') return { supported: true, backend: 'wasm', reason, deviceClass };
    return {
      supported: false,
      backend: null,
      reason,
      deviceClass,
      code: currentPolicy.unsupportedCode || UNSUPPORTED_CODE
    };
  }

  function unsupportedError(decision) {
    const error = new Error('This AI feature is not supported on this device yet. It requires browser hardware acceleration to run privately and efficiently.');
    error.code = decision.code || UNSUPPORTED_CODE;
    error.reason = decision.reason || 'unsupported-execution-policy';
    error.deviceClass = decision.deviceClass || 'unknown';
    return error;
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

  function withTimeout(promise, timeoutMs, code) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(code);
        error.code = code;
        reject(error);
      }, timeoutMs);
    });
    return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
  }

  function createVisionAdapter(options) {
    const opts = options || {};
    const moduleLoader = opts.moduleLoader || defaultModuleLoader;
    const moduleUrl = opts.moduleUrl || TRANSFORMERS_MODULE_URL;
    const navigatorLike = Object.prototype.hasOwnProperty.call(opts, 'navigatorLike') ? opts.navigatorLike : (typeof navigator !== 'undefined' ? navigator : null);
    const secureContext = Object.prototype.hasOwnProperty.call(opts, 'secureContext') ? opts.secureContext : (typeof isSecureContext === 'boolean' ? isSecureContext : true);
    const preferWebGPU = opts.preferWebGPU !== false;
    const webGPUDisabledReason = opts.webGPUDisabledReason || 'webgpu-disabled';
    const webGPUProbeTimeoutMs = opts.webGPUProbeTimeoutMs || 2000;
    const modelId = opts.modelId || MODEL.id;
    const deviceClass = detectDeviceClass(navigatorLike, opts.deviceClass);
    const executionPolicy = opts.executionPolicy || MODEL.executionPolicy;
    const configuredInitializationTimeoutMs = Number(opts.webGPUInitializationTimeoutMs);
    const webGPUInitializationTimeoutMs = configuredInitializationTimeoutMs > 0
      ? configuredInitializationTimeoutMs
      : DEFAULT_WEBGPU_INITIALIZATION_TIMEOUT_MS;
    const configuredInferenceTimeoutMs = Number(opts.webGPUInferenceTimeoutMs);
    const webGPUInferenceTimeoutMs = configuredInferenceTimeoutMs > 0
      ? configuredInferenceTimeoutMs
      : DEFAULT_WEBGPU_INFERENCE_TIMEOUT_MS;
    let modulePromise = null;
    let classifierPromise = null;
    let activeBackend = null;
    let lastFallbackReason = null;
    let lastDecision = null;

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
      const pipelinePromise = loaded.pipeline(MODEL.task, modelId, pipelineOptions);
      const classifier = backend === 'webgpu'
        ? await withTimeout(
          pipelinePromise,
          webGPUInitializationTimeoutMs,
          'webgpu-model-initialization-timeout'
        )
        : await pipelinePromise;
      activeBackend = backend;
      return classifier;
    }

    async function compatibility() {
      const probe = preferWebGPU
        ? await probeWebGPU(navigatorLike, secureContext, webGPUProbeTimeoutMs)
        : { usable: false, reason: webGPUDisabledReason };
      lastDecision = decideExecution(probe, deviceClass, executionPolicy);
      return { ...lastDecision, fallbackMode: executionPolicy.fallbackMode };
    }

    async function getClassifier() {
      if (classifierPromise) return classifierPromise;
      classifierPromise = (async () => {
        const decision = await compatibility();
        if (!decision.supported) throw unsupportedError(decision);
        if (decision.backend === 'webgpu') {
          try {
            return await buildPipeline('webgpu');
          } catch (error) {
            lastFallbackReason = error && (error.message || error.code) ? (error.message || error.code) : 'webgpu-model-initialization-failed';
            const fallbackDecision = decideExecution({ usable: false, reason: lastFallbackReason }, deviceClass, executionPolicy);
            lastDecision = fallbackDecision;
            if (!fallbackDecision.supported || fallbackDecision.backend !== 'wasm') throw unsupportedError(fallbackDecision);
          }
        } else {
          lastFallbackReason = decision.reason;
        }
        return buildPipeline('wasm');
      })();
      return classifierPromise;
    }

    async function switchToWasm(reason) {
      lastFallbackReason = reason || 'webgpu-inference-failed';
      const fallbackDecision = decideExecution({ usable: false, reason: lastFallbackReason }, deviceClass, executionPolicy);
      lastDecision = fallbackDecision;
      if (!fallbackDecision.supported || fallbackDecision.backend !== 'wasm') throw unsupportedError(fallbackDecision);
      classifierPromise = Promise.resolve(buildPipeline('wasm'));
      return classifierPromise;
    }

    return Object.freeze({
      model: MODEL,
      compatibility,
      status() {
        return {
          model: modelId,
          task: MODEL.task,
          backend: activeBackend || 'not-loaded',
          preferredBackend: MODEL.preferredBackend,
          fallbackBackend: MODEL.fallbackBackend,
          fallbackMode: executionPolicy.fallbackMode,
          executionPolicy: preferWebGPU ? 'gpu-preferred' : 'fallback-only',
          deviceClass,
          supported: lastDecision ? lastDecision.supported : null,
          supportReason: lastDecision ? lastDecision.reason : null,
          policyDecision: lastDecision ? (lastDecision.supported ? lastDecision.backend : 'unsupported') : null,
          policyReason: lastDecision ? lastDecision.reason : null,
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
          const output = activeBackend === 'webgpu'
            ? await withTimeout(
              classifier(image, { top_k: topK }),
              webGPUInferenceTimeoutMs,
              'webgpu-inference-timeout'
            )
            : await classifier(image, { top_k: topK });
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
          const failureReason = error && (error.code || error.message)
            ? (error.code || error.message)
            : 'webgpu-inference-failed';
          classifier = await switchToWasm(failureReason);
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

  return Object.freeze({ VERSION, MODEL, UNSUPPORTED_CODE, DEFAULT_WEBGPU_INITIALIZATION_TIMEOUT_MS, DEFAULT_WEBGPU_INFERENCE_TIMEOUT_MS, TRANSFORMERS_VERSION, TRANSFORMERS_MODULE_URL, supportsWebGPU, probeWebGPU, detectDeviceClass, decideExecution, unsupportedError, validateImageInput, normalizePredictions, withTimeout, createVisionAdapter });
});
