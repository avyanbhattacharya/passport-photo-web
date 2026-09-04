const test = require('node:test');
const assert = require('node:assert/strict');
const reports = require('../../assets/local-ai/test-report.js');

test('hardware test report contains technical compatibility data without file contents or automatic submission', () => {
  const fakeCrypto = { getRandomValues(bytes) { bytes.set([1, 2, 3, 4]); return bytes; } };
  const report = reports.createReport({
    cryptoLike: fakeCrypto,
    createdAt: '2026-09-04T12:00:00.000Z',
    navigatorLike: {
      userAgent: 'ExampleBrowser/1.0',
      platform: 'ExampleOS',
      language: 'en-US',
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 0
    },
    webGPUApiPresent: true,
    webGPUAdapterUsable: true,
    compatibilityProbeMs: 12.4,
    modelAndInferenceMs: 456.7,
    visionStatus: {
      model: 'model-id',
      task: 'image-classification',
      framework: 'transformers.js',
      frameworkVersion: '3.8.1',
      preferredBackend: 'webgpu',
      fallbackBackend: 'wasm',
      executionPolicy: 'gpu-preferred',
      deviceClass: 'desktop',
      policyDecision: 'webgpu',
      policyReason: 'available'
    },
    result: { backend: 'webgpu', model: 'model-id', predictions: [{ label: 'x', score: 1 }] },
    outcome: 'pass'
  });
  assert.equal(report.schema, 'clean-local-tools-hardware-test/v1');
  assert.equal(report.testId, 'TEST-01020304');
  assert.equal(report.privacy.workingFileUploaded, false);
  assert.equal(report.privacy.automaticTelemetry, false);
  assert.equal(report.privacy.reportSubmission, 'manual-only');
  assert.equal(report.capability.webGPUApiPresent, true);
  assert.equal(report.capability.webGPUAdapterUsable, true);
  assert.equal(report.model.selectedBackend, 'webgpu');
  assert.equal(report.timingMs.compatibilityProbe, 12);
  assert.equal(report.timingMs.modelAndInference, 457);
  assert.equal(report.outcome.predictionsReturned, 1);
  const json = reports.toJson(report);
  assert.doesNotMatch(json, /fake-image|imageBytes|fileContents/i);
});

test('hardware test report can represent unsupported devices without pretending fallback ran', () => {
  const report = reports.createReport({
    testId: 'TEST-ABC12345',
    navigatorLike: { userAgent: 'Mobile Example', maxTouchPoints: 5 },
    webGPUApiPresent: false,
    webGPUAdapterUsable: false,
    visionStatus: {
      model: 'model-id',
      deviceClass: 'mobile',
      policyDecision: 'unsupported',
      policyReason: 'webgpu-unavailable',
      fallbackBackend: 'wasm'
    },
    outcome: 'unsupported',
    errorCode: 'local-ai-device-not-supported',
    errorMessage: 'This AI feature is not supported on this device yet.'
  });
  assert.equal(report.model.selectedBackend, null);
  assert.equal(report.outcome.status, 'unsupported');
  assert.equal(report.outcome.errorCode, 'local-ai-device-not-supported');
  assert.equal(report.privacy.automaticTelemetry, false);
});
