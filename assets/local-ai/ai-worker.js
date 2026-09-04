importScripts('./webgpu-runtime.js');

const WEBGPU_INIT_TIMEOUT_MS = 2500;
let runtimePromise = null;
let runtimeState = { backend: 'cpu-js', reason: 'not-initialized', capabilities: {} };

function withTimeout(promise, timeoutMs, code) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(code);
      error.code = code;
      reject(error);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function initialize() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    const support = LocalAIWebGPU.webGPUSupport(navigator, self.isSecureContext);
    if (!support.available) {
      runtimeState = { backend: 'cpu-js', reason: support.reason, capabilities: {} };
      return runtimeState;
    }
    try {
      const runtime = await withTimeout(
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
      const result = await LocalAIWebGPU.inferWebGPU(state.runtime.device, input);
      return { backend: 'webgpu', ...result };
    } catch (error) {
      runtimeState = { backend: 'cpu-js', reason: error.message || 'webgpu-inference-failed', capabilities: state.capabilities };
    }
  }
  return { backend: 'cpu-js', ...LocalAIWebGPU.inferCPU(input) };
}

self.onmessage = async event => {
  const message = event.data || {};
  const id = message.id;
  try {
    if (message.type === 'status') {
      const state = await initialize();
      self.postMessage({ id, ok: true, type: 'status', backend: state.backend, reason: state.reason, capabilities: state.capabilities, version: LocalAIWebGPU.VERSION, model: LocalAIWebGPU.MODEL.id });
      return;
    }
    if (message.type === 'infer') {
      const result = await infer(message.input);
      self.postMessage({ id, ok: true, type: 'infer', ...result, model: LocalAIWebGPU.MODEL.id });
      return;
    }
    throw new Error('unknown-worker-message');
  } catch (error) {
    self.postMessage({ id, ok: false, error: error.message || String(error) });
  }
};
