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

test('worker status exposes local-only semantic model contract', async ({ page }) => {
  await page.goto('/labs/local-ai/');
  const status = await page.evaluate(async () => {
    const client = new LocalAIClient();
    try { return await client.status(); } finally { client.close(); }
  });
  expect(status.model).toBe('clean-local-tools-foundation-mlp-v1');
  expect(status.task).toBe('foundation-classification-probe');
  expect(status.localOnly).toBe(true);
  expect(status.adapterVersion).toBeTruthy();
});

test('lab has no horizontal overflow on phone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/labs/local-ai/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
