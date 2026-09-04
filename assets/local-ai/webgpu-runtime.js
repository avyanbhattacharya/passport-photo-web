(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LocalAIWebGPU = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.2.0';
  const INPUT_SIZE = 4;
  const HIDDEN_SIZE = 4;
  const OUTPUT_SIZE = 3;

  const MODEL = Object.freeze({
    id: 'clean-local-tools-foundation-mlp-v1',
    inputSize: INPUT_SIZE,
    hiddenSize: HIDDEN_SIZE,
    outputSize: OUTPUT_SIZE,
    hiddenWeights: Object.freeze([
      0.45, -0.25, 0.15, 0.30,
      -0.10, 0.55, 0.20, -0.35,
      0.25, 0.10, 0.50, -0.20,
      -0.30, 0.20, -0.15, 0.60
    ]),
    hiddenBias: Object.freeze([0.05, -0.02, 0.08, 0.01]),
    outputWeights: Object.freeze([
      0.60, -0.20, 0.25, 0.10,
      -0.15, 0.50, 0.10, 0.35,
      0.20, 0.15, -0.30, 0.55
    ]),
    outputBias: Object.freeze([0.03, -0.01, 0.02])
  });

  function webGPUSupport(navigatorLike, secureContext) {
    const nav = navigatorLike || null;
    if (secureContext === false) return { available: false, reason: 'secure-context-required' };
    if (!nav || !nav.gpu || typeof nav.gpu.requestAdapter !== 'function') return { available: false, reason: 'webgpu-unavailable' };
    return { available: true, reason: 'available' };
  }

  function validateInput(input) {
    if (!Array.isArray(input) && !(input instanceof Float32Array)) throw new TypeError('Model input must be an array of four finite numbers.');
    if (input.length !== INPUT_SIZE) throw new RangeError(`Model input must contain exactly ${INPUT_SIZE} values.`);
    const values = Array.from(input, Number);
    if (!values.every(Number.isFinite)) throw new TypeError('Model input values must be finite numbers.');
    return values;
  }

  function softmax(logits) {
    const max = Math.max(...logits);
    const exp = logits.map(value => Math.exp(value - max));
    const sum = exp.reduce((total, value) => total + value, 0);
    return exp.map(value => value / sum);
  }

  function inferCPU(input) {
    const x = validateInput(input);
    const hidden = new Array(HIDDEN_SIZE).fill(0);
    for (let h = 0; h < HIDDEN_SIZE; h += 1) {
      let value = MODEL.hiddenBias[h];
      for (let i = 0; i < INPUT_SIZE; i += 1) value += x[i] * MODEL.hiddenWeights[h * INPUT_SIZE + i];
      hidden[h] = Math.max(0, value);
    }
    const logits = new Array(OUTPUT_SIZE).fill(0);
    for (let o = 0; o < OUTPUT_SIZE; o += 1) {
      let value = MODEL.outputBias[o];
      for (let h = 0; h < HIDDEN_SIZE; h += 1) value += hidden[h] * MODEL.outputWeights[o * HIDDEN_SIZE + h];
      logits[o] = value;
    }
    return { logits, probabilities: softmax(logits) };
  }

  function summarizeAdapter(adapter, device) {
    return {
      features: adapter && adapter.features ? Array.from(adapter.features).sort() : [],
      limits: device && device.limits ? {
        maxBufferSize: Number(device.limits.maxBufferSize || 0),
        maxStorageBufferBindingSize: Number(device.limits.maxStorageBufferBindingSize || 0),
        maxComputeWorkgroupSizeX: Number(device.limits.maxComputeWorkgroupSizeX || 0)
      } : {}
    };
  }

  async function requestBestAdapter(gpu, options) {
    const opts = options || {};
    const base = { powerPreference: opts.powerPreference || 'high-performance' };
    if (opts.compatibilityMode !== false) {
      try {
        const compatibilityAdapter = await gpu.requestAdapter({ ...base, featureLevel: 'compatibility' });
        if (compatibilityAdapter) return { adapter: compatibilityAdapter, featureLevel: 'compatibility' };
      } catch (_) {
      }
    }
    const adapter = await gpu.requestAdapter(base);
    return { adapter, featureLevel: 'core' };
  }

  async function createRuntime(options) {
    const opts = options || {};
    const navigatorLike = opts.navigatorLike || (typeof navigator !== 'undefined' ? navigator : null);
    const secureContext = Object.prototype.hasOwnProperty.call(opts, 'secureContext') ? opts.secureContext : (typeof isSecureContext === 'boolean' ? isSecureContext : true);
    const support = webGPUSupport(navigatorLike, secureContext);
    if (!support.available) {
      const error = new Error(support.reason);
      error.code = support.reason;
      throw error;
    }
    const selection = await requestBestAdapter(navigatorLike.gpu, opts);
    const adapter = selection.adapter;
    if (!adapter) {
      const error = new Error('webgpu-adapter-unavailable');
      error.code = 'webgpu-adapter-unavailable';
      throw error;
    }
    const requiredFeatures = [];
    if (opts.preferFloat16 && adapter.features && adapter.features.has('shader-f16')) requiredFeatures.push('shader-f16');
    if (adapter.features && adapter.features.has('core-features-and-limits')) requiredFeatures.push('core-features-and-limits');
    const device = await adapter.requestDevice({ requiredFeatures });
    const lost = device.lost.then(info => ({ reason: info.reason, message: info.message || '' }));
    return {
      backend: 'webgpu', adapter, device, requiredFeatures, featureLevel: selection.featureLevel,
      capabilities: summarizeAdapter(adapter, device), lost
    };
  }

  function gpuConstants() {
    const usage = typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage : null;
    const mapMode = typeof GPUMapMode !== 'undefined' ? GPUMapMode : null;
    if (!usage || !mapMode) throw new Error('webgpu-globals-unavailable');
    return { usage, mapMode };
  }

  async function runVectorProbe(device, input) {
    if (!device) throw new TypeError('A GPUDevice is required.');
    const values = input instanceof Float32Array ? input : new Float32Array(input || [1, 2, 3, 4]);
    if (!values.length) throw new RangeError('Probe input cannot be empty.');
    const { usage, mapMode } = gpuConstants();
    const size = values.byteLength;
    const inputBuffer = device.createBuffer({ size, usage: usage.STORAGE | usage.COPY_DST });
    const outputBuffer = device.createBuffer({ size, usage: usage.STORAGE | usage.COPY_SRC });
    const readBuffer = device.createBuffer({ size, usage: usage.COPY_DST | usage.MAP_READ });
    device.queue.writeBuffer(inputBuffer, 0, values);
    const shader = device.createShaderModule({ code: `
      @group(0) @binding(0) var<storage, read> inputData: array<f32>;
      @group(0) @binding(1) var<storage, read_write> outputData: array<f32>;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        let i = id.x;
        if (i < arrayLength(&inputData)) { outputData[i] = inputData[i] * 2.0 + 1.0; }
      }
    ` });
    const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module: shader, entryPoint: 'main' } });
    const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: inputBuffer } }, { binding: 1, resource: { buffer: outputBuffer } }
    ] });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup); pass.dispatchWorkgroups(Math.ceil(values.length / 64)); pass.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, size);
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(mapMode.READ);
    const result = Array.from(new Float32Array(readBuffer.getMappedRange().slice(0)));
    readBuffer.unmap(); inputBuffer.destroy(); outputBuffer.destroy(); readBuffer.destroy();
    return result;
  }

  async function inferWebGPU(device, input) {
    if (!device) throw new TypeError('A GPUDevice is required.');
    const x = new Float32Array(validateInput(input));
    const { usage, mapMode } = gpuConstants();
    const modelData = new Float32Array([...MODEL.hiddenWeights, ...MODEL.hiddenBias, ...MODEL.outputWeights, ...MODEL.outputBias]);
    const inputBuffer = device.createBuffer({ size: x.byteLength, usage: usage.STORAGE | usage.COPY_DST });
    const modelBuffer = device.createBuffer({ size: modelData.byteLength, usage: usage.STORAGE | usage.COPY_DST });
    const outputBuffer = device.createBuffer({ size: OUTPUT_SIZE * 4, usage: usage.STORAGE | usage.COPY_SRC });
    const readBuffer = device.createBuffer({ size: OUTPUT_SIZE * 4, usage: usage.COPY_DST | usage.MAP_READ });
    device.queue.writeBuffer(inputBuffer, 0, x); device.queue.writeBuffer(modelBuffer, 0, modelData);
    const shader = device.createShaderModule({ code: `
      @group(0) @binding(0) var<storage, read> inputData: array<f32>;
      @group(0) @binding(1) var<storage, read> model: array<f32>;
      @group(0) @binding(2) var<storage, read_write> outputData: array<f32>;
      @compute @workgroup_size(1)
      fn main() {
        var hidden: array<f32, 4>;
        for (var h: u32 = 0u; h < 4u; h = h + 1u) {
          var value = model[16u + h];
          for (var i: u32 = 0u; i < 4u; i = i + 1u) { value = value + inputData[i] * model[h * 4u + i]; }
          hidden[h] = max(0.0, value);
        }
        for (var o: u32 = 0u; o < 3u; o = o + 1u) {
          var value = model[32u + o];
          for (var h: u32 = 0u; h < 4u; h = h + 1u) { value = value + hidden[h] * model[20u + o * 4u + h]; }
          outputData[o] = value;
        }
      }
    ` });
    const pipeline = device.createComputePipeline({ layout: 'auto', compute: { module: shader, entryPoint: 'main' } });
    const bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: inputBuffer } }, { binding: 1, resource: { buffer: modelBuffer } }, { binding: 2, resource: { buffer: outputBuffer } }
    ] });
    const encoder = device.createCommandEncoder(); const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup); pass.dispatchWorkgroups(1); pass.end();
    encoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, OUTPUT_SIZE * 4); device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(mapMode.READ);
    const logits = Array.from(new Float32Array(readBuffer.getMappedRange().slice(0)));
    readBuffer.unmap(); inputBuffer.destroy(); modelBuffer.destroy(); outputBuffer.destroy(); readBuffer.destroy();
    return { logits, probabilities: softmax(logits) };
  }

  return Object.freeze({ VERSION, MODEL, webGPUSupport, validateInput, softmax, inferCPU, requestBestAdapter, createRuntime, runVectorProbe, inferWebGPU });
});
