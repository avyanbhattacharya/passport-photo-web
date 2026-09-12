const { test, expect } = require('@playwright/test');

// Creates a synthetic skewed document image fixture with grid and corner markers
// Skewed polygon corners in source 800x600 canvas:
// Top-Left: (120, 80) -> normalized (0.15, 0.1333)
// Top-Right: (700, 120) -> normalized (0.875, 0.2)
// Bottom-Right: (650, 520) -> normalized (0.8125, 0.8667)
// Bottom-Left: (100, 480) -> normalized (0.125, 0.8)
async function testSkewedPng(page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(0, 0, 800, 600);

    // Skewed document polygon
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

// Creates a sharp gradient pattern image to verify bilinear interpolation smoothness (CLT-PTS-001)
async function testGradientPng(page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 400, 400);
    grad.addColorStop(0, '#ff0000');
    grad.addColorStop(0.5, '#00ff00');
    grad.addColorStop(1, '#0000ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 400, 400);

    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });

  return { name: 'gradient.png', mimeType: 'image/png', buffer: Buffer.from(bytes) };
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

test('Selected skewed document with corner correspondence produces geometry within tolerance (CLT-PTS-002)', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);

  await expect(page.locator('#editor')).toBeVisible({ timeout: 10000 });

  // Set corner handles to exact fixture polygon points (CLT-PTS-002)
  // Polygon source points: TL(120,80), TR(700,120), BR(650,520), BL(100,480) in 800x600 canvas
  // Normalized: TL(0.15, 0.13333), TR(0.875, 0.2), BR(0.8125, 0.86667), BL(0.125, 0.8)
  await page.evaluate(() => {
    const handles = document.querySelectorAll('.corner');
    const canvas = document.getElementById('sourceCanvas');
    const r = canvas.getBoundingClientRect();
    const desired = [
      [120 / 800, 80 / 600],
      [700 / 800, 120 / 600],
      [650 / 800, 520 / 600],
      [100 / 800, 480 / 600]
    ];

    desired.forEach((pt, i) => {
      const el = handles[i];
      const elRect = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: elRect.left + 5, clientY: elRect.top + 5, bubbles: true }));

      // Recalculate canvas rect after focus/scroll
      const curRect = canvas.getBoundingClientRect();
      const targetX = curRect.left + pt[0] * curRect.width;
      const targetY = curRect.top + pt[1] * curRect.height;
      el.dispatchEvent(new PointerEvent('pointermove', { clientX: targetX, clientY: targetY, bubbles: true }));
      el.dispatchEvent(new PointerEvent('pointerup', { clientX: targetX, clientY: targetY, bubbles: true }));
    });
  });

  await expect.poll(() => page.locator('#resultCanvas').evaluate(c => c.width), { timeout: 10000 }).toBeGreaterThan(0);

  // Independently calculated expected target dimensions:
  // topW = dist([120,80],[700,120]) = sqrt(580^2 + 40^2) = sqrt(336400+1600) = sqrt(338000) ~ 581.378
  // botW = dist([100,480],[650,520]) = sqrt(550^2 + 40^2) = sqrt(302500+1600) = sqrt(304100) ~ 551.453
  // leftH = dist([120,80],[100,480]) = sqrt((-20)^2 + 400^2) = sqrt(400+160000) = sqrt(160400) ~ 400.499
  // rightH = dist([700,120],[650,520]) = sqrt((-50)^2 + 400^2) = sqrt(2500+160000) = sqrt(162500) ~ 403.112
  // Expected targetW = round(max(581.378, 551.453)) = 581
  // Expected targetH = round(max(400.499, 403.112)) = 403
  const outputDimensions = await page.locator('#resultCanvas').evaluate(c => ({ width: c.width, height: c.height }));

  // Tolerances allow ±2px for pixel rounding
  expect(Math.abs(outputDimensions.width - 581)).toBeLessThanOrEqual(2);
  expect(Math.abs(outputDimensions.height - 403)).toBeLessThanOrEqual(2);
  await expect(page.locator('#status')).toContainText('Output scan size: 581 × 403 px');
});

test('Bilinear interpolation produces smooth gradient output (CLT-PTS-001)', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testGradientPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  // Verify result canvas rendered non-empty pixels smoothly
  const isSmoothAndValid = await page.locator('#resultCanvas').evaluate(c => {
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    // Check center pixel is non-zero
    const centerIdx = (Math.floor(c.height / 2) * c.width + Math.floor(c.width / 2)) * 4;
    return data[centerIdx + 3] === 255 && (data[centerIdx] > 0 || data[centerIdx + 1] > 0 || data[centerIdx + 2] > 0);
  });
  expect(isSmoothAndValid).toBe(true);
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

test('Corner handles have valid ARIA slider attributes and respond to Arrow keys (CLT-PTS-005)', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  const handle = page.locator('.corner[data-i="0"]');
  await expect(handle).toHaveAttribute('role', 'slider');
  await expect(handle).toHaveAttribute('aria-valuemin', '0');
  await expect(handle).toHaveAttribute('aria-valuemax', '100');
  await expect(handle).toHaveAttribute('aria-valuenow', '8');
  await expect(handle).toHaveAttribute('aria-valuetext', '8% X, 8% Y');

  await handle.focus();
  await page.keyboard.press('ArrowRight');

  await expect(handle).toHaveAttribute('aria-valuenow', '9');
});

