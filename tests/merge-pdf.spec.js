const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test('merges two PDFs in chosen order and downloads the result', async ({ page }) => {
  await page.goto('/merge-pdf/');
  await expect(page.getByRole('heading', { name: /^merge pdf$/i })).toBeVisible();
  await expect(page.getByText(/processed in this browser/i)).toBeVisible();

  const first = path.join(__dirname, 'fixtures', 'sample.pdf');
  const second = path.join(__dirname, 'fixtures', 'sample-2.pdf');
  await page.locator('#pdfFiles').setInputFiles([first, second]);

  await expect(page.locator('.file-row')).toHaveCount(2);
  await expect(page.locator('.file-row').nth(0)).toContainText('sample.pdf');
  await expect(page.locator('.file-row').nth(1)).toContainText('sample-2.pdf');
  await expect(page.locator('#summary')).toContainText('2 files');
  await expect(page.locator('#summary')).toContainText('2 pages');
  await expect(page.getByRole('button', { name: /merge pdfs/i })).toBeEnabled();

  await page.getByRole('button', { name: /move sample-2\.pdf up/i }).click();
  await expect(page.locator('.file-row').nth(0)).toContainText('sample-2.pdf');
  await expect(page.locator('.file-row').nth(1)).toContainText('sample.pdf');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /merge pdfs/i }).click();
  await expect(page.getByText(/your merged pdf is ready/i)).toBeVisible();
  await expect(page.locator('#resultText')).toContainText('2 PDFs combined into 2 pages');
  await page.getByRole('link', { name: /download merged pdf/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('merged.pdf');
  const downloadPath = await download.path();
  const bytes = fs.readFileSync(downloadPath);
  expect(bytes.slice(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(500);
});

test('requires at least two PDFs and supports removing files', async ({ page }) => {
  await page.goto('/merge-pdf/');
  const first = path.join(__dirname, 'fixtures', 'sample.pdf');
  const second = path.join(__dirname, 'fixtures', 'sample-2.pdf');
  await page.locator('#pdfFiles').setInputFiles([first, second]);
  await expect(page.getByRole('button', { name: /merge pdfs/i })).toBeEnabled();
  await page.getByRole('button', { name: /remove sample-2\.pdf/i }).click();
  await expect(page.locator('.file-row')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /merge pdfs/i })).toBeDisabled();
});
