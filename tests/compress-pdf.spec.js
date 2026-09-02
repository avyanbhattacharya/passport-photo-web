const { test, expect } = require('@playwright/test');
const path = require('path');

const fixture = path.join(__dirname, 'fixtures', 'sample.pdf');

async function loadPdf(page) {
  await page.goto('/compress-pdf/');
  await page.locator('#fileInput').setInputFiles(fixture);
  await expect(page.locator('#settingsPanel')).toBeVisible();
  await expect(page.locator('#fileName')).toHaveText('sample.pdf');
}

test('PDF compressor exposes quality modes and target file size controls', async ({ page }) => {
  await loadPdf(page);
  await expect(page.getByRole('radio', { name: /best quality/i })).toBeChecked();
  await expect(page.getByRole('radio', { name: /balanced/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /smallest size/i })).toBeVisible();

  await page.locator('#targetEnabled').check();
  await expect(page.locator('#targetControls')).toBeVisible();
  await page.locator('#targetValue').fill('2');
  await page.locator('#targetUnit').selectOption('mb');
  await expect(page.locator('#targetNote')).toContainText(/highest-quality result/i);
});

test('Best Quality compression completes and creates a downloadable PDF', async ({ page }) => {
  await loadPdf(page);
  await page.getByRole('button', { name: 'Compress PDF' }).click();
  await expect(page.locator('#resultPanel')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#resultTitle')).toContainText(/compression complete/i);
  await expect(page.locator('#downloadLink')).toHaveAttribute('download', 'sample-compressed.pdf');
  const href = await page.locator('#downloadLink').getAttribute('href');
  expect(href).toMatch(/^blob:/);
});

test('target file size path attempts the requested limit', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The full target-size render loop is covered once in Chromium; UI coverage runs on every browser.');
  await loadPdf(page);
  await page.locator('#targetEnabled').check();
  await page.locator('#targetValue').fill('0.5');
  await page.locator('#targetUnit').selectOption('kb');
  await page.getByRole('button', { name: 'Compress PDF' }).click();
  await expect(page.locator('#resultPanel')).toBeVisible({ timeout: 90000 });
  await expect(page.locator('#resultTitle')).toContainText(/target reached|closest result created/i);
  await expect(page.locator('#resultNote')).toContainText(/512 B|target/i);
  await expect(page.locator('#progressBar')).toHaveAttribute('style', /100%/);
});

test('PDF compressor has privacy and canonical metadata', async ({ page }) => {
  await page.goto('/compress-pdf/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://cleanlocaltools.com/compress-pdf/');
  await expect(page.getByText(/your pdf stays on this device/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /all tools/i })).toHaveAttribute('href', '/');
});
