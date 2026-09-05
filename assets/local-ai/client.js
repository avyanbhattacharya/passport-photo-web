(function (root) {
  'use strict';

  class LocalAIClient {
    constructor(options) {
      const opts = options || {};
      this.workerUrl = opts.workerUrl || '/assets/local-ai/ai-worker.js';
      this.fallbackWorkerUrl = opts.fallbackWorkerUrl || `${this.workerUrl}${this.workerUrl.includes('?') ? '&' : '?'}visionBackend=wasm&fallbackReason=webgpu-worker-timeout`;
      this.workerFactory = opts.workerFactory || (url => new Worker(url));
      this.timeoutMs = opts.timeoutMs || 15000;
      this.modelTimeoutMs = opts.modelTimeoutMs || 120000;
      this.webGPUWorkerTimeoutMs = opts.webGPUWorkerTimeoutMs || 30000;
      this.nextId = 1;
      this.pending = new Map();
      this.lastVisionStatus = null;
      this.worker = null;
      this.startWorker(this.workerUrl);
    }

    startWorker(url) {
      const worker = this.workerFactory(url);
      this.worker = worker;
      worker.onmessage = event => {
        if (worker !== this.worker) return;
        const message = event.data || {};
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.ok) {
          if (message.type === 'vision-status') this.lastVisionStatus = message;
          pending.resolve(message);
        }
        else {
          const error = new Error(message.error || 'local-ai-worker-error');
          error.code = message.code || 'local-ai-worker-error';
          error.reason = message.reason || null;
          error.deviceClass = message.deviceClass || null;
          pending.reject(error);
        }
      };
      worker.onerror = event => {
        if (worker !== this.worker) return;
        const error = new Error(event.message || 'local-ai-worker-crashed');
        error.code = 'local-ai-worker-crashed';
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(error);
        }
        this.pending.clear();
      };
    }

    restartWorker(url) {
      const previous = this.worker;
      this.worker = null;
      if (previous) previous.terminate();
      const error = new Error('local-ai-worker-restarted');
      error.code = 'local-ai-worker-restarted';
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
      this.lastVisionStatus = null;
      this.startWorker(url);
    }

    request(type, payload, timeoutMs) {
      const id = this.nextId++;
      const requestTimeout = timeoutMs || this.timeoutMs;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          const error = new Error(`local-ai-worker-timeout:${type}`);
          error.code = 'local-ai-worker-timeout';
          reject(error);
        }, requestTimeout);
        this.pending.set(id, { resolve, reject, timer });
        this.worker.postMessage({ id, type, ...(payload || {}) });
      });
    }

    status() {
      return this.request('status');
    }

    infer(input) {
      return this.request('infer', { input });
    }

    visionStatus() {
      return this.request('vision-status');
    }

    async classifyImage(image, options) {
      if (!image || typeof image.arrayBuffer !== 'function') return Promise.reject(new TypeError('classifyImage requires an image File or Blob.'));
      const opts = options || {};
      const totalTimeoutMs = opts.timeoutMs || this.modelTimeoutMs;
      const statusBackend = this.lastVisionStatus && this.lastVisionStatus.compatibility
        ? this.lastVisionStatus.compatibility.backend
        : null;
      const superviseWebGPU = statusBackend === null || statusBackend === 'webgpu';
      const firstTimeoutMs = superviseWebGPU
        ? Math.min(this.webGPUWorkerTimeoutMs, totalTimeoutMs)
        : totalTimeoutMs;
      const payload = { image, topK: opts.topK || 5 };
      try {
        return await this.request('classify-image', payload, firstTimeoutMs);
      } catch (error) {
        if (!superviseWebGPU || error.code !== 'local-ai-worker-timeout') throw error;
        this.restartWorker(this.fallbackWorkerUrl);
        const fallbackTimeoutMs = Math.max(1000, totalTimeoutMs - firstTimeoutMs);
        return this.request('classify-image', payload, fallbackTimeoutMs);
      }
    }

    close() {
      if (this.worker) this.worker.terminate();
      this.worker = null;
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('local-ai-client-closed'));
      }
      this.pending.clear();
    }
  }

  root.LocalAIClient = LocalAIClient;
})(typeof globalThis !== 'undefined' ? globalThis : this);
