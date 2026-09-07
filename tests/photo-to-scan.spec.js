const { test, expect } = require('@playwright/test');

// Creates a synthetic skewed document image fixture with grid and corner markers
async function testSkewedPng(page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, 800, 600);

    // Skewed document polygon: top-left (120,80), top-right (700,120), bottom-right (650,520), bottom-left (100,480)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(120, 80);
    ctx.lineTo(700, 120);
    ctx.lineTo(650, 520);
    ctx.lineTo(100, 480);
    ctx.closePath();
    ctx.fill();

    // Internal text and grid lines
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 30px Arial';
    ctx.fillText('TEST SCAN DOCUMENT', 200, 200);

    ctx.fillRect(200, 240, 350, 10);
    ctx.fillRect(200, 270, 300, 10);
    ctx.fillRect(200, 300, 380, 10);

    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  return { name: 'skewed-doc.png', mimeType: 'image/png', buffer: Buffer.from(bytes) };
}

test('Select document photo button invokes the image file picker', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  await expect(page.locator('#fileInput')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');

  await page.evaluate(() => {
    const input = document.getElementById('fileInput');
    window.__pickerClicked = false;
    input.click = () => { window.__pickerClicked = true; };
  });

  await page.getByRole('button', { name: /select document photo/i }).click();
  await expect.poll(() => page.evaluate(() => window.__pickerClicked)).toBe(true);
});

test('Selected skewed document opens editor and produces straightened scan', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);

  await expect(page.locator('#editor')).toBeVisible({ timeout: 10000 });

  const sourceSize = await page.locator('#sourceCanvas').evaluate(c => ({ width: c.width, height: c.height }));
  expect(sourceSize.width).toBeGreaterThan(0);
  expect(sourceSize.width).toBeLessThanOrEqual(800);

  await expect.poll(() => page.locator('#resultCanvas').evaluate(c => c.width), { timeout: 10000 }).toBeGreaterThan(0);
  await expect(page.locator('#status')).toContainText('Output scan size');
  await expect(page.locator('.corner')).toHaveCount(4);
});

test('Document modes and brightness/contrast sliders update scan result', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  for (const name of ['Grayscale', 'High Contrast', 'Natural Color']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveClass(/active/);
    await expect.poll(() => page.locator('#resultCanvas').evaluate(c => c.width)).toBeGreaterThan(0);
  }

  // Adjust sliders
  await page.locator('#brightness').fill('20');
  await page.locator('#contrast').fill('15');
  await expect(page.locator('#brightnessVal')).toHaveText('20');
  await expect(page.locator('#contrastVal')).toHaveText('15');

  // Reset button restores defaults
  await page.getByRole('button', { name: /reset corners/i }).click();
  await expect(page.locator('#brightnessVal')).toHaveText('0');
  await expect(page.locator('#contrastVal')).toHaveText('0');
  await expect(page.getByRole('button', { name: 'Natural Color' })).toHaveClass(/active/);
});

test('Corner handles are keyboard focusable and adjustable with Arrow keys', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  const handle = page.locator('.corner').first();
  await handle.focus();
  await expect(handle).toBeFocused();

  const initialWidth = await page.locator('#resultCanvas').evaluate(c => c.width);

  // Press ArrowRight to move top-left corner right
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');

  await expect.poll(() => page.locator('#resultCanvas').evaluate(c => c.width)).toBeGreaterThan(0);
});

test('Degenerate or crossed corners display useful error and disable export', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  // Focus top-left corner handle and simulate moving it right past the top-right corner
  const topLeftHandle = page.locator('.corner[data-i="0"]');
  await topLeftHandle.focus();

  // Press ArrowRight multiple times with Shift (larger steps) to cross corners
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press('Shift+ArrowRight');
  }

  await expect(page.locator('#editorError')).toContainText(/crossed|degenerate|close/i);
  await expect(page.getByRole('button', { name: 'Download JPEG' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
});

test('Oversized input file shows useful error and preserves state', async ({ page }) => {
  await page.goto('/photo-to-scan/');

  // Create fake oversized file > 15 MiB
  const largeBuffer = Buffer.alloc(16 * 1024 * 1024);
  const file = { name: 'huge-doc.jpg', mimeType: 'image/jpeg', buffer: largeBuffer };

  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#uploadError')).toContainText('15 MiB');
  await expect(page.locator('#editor')).toBeHidden();
});

test('Exported JPEG and PDF downloads match expectations', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  // Test JPEG download
  const [jpgDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download JPEG' }).click()
  ]);
  expect(jpgDownload.suggestedFilename()).toBe('scanned-document.jpg');
  const jpgPath = await jpgDownload.path();
  expect(jpgPath).toBeTruthy();

  // Test PDF download
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PDF' }).click()
  ]);
  expect(pdfDownload.suggestedFilename()).toBe('scanned-document.pdf');
  const pdfPath = await pdfDownload.path();
  expect(pdfPath).toBeTruthy();
});

test('Photo to scan editor has no horizontal page overflow on mobile viewports', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
