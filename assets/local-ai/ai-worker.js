importScripts('./webgpu-runtime.js', './async-utils.js', './model-adapter.js', './vision-model-adapter.js');

const WEBGPU_INIT_TIMEOUT_MS = 2500;
const modelAdapter = LocalAIModelAdapter.createFoundationAdapter();
const visionAdapter = LocalAIVisionModelAdapter.createVisionAdapter({ navigatorLike: navigator, secureContext: self.isSecureContext });
let runtimePromise = null;
let runtimeState = { backend: 'cpu-js', reason: 'not-initialized', capabilities: {} };

async function initialize() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    const support = LocalAIWebGPU.webGPUSupport(navigator, self.isSecureContext);
    if (!support.available) {
      runtimeState = { backend: 'cpu-js', reason: support.reason, capabilities: {} };
      return runtimeState;
    }
    try {
      const runtime = await LocalAIAsync.withTimeout(
        LocalAIWebGPU.createRuntime({ navigatorLike: navigator, secureContext: self.isSecureContext }),
        WEBGPU_INIT_TIMEOUT_MS,
        'webgpu-initialization-timeout'
      );
      runtimeState = {
        backend: 'webgpu',
        reason: 'available',
        capabilities: runtime.capabilities,
        runtime
      };
      return runtimeState;
    } catch (error) {
      runtimeState = { backend: 'cpu-js', reason: error.code || error.message || 'webgpu-initialization-failed', capabilities: {} };
      return runtimeState;
    }
  })();
  return runtimePromise;
}

async function infer(input) {
  const state = await initialize();
  if (state.backend === 'webgpu') {
    try {
      return await modelAdapter.infer(input, { backend: 'webgpu', device: state.runtime.device });
    } catch (error) {
      runtimeState = { backend: 'cpu-js', reason: error.message || 'webgpu-inference-failed', capabilities: state.capabilities };
    }
  }
  return modelAdapter.infer(input, { backend: 'cpu-js' });
}

self.onmessage = async event => {
  const message = event.data || {};
  const id = message.id;
  try {
    if (message.type === 'status') {
      const state = await initialize();
      self.postMessage({
        id,
        ok: true,
        type: 'status',
        backend: state.backend,
        reason: state.reason,
        capabilities: state.capabilities,
        version: LocalAIWebGPU.VERSION,
        adapterVersion: LocalAIModelAdapter.VERSION,
        model: modelAdapter.model.id,
        task: modelAdapter.model.task,
        localOnly: modelAdapter.model.localOnly
      });
      return;
    }
    if (message.type === 'infer') {
      const result = await infer(message.input);
      self.postMessage({ id, ok: true, type: 'infer', ...result, task: modelAdapter.model.task, localOnly: modelAdapter.model.localOnly });
      return;
    }
    if (message.type === 'vision-status') {
      const compatibility = await visionAdapter.compatibility();
      self.postMessage({
        id,
        ok: true,
        type: 'vision-status',
        adapterVersion: LocalAIVisionModelAdapter.VERSION,
        compatibility,
        ...visionAdapter.status()
      });
      return;
    }
    if (message.type === 'classify-image') {
      const result = await visionAdapter.classify(message.image, { topK: message.topK });
      self.postMessage({ id, ok: true, type: 'classify-image', ...result });
      return;
    }
    throw new Error('unknown-worker-message');
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error.message || String(error),
      code: error.code || 'local-ai-worker-error',
      reason: error.reason || null,
      deviceClass: error.deviceClass || null
    });
  }
};
