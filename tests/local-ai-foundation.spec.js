const { test, expect } = require('@playwright/test');

test('local AI foundation initializes and infers through local model adapter', async ({ page }) => {
  const pageErrors = [];
  const unexpectedRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4173') unexpectedRequests.push(request.url());
  });
  const response = await page.goto('/labs/local-ai/');
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('h1')).toHaveText('Local AI Foundation Lab');
  await expect(page.getByText('Your files never leave your machine.')).toBeVisible();
  await expect(page.locator('#backend')).not.toHaveText('Checking…');
  const backend = await page.locator('#backend').textContent();
  expect(['webgpu', 'cpu-js']).toContain(backend);
  await page.locator('#run').click();
  await expect(page.locator('#result')).toContainText('probabilities');
  const output = JSON.parse(await page.locator('#result').textContent());
  expect(['webgpu', 'cpu-js']).toContain(output.backend);
  expect(output.model).toBe('clean-local-tools-foundation-mlp-v1');
  expect(output.probabilities).toHaveLength(3);
  const total = output.probabilities.reduce((sum, value) => sum + value, 0);
  expect(Math.abs(total - 1)).toBeLessThan(1e-6);
  expect(unexpectedRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('worker status exposes compute policy without downloading the real model', async ({ page }) => {
  const externalRequests = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4173') externalRequests.push(request.url());
  });
  await page.goto('/labs/local-ai/');
  const statuses = await page.evaluate(async () => {
    const client = new LocalAIClient();
    try { return { foundation: await client.status(), vision: await client.visionStatus() }; } finally { client.close(); }
  });
  expect(statuses.foundation.model).toBe('clean-local-tools-foundation-mlp-v1');
  expect(statuses.foundation.task).toBe('foundation-classification-probe');
  expect(statuses.foundation.localOnly).toBe(true);
  expect(statuses.foundation.adapterVersion).toBeTruthy();
  expect(statuses.vision.model).toBe('onnx-community/mobilenetv4_conv_small.e2400_r224_in1k');
  expect(statuses.vision.task).toBe('image-classification');
  expect(statuses.vision.localOnly).toBe(true);
  expect(statuses.vision.preferredBackend).toBe('webgpu');
  expect(statuses.vision.fallbackBackend).toBe('wasm');
  expect(statuses.vision.fallbackMode).toBe('desktop-only');
  expect(['desktop', 'mobile', 'unknown']).toContain(statuses.vision.deviceClass);
  expect(typeof statuses.vision.compatibility.supported).toBe('boolean');
  expect(statuses.vision.compatibility.fallbackMode).toBe('desktop-only');
  expect(statuses.vision.remoteAssetsRequiredOnFirstUse).toBe(true);
  expect(statuses.vision.backend).toBe('not-loaded');
  expect(externalRequests).toEqual([]);
});

test('real vision lab checks support before enabling image selection', async ({ page }) => {
  await page.goto('/labs/local-ai/');
  await expect(page.getByRole('heading', { name: 'Real pretrained vision model' })).toBeVisible();
  await expect(page.getByText(/model code and weights may be downloaded/i)).toBeVisible();
  await expect(page.locator('#visionCompatibility')).not.toContainText('Checking whether');
  await expect(page.locator('#visionModel')).toHaveText('onnx-community/mobilenetv4_conv_small.e2400_r224_in1k');
  await expect(page.locator('#visionPreferred')).toHaveText('webgpu');
  await expect(page.locator('#visionFallback')).toContainText(/desktop-class devices only/i);
  const compatibilityText = await page.locator('#visionCompatibility').textContent();
  expect(/Supported on this device|not supported on this device yet/i.test(compatibilityText || '')).toBeTruthy();
  const fileDisabled = await page.locator('#visionFile').isDisabled();
  if (/not supported/i.test(compatibilityText || '')) expect(fileDisabled).toBe(true);
  await expect(page.getByRole('button', { name: /classify locally/i })).toBeDisabled();
});

test('lab has no horizontal overflow on phone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/labs/local-ai/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