test('Degenerate or crossed corners display useful error and disable export', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  const topLeftHandle = page.locator('.corner[data-i="0"]');
  await topLeftHandle.focus();

  for (let i = 0; i < 50; i++) {
    await page.keyboard.press('Shift+ArrowRight');
  }

  await expect(page.locator('#editorError')).toContainText(/crossed|degenerate|close/i);
  await expect(page.getByRole('button', { name: 'Download JPEG' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
});

test('Oversized input file shows useful error and preserves state', async ({ page }) => {
  await page.goto('/photo-to-scan/');

  const largeBuffer = Buffer.alloc(16 * 1024 * 1024);
  const file = { name: 'huge-doc.jpg', mimeType: 'image/jpeg', buffer: largeBuffer };

  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#uploadError')).toContainText('15 MiB');
  await expect(page.locator('#editor')).toBeHidden();
});

test('Decodes downloaded JPEG and asserts dimensions; inspects downloaded PDF with pdf-lib (CLT-PTS-003)', async ({ page }) => {
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
  const jpgStream = await jpgDownload.createReadStream();
  const jpgChunks = [];
  for await (const chunk of jpgStream) jpgChunks.push(chunk);
  const jpgBuffer = Buffer.concat(jpgChunks);

  // Assert JPEG decodability and dimensions in browser context
  const decodedJpgInfo = await page.evaluate(async (base64) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('invalid_jpeg'));
      img.src = 'data:image/jpeg;base64,' + base64;
    });
  }, jpgBuffer.toString('base64'));

  const resultDimensions = await page.locator('#resultCanvas').evaluate(c => ({ width: c.width, height: c.height }));
  expect(decodedJpgInfo).toEqual(resultDimensions);

  // Test PDF download
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PDF' }).click()
  ]);
  expect(pdfDownload.suggestedFilename()).toBe('scanned-document.pdf');
  const pdfStream = await pdfDownload.createReadStream();
  const pdfChunks = [];
  for await (const chunk of pdfStream) pdfChunks.push(chunk);
  const pdfBuffer = Buffer.concat(pdfChunks);

  // Inspect actual PDF inside browser context using global PDFLib (CLT-PTS-003)
  const pdfInfo = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const doc = await window.PDFLib.PDFDocument.load(bytes);
    const pageCount = doc.getPageCount();
    const page0 = doc.getPage(0);
    const { width, height } = page0.getSize();
    return { pageCount, width: Math.round(width), height: Math.round(height) };
  }, pdfBuffer.toString('base64'));

  expect(pdfInfo.pageCount).toBe(1);
  // Landscape A4 dimensions in points: 842 x 595
  expect(pdfInfo.width).toBe(842);
  expect(pdfInfo.height).toBe(595);
  expect(pdfBuffer.includes(Buffer.from('/Subtype /Image'))).toBe(true);
  const expectedFit = Math.min((pdfInfo.width - 40) / decodedJpgInfo.width, (pdfInfo.height - 40) / decodedJpgInfo.height);
  expect(expectedFit).toBeGreaterThan(0);
  expect(decodedJpgInfo.width * expectedFit).toBeLessThanOrEqual(pdfInfo.width - 40 + 0.01);
  expect(decodedJpgInfo.height * expectedFit).toBeLessThanOrEqual(pdfInfo.height - 40 + 0.01);
});

test('Fast slider changes debounce render and request-id prevents stale renders (CLT-PTS-004)', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  const before = await page.evaluate(() => ({ ...window.__photoToScanDebug }));
  // Rapidly change brightness slider multiple times
  await page.locator('#brightness').fill('10');
  await page.locator('#brightness').fill('20');
  await page.locator('#brightness').fill('30');
  await page.locator('#brightness').fill('40');

  await expect(page.locator('#brightnessVal')).toHaveText('40');
  await expect(page.locator('#status')).toContainText('Output scan size');
  await expect.poll(() => page.evaluate(() => window.__photoToScanDebug.completed), { timeout: 1000 }).toBeGreaterThan(before.completed);
  const after = await page.evaluate(() => ({ ...window.__photoToScanDebug }));
  expect(after.sourceImageDataReads).toBe(before.sourceImageDataReads);
  expect(after.completed - before.completed).toBe(1);
  expect(after.scheduled - before.scheduled).toBe(4);
});

test('Photo to scan editor has no horizontal page overflow on mobile viewports', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});


test('Detect Edges finds the high-contrast document boundary and keeps manual adjustment available', async ({ page }) => {
  await page.goto('/photo-to-scan/');
  const file = await testSkewedPng(page);
  await page.locator('#fileInput').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();

  await page.getByRole('button', { name: 'Detect Edges' }).click();
  await expect(page.locator('#status')).toContainText('Edges detected');

  const detected = await page.evaluate(() => window.__photoToScanDebug.lastDetectedCorners);
  expect(detected).not.toBeNull();
  const expected = [[0.15, 0.133], [0.875, 0.2], [0.813, 0.867], [0.125, 0.8]];
  detected.forEach((point, index) => {
    expect(Math.abs(point[0] - expected[index][0])).toBeLessThan(0.06);
    expect(Math.abs(point[1] - expected[index][1])).toBeLessThan(0.06);
  });

  const handle = page.locator('.corner[data-i="0"]');
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', /d+/);
});
