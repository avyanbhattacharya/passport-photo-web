(function (root) {
  'use strict';

  class LocalAIClient {
    constructor(options) {
      const opts = options || {};
      this.workerUrl = opts.workerUrl || '/assets/local-ai/ai-worker.js';
      this.timeoutMs = opts.timeoutMs || 15000;
      this.modelTimeoutMs = opts.modelTimeoutMs || 120000;
      this.nextId = 1;
      this.pending = new Map();
      this.worker = new Worker(this.workerUrl);
      this.worker.onmessage = event => {
        const message = event.data || {};
        const pending = this.pending.get(message.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(message.id);
        if (message.ok) pending.resolve(message);
        else pending.reject(new Error(message.error || 'local-ai-worker-error'));
      };
      this.worker.onerror = event => {
        const error = new Error(event.message || 'local-ai-worker-crashed');
        for (const pending of this.pending.values()) {
          clearTimeout(pending.timer);
          pending.reject(error);
        }
        this.pending.clear();
      };
    }

    request(type, payload, timeoutMs) {
      const id = this.nextId++;
      const requestTimeout = timeoutMs || this.timeoutMs;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`local-ai-worker-timeout:${type}`));
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

    classifyImage(image, options) {
      if (!image || typeof image.arrayBuffer !== 'function') return Promise.reject(new TypeError('classifyImage requires an image File or Blob.'));
      const opts = options || {};
      return this.request('classify-image', { image, topK: opts.topK || 5 }, opts.timeoutMs || this.modelTimeoutMs);
    }

    close() {
      this.worker.terminate();
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('local-ai-client-closed'));
      }
      this.pending.clear();
    }
  }

  root.LocalAIClient = LocalAIClient;
})(typeof globalThis !== 'undefined' ? globalThis : this);
