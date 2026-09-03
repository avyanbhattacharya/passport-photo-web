const { test, expect } = require('@playwright/test');
const path = require('path');

const samplePdf = path.join(__dirname, 'fixtures', 'sample.pdf');

async function openSample(page) {
  await page.goto('/clean-pdf-printer/');
  await page.locator('#pdfFile').setInputFiles(samplePdf);
  await expect(page.locator('#editor')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#pageInfo')).toContainText('Page 1 of 1');
  await expect.poll(() => page.locator('#preview').evaluate(c => c.width), { timeout: 15000 }).toBeGreaterThan(0);
}

test('PDF selection opens editor and renders first page', async ({ page }) => {
  await openSample(page);
  await expect(page.locator('#prev')).toBeDisabled();
  await expect(page.locator('#next')).toBeDisabled();
  await expect(page.locator('#undo')).toBeDisabled();
});

test('dragging creates an erase mask and Undo removes it', async ({ page }) => {
  await openSample(page);
  const canvas = await page.locator('#preview').boundingBox();
  expect(canvas).toBeTruthy();
  const x1 = canvas.x + canvas.width * .2, y1 = canvas.y + canvas.height * .2;
  const x2 = canvas.x + canvas.width * .55, y2 = canvas.y + canvas.height * .35;
  await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2); await page.mouse.up();
  await expect(page.locator('#stage .mask')).toHaveCount(1);
  await expect(page.locator('#undo')).toBeEnabled();
  await page.locator('#undo').click();
  await expect(page.locator('#stage .mask')).toHaveCount(0);
  await expect(page.locator('#undo')).toBeDisabled();
});

test('remove page can be reversed without losing the PDF', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Remove page' }).click();
  await expect(page.locator('#pageInfo')).toContainText('removed');
  await expect(page.getByRole('button', { name: 'Restore page' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore page' }).click();
  await expect(page.locator('#pageInfo')).not.toContainText('removed');
  await expect(page.getByRole('button', { name: 'Remove page' })).toBeVisible();
});

test('cannot export a document after removing every page', async ({ page }) => {
  await openSample(page);
  await page.getByRole('button', { name: 'Remove page' }).click();
  await page.getByRole('button', { name: 'Download Clean PDF' }).click();
  await expect(page.locator('#status')).toContainText('Keep at least one page', { timeout: 10000 });
});

test('PDF editor stays inside phone viewport', async ({ page }) => {
  await openSample(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});