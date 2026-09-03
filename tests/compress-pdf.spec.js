const { test, expect } = require('@playwright/test');
const path = require('path');

const fixture = path.join(__dirname, 'fixtures', 'sample.pdf');

async function loadPdf(page) {
  await page.goto('/compress-pdf/');
  await page.locator('#fileInput').setInputFiles(fixture);
  await expect(page.locator('#settingsPanel')).toBeVisible();
  await expect(page.locator('#fileName')).toHaveText('sample.pdf');
}

test('PDF compressor exposes quality modes and target controls', async ({ page }) => {
  await loadPdf(page);
  await expect(page.getByRole('radio', { name: /best quality/i })).toBeChecked();
  await expect(page.getByRole('radio', { name: /balanced/i })).toBeVisible();
  await expect(page.getByRole('radio', { name: /smallest size/i })).toBeVisible();
  await page.locator('#targetEnabled').check();
  await expect(page.locator('#targetControls')).toBeVisible();
  await expect(page.locator('#targetNote')).toContainText(/highest-quality result/i);
});

test('Best Quality compression creates a downloadable PDF', async ({ page }) => {
  await loadPdf(page);
  await page.getByRole('button', { name: 'Compress PDF' }).click();
  await expect(page.locator('#resultPanel')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#resultTitle')).toContainText(/compression complete/i);
  await expect(page.locator('#downloadLink')).toHaveAttribute('download', 'sample-compressed.pdf');
  expect(await page.locator('#downloadLink').getAttribute('href')).toMatch(/^blob:/);
});

test('Balanced compression exercises the rendered-page path once', async ({ page }) => {
  await loadPdf(page);
  await page.getByRole('radio', { name: /balanced/i }).check();
  await page.getByRole('button', { name: 'Compress PDF' }).click();
  await expect(page.locator('#resultPanel')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#progressBar')).toHaveAttribute('style', /100%/);
  expect(await page.locator('#downloadLink').getAttribute('href')).toMatch(/^blob:/);
});

test('target-size branch completes without an intentionally impossible render loop', async ({ page }) => {
  await loadPdf(page);
  await page.locator('#targetEnabled').check();
  await page.locator('#targetValue').fill('1');
  await page.locator('#targetUnit').selectOption('kb');
  await page.getByRole('button', { name: 'Compress PDF' }).click();
  await expect(page.locator('#resultPanel')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#resultTitle')).toContainText(/target reached|closest result created/i);
  await expect(page.locator('#resultNote')).toContainText(/1\.0 KB|target/i);
  await expect(page.locator('#progressBar')).toHaveAttribute('style', /100%/);
});
