const { test, expect } = require('@playwright/test');

const fixture = 'tests/fixtures/sample.pdf';

test('Split PDF loads pages, supports selection, and extracts selected pages', async ({ page }) => {
  await page.goto('/split-pdf/');
  await page.locator('#pdfFile').setInputFiles(fixture);
  await expect(page.locator('#editor')).toBeVisible({ timeout: 10000 });
  const count = await page.locator('.page-tile').count();
  expect(count).toBeGreaterThan(0);
  await expect(page.locator('#summary')).toContainText('selected');
  await page.locator('#clearAll').click();
  await expect(page.locator('#extractBtn')).toBeDisabled();
  await page.locator('.page-tile').first().click();
  await expect(page.locator('#extractBtn')).toBeEnabled();
  await page.locator('#extractBtn').click();
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#download')).toHaveAttribute('download', 'extracted-pages.pdf');
});

test('Split PDF can package every page into a ZIP', async ({ page }) => {
  await page.goto('/split-pdf/');
  await page.locator('#pdfFile').setInputFiles(fixture);
  await expect(page.locator('#editor')).toBeVisible({ timeout: 10000 });
  await page.locator('#splitBtn').click();
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#download')).toHaveAttribute('download', 'split-pages.zip');
  await expect(page.locator('#resultText')).toContainText('individual PDF');
});