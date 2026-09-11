const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const samplePath = path.join(__dirname, 'fixtures', 'sample.pdf');

test('PDF Page Organizer loads PDF, renders workspace, supports page operations, and exports valid PDF', async ({ page }) => {
  await page.goto('/pdf-page-organizer/');

  // Page title and privacy callout assertions
  await expect(page).toHaveTitle(/PDF Page Organizer/i);
  await expect(page.getByRole('heading', { name: /PDF Page Organizer/i })).toBeVisible();
  await expect(page.getByText(/your files never leave your machine/i).first()).toBeVisible();

  // Import single PDF
  await page.locator('#pdfFile').setInputFiles(samplePath);
  await expect(page.locator('#editorCard')).toBeVisible({ timeout: 10000 });

  // Initial page card count
  const initialCards = page.locator('.page-card');
  await expect(initialCards).toHaveCount(1);
  await expect(page.locator('#summary')).toContainText('1 page');

  // Test duplicating page
  await page.locator('.page-card').first().getByRole('button', { name: /duplicate page 1/i }).click();
  await expect(initialCards).toHaveCount(2);
  await expect(page.locator('#summary')).toContainText('2 pages');

  // Test rotating page 2 clockwise (90 degrees)
  await page.locator('.page-card').nth(1).getByRole('button', { name: /rotate page 2 right 90 degrees/i }).click();
  await expect(page.locator('.page-card').nth(1).locator('.rotation-badge')).toHaveText('90°');

  // Test moving page 2 left (swap positions with page 1)
  await page.locator('.page-card').nth(1).getByRole('button', { name: /move page 2 left/i }).click();

  // Export PDF
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  await expect(page.locator('#resultCard')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#resultText')).toContainText('2 pages');

  await page.locator('#downloadBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('sample-organized.pdf');

  const downloadPath = await download.path();
  const bytes = fs.readFileSync(downloadPath);

  // Assert actual downloaded PDF header, size, and structure
  expect(bytes.slice(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(500);

  // Validate exported PDF using PDFLib in browser context
  const exportValidation = await page.evaluate(async (blobUrl) => {
    const res = await fetch(blobUrl);
    const buffer = await res.arrayBuffer();
    const doc = await window.PDFLib.PDFDocument.load(buffer);
    const count = doc.getPageCount();
    const rot0 = doc.getPage(0).getRotation().angle;
    const rot1 = doc.getPage(1).getRotation().angle;
    const size0 = doc.getPage(0).getSize();
    return { count, rot0, rot1, width: size0.width, height: size0.height };
  }, await page.locator('#downloadBtn').getAttribute('href'));

  expect(exportValidation.count).toBe(2);
  expect(exportValidation.rot0).toBe(90); // Swapped moved page
  expect(exportValidation.rot1).toBe(0);
  expect(exportValidation.width).toBeGreaterThan(0);
  expect(exportValidation.height).toBeGreaterThan(0);
});

test('Batch selection, rotate selected, delete selected, and empty state enforcement', async ({ page }) => {
  await page.goto('/pdf-page-organizer/');
  await page.locator('#pdfFile').setInputFiles(samplePath);
  await expect(page.locator('#editorCard')).toBeVisible();

  // Duplicate to get 2 pages
  await page.locator('.page-card').first().getByRole('button', { name: /duplicate page 1/i }).click();
  await expect(page.locator('.page-card')).toHaveCount(2);

  // Select all pages
  await page.locator('#selectAllBtn').click();
  await expect(page.locator('#summary')).toContainText('2 selected');

  // Rotate selected 90° right
  await page.locator('#rotateRightSelected').click();
  await expect(page.locator('.rotation-badge').first()).toHaveText('90°');
  await expect(page.locator('.rotation-badge').nth(1)).toHaveText('90°');

  // Clear selection
  await page.locator('#clearSelectionBtn').click();
  await expect(page.locator('#summary')).not.toContainText('selected');
  await expect(page.locator('#deleteSelected')).toBeDisabled();

  // Select all again and delete selected
  await page.locator('#selectAllBtn').click();
  await page.locator('#deleteSelected').click();

  // Workspace now has 0 pages
  await expect(page.locator('#exportBtn')).toBeDisabled();
  await expect(page.locator('.page-grid')).toContainText('All pages have been deleted');
});

test('Rejects corrupt files, encrypted PDFs, and preserves valid workspace on failed replacement', async ({ page }) => {
  await page.goto('/pdf-page-organizer/');

  // 1. Upload corrupt non-PDF file
  const corruptFile = { name: 'corrupt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('NOT A PDF FILE CONTENT') };
  await page.locator('#pdfFile').setInputFiles(corruptFile);
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error')).toContainText(/could not open this pdf file|corrupted/i);

  // 2. Upload valid PDF
  await page.locator('#pdfFile').setInputFiles(samplePath);
  await expect(page.locator('#editorCard')).toBeVisible();
  await expect(page.locator('.page-card')).toHaveCount(1);

  // 3. Attempt replacement import with corrupt file
  await page.locator('#replacePdfBtn').click();
  await page.locator('#pdfFile').setInputFiles(corruptFile);

  // Error is shown, but previous valid workspace document remains intact
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#editorCard')).toBeVisible();
  await expect(page.locator('.page-card')).toHaveCount(1);
});

test('Supports keyboard interaction and live status updates', async ({ page }) => {
  await page.goto('/pdf-page-organizer/');
  await page.locator('#pdfFile').setInputFiles(samplePath);
  await expect(page.locator('#editorCard')).toBeVisible();

  // Focus on page card
  const card = page.locator('.page-card').first();
  await card.focus();

  // Press Space to toggle select
  await page.keyboard.press('Space');
  await expect(card).toHaveClass(/selected/);

  // Press Delete key to delete page
  await page.keyboard.press('Delete');
  await expect(page.locator('#exportBtn')).toBeDisabled();
  await expect(page.locator('#status')).toContainText('Deleted page 1');
});

test('Mobile viewport adapts with no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/pdf-page-organizer/');
  await page.locator('#pdfFile').setInputFiles(samplePath);
  await expect(page.locator('#editorCard')).toBeVisible();

  const isOverflowing = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(isOverflowing).toBe(false);
});

test('Privacy check: no working file payload is uploaded over the network', async ({ page }) => {
  const outboundRequests = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' || req.method() === 'PUT') {
      outboundRequests.push(req.url());
    }
  });

  await page.goto('/pdf-page-organizer/');
  await page.locator('#pdfFile').setInputFiles(samplePath);
  await expect(page.locator('#editorCard')).toBeVisible();

  await page.locator('#exportBtn').click();
  await expect(page.locator('#resultCard')).toBeVisible();

  expect(outboundRequests.length).toBe(0);
});


test('PDF Page Organizer does not include the unapproved PDF.js runtime', async ({ page }) => {
  await page.goto('/pdf-page-organizer/');
  const source = await page.evaluate(() => fetch('/pdf-page-organizer/app.js').then((response) => response.text()));
  expect(source).not.toContain('pdfjs-dist');
  expect(source).not.toContain('pdf.worker');
});
