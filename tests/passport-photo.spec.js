const { test, expect } = require('@playwright/test');
const path = require('path');

test('passport photo upload reveals editor and download controls', async ({ page }) => {
  await page.goto('/passport-photo/');
  await expect(page.getByRole('link', { name: /all clean local tools/i })).toBeVisible();

  const fixture = path.join(__dirname, 'fixtures', 'passport-test.svg');
  await page.locator('#fileInput').setInputFiles(fixture);

  await expect(page.locator('#editorCard')).toBeVisible();
  await expect(page.locator('#downloadCard')).toBeVisible();
  await expect(page.locator('#preview')).toHaveAttribute('width', '600');
  await expect(page.locator('#preview')).toHaveAttribute('height', '600');

  await page.locator('#format').selectOption('35x45');
  await expect(page.locator('#preview')).toHaveAttribute('width', '413');
  await expect(page.locator('#preview')).toHaveAttribute('height', '531');

  await page.locator('#brightness').fill('10');
  await expect(page.locator('#brightnessValue')).toHaveValue('10');

  await page.getByRole('button', { name: 'Reset adjustments' }).click();
  await expect(page.locator('#brightness')).toHaveValue('0');
});

test('passport 4x6 print sheet downloads after an image is loaded', async ({ page }) => {
  await page.goto('/passport-photo/');
  const fixture = path.join(__dirname, 'fixtures', 'passport-test.svg');
  await page.locator('#fileInput').setInputFiles(fixture);
  await expect(page.locator('#downloadCard')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /download 4×6 print sheet/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('passport-photo-4x6-sheet-4-copies.jpg');
});
