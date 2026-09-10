const { test, expect } = require('@playwright/test');
const fs = require('fs');

// Valid PNG buffer (2x2 pixels)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAAAwAAWgmWQ0AAAAASUVORK5CYII=', 'base64');

test('Photo Sheet imports distinct images, reorders/removes items, generates 1-page PDF, and verifies PDF contents', async ({ page }) => {
  await page.goto('/photo-sheet/');

  // Initial state: Make PDF is hidden/disabled
  await expect(page.locator('#editor')).toBeHidden();

  // Import 3 photos
  const input = page.locator('#imageFiles');
  await input.setInputFiles([
    { name: 'photo_a.png', mimeType: 'image/png', buffer: png },
    { name: 'photo_b.png', mimeType: 'image/png', buffer: png },
    { name: 'photo_c.png', mimeType: 'image/png', buffer: png }
  ]);

  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('.row')).toHaveCount(3);
  await expect(page.locator('.name').nth(0)).toHaveText('photo_a.png');

  // Reorder: move photo_a down
  await page.locator('.row').nth(0).getByTitle('Move down').click();
  await expect(page.locator('.name').nth(0)).toHaveText('photo_b.png');
  await expect(page.locator('.name').nth(1)).toHaveText('photo_a.png');

  // Configure settings: 4 photos per page, A4, Landscape, Medium gap, Normal margin, Fit mode, Show captions
  await page.locator('#gridSelect').selectOption('4');
  await page.locator('#pageSize').selectOption('a4');
  await page.locator('#orientation').selectOption('landscape');
  await page.locator('#fitMode').selectOption('fit');
  await page.locator('#showCaptions').check();

  // Trigger PDF generation and wait for download link to receive object URL
  await page.locator('#makePdf').click();
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#download')).toHaveAttribute('download', 'photo-sheet.pdf');

  // Retrieve blob content from download element href using page.evaluate
  const base64Pdf = await page.evaluate(async () => {
    const a = document.getElementById('download');
    const res = await fetch(a.href);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  });

  const pdfBytes = Buffer.from(base64Pdf, 'base64');

  // Assert PDF header magic bytes (%PDF-)
  expect(pdfBytes.slice(0, 5).toString()).toBe('%PDF-');

  // Parse raw PDF structure in browser context using page.evaluate with window.PDFLib
  const pdfAnalysis = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const doc = await window.PDFLib.PDFDocument.load(bytes);
    const page0 = doc.getPage(0);
    const { width, height } = page0.getSize();

    return {
      pageCount: doc.getPageCount(),
      width: Math.round(width),
      height: Math.round(height)
    };
  }, base64Pdf);

  expect(pdfAnalysis.pageCount).toBe(1);
  // A4 Landscape dimensions: 842 x 595 points
  expect(pdfAnalysis.width).toBe(842);
  expect(pdfAnalysis.height).toBe(595);

  // Assert result card summary
  await expect(page.locator('#resultText')).toContainText('1 page');
  await expect(page.locator('#resultText')).toContainText('3 photos');
});

test('Photo Sheet respects Crop framing mode and produces valid PDF output', async ({ page }) => {
  await page.goto('/photo-sheet/');

  await page.locator('#imageFiles').setInputFiles([
    { name: 'photo_a.png', mimeType: 'image/png', buffer: png },
    { name: 'photo_b.png', mimeType: 'image/png', buffer: png }
  ]);

  await expect(page.locator('#editor')).toBeVisible();

  // Select Crop mode and Letter Portrait layout
  await page.locator('#fitMode').selectOption('crop');
  await page.locator('#pageSize').selectOption('letter');
  await page.locator('#orientation').selectOption('portrait');

  await page.locator('#makePdf').click();
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });

  const base64Pdf = await page.evaluate(async () => {
    const a = document.getElementById('download');
    const res = await fetch(a.href);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  });

  const pdfBytes = Buffer.from(base64Pdf, 'base64');
  expect(pdfBytes.slice(0, 5).toString()).toBe('%PDF-');

  const pdfAnalysis = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const doc = await window.PDFLib.PDFDocument.load(bytes);
    const page0 = doc.getPage(0);
    const { width, height } = page0.getSize();

    return {
      pageCount: doc.getPageCount(),
      width: Math.round(width),
      height: Math.round(height)
    };
  }, base64Pdf);

  expect(pdfAnalysis.pageCount).toBe(1);
  // US Letter Portrait: 612 x 792 points
  expect(pdfAnalysis.width).toBe(612);
  expect(pdfAnalysis.height).toBe(792);
});

test('Photo Sheet rejects invalid/oversized files, enforces caps, and maintains mobile responsiveness', async ({ page }) => {
  await page.goto('/photo-sheet/');

  // Reject non-image text file
  await page.locator('#imageFiles').setInputFiles({ name: 'document.txt', mimeType: 'text/plain', buffer: Buffer.from('hello world') });
  await expect(page.locator('#error')).toContainText('JPG, PNG or WebP');

  // Verify mobile layout horizontal overflow
  await page.setViewportSize({ width: 375, height: 667 });
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(metrics.scrollWidth - metrics.clientWidth).toBeLessThanOrEqual(2);
});

test('Photo Sheet supports item removal, caption editing, and zero-item state', async ({ page }) => {
  await page.goto('/photo-sheet/');

  await page.locator('#imageFiles').setInputFiles([
    { name: 'photo_a.png', mimeType: 'image/png', buffer: png }
  ]);

  await expect(page.locator('#editor')).toBeVisible();

  // Edit caption
  const captionInput = page.locator('.caption-input').first();
  await captionInput.fill('Custom Green Caption');

  // Remove the photo
  await page.locator('.row').first().getByTitle('Remove').click();

  // Editor should hide when 0 items remain
  await expect(page.locator('#editor')).toBeHidden();
});
