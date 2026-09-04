(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LocalAITestReport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '0.1.0';

  function randomId(cryptoLike) {
    const cryptoApi = cryptoLike || (typeof crypto !== 'undefined' ? crypto : null);
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      const bytes = new Uint8Array(4);
      cryptoApi.getRandomValues(bytes);
      return `TEST-${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    }
    return `TEST-${Math.random().toString(16).slice(2, 10).padEnd(8, '0').toUpperCase()}`;
  }

  function safeDeviceInfo(navigatorLike) {
    const nav = navigatorLike || {};
    return {
      userAgent: String(nav.userAgent || 'unknown'),
      platform: String(nav.platform || 'unknown'),
      language: String(nav.language || 'unknown'),
      hardwareConcurrency: Number.isFinite(Number(nav.hardwareConcurrency)) ? Number(nav.hardwareConcurrency) : null,
      deviceMemoryGB: Number.isFinite(Number(nav.deviceMemory)) ? Number(nav.deviceMemory) : null,
      maxTouchPoints: Number.isFinite(Number(nav.maxTouchPoints)) ? Number(nav.maxTouchPoints) : null
    };
  }

  function createReport(input) {
    const data = input || {};
    const visionStatus = data.visionStatus || {};
    const result = data.result || null;
    return {
      schema: 'clean-local-tools-hardware-test/v1',
      testId: data.testId || randomId(data.cryptoLike),
      createdAt: data.createdAt || new Date().toISOString(),
      privacy: {
        workingFileUploaded: false,
        automaticTelemetry: false,
        reportSubmission: 'manual-only'
      },
      device: safeDeviceInfo(data.navigatorLike),
      capability: {
        webGPUApiPresent: !!data.webGPUApiPresent,
        webGPUAdapterUsable: Object.prototype.hasOwnProperty.call(data, 'webGPUAdapterUsable') ? !!data.webGPUAdapterUsable : null,
        executionPolicy: visionStatus.executionPolicy || null,
        deviceClass: visionStatus.deviceClass || null,
        policyDecision: visionStatus.policyDecision || null,
        policyReason: visionStatus.policyReason || null
      },
      model: {
        id: visionStatus.model || (result && result.model) || null,
        task: visionStatus.task || (result && result.task) || null,
        framework: visionStatus.framework || null,
        frameworkVersion: visionStatus.frameworkVersion || null,
        preferredBackend: visionStatus.preferredBackend || null,
        fallbackBackend: visionStatus.fallbackBackend || null,
        selectedBackend: result ? result.backend || null : visionStatus.backend || null,
        fallbackReason: result ? result.fallbackReason || null : visionStatus.fallbackReason || null
      },
      timingMs: {
        compatibilityProbe: data.compatibilityProbeMs == null ? null : Math.round(Number(data.compatibilityProbeMs)),
        modelAndInference: data.modelAndInferenceMs == null ? null : Math.round(Number(data.modelAndInferenceMs))
      },
      outcome: {
        status: data.outcome || (result ? 'pass' : 'not-run'),
        errorCode: data.errorCode || null,
        errorMessage: data.errorMessage || null,
        predictionsReturned: result && Array.isArray(result.predictions) ? result.predictions.length : 0
      }
    };
  }

  function toJson(report) {
    return JSON.stringify(report, null, 2);
  }

  return Object.freeze({ VERSION, randomId, safeDeviceInfo, createReport, toJson });
});
