const { test, expect } = require('@playwright/test');

async function createTestImageBuffer(page, width, height, format = 'image/png') {
  return await page.evaluate(async ({ w, h, fmt }) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1a73e8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 10, w - 20, h - 20);
    const blob = await new Promise(r => canvas.toBlob(r, fmt, 0.9));
    const buf = await blob.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, { w: width, h: height, fmt: format });
}

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.addInitScript(() => {
    window.heic2any = async ({ blob, toType }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#34a853';
      ctx.fillRect(0, 0, 400, 300);
      return new Promise(resolve => canvas.toBlob(resolve, toType || 'image/png'));
    };
    window.JSZip = class JSZip {
      constructor() { this.files = {}; }
      file(name, content) { this.files[name] = content; }
      async generateAsync() { return new Blob(['fake-zip'], { type: 'application/zip' }); }
    };
  });
});

test('batch image converter converts mixed formats, decodes output and enforces max dimension & quality', async ({ page }) => {
  await page.goto('/batch-image-converter/');
  await expect(page.locator('h1')).toHaveText('Batch Image Converter');
  await expect(page.locator('.privacy')).toContainText('Your files never leave your machine.');

  const pngBuf = Buffer.from(await createTestImageBuffer(page, 800, 400, 'image/png'));
  const jpgBuf = Buffer.from(await createTestImageBuffer(page, 600, 600, 'image/jpeg'));
  const webpBuf = Buffer.from(await createTestImageBuffer(page, 400, 800, 'image/webp'));
  const heicBuf = Buffer.from('fake-heic-bytes');

  await page.locator('#imageFiles').setInputFiles([
    { name: 'photo1.png', mimeType: 'image/png', buffer: pngBuf },
    { name: 'photo2.jpg', mimeType: 'image/jpeg', buffer: jpgBuf },
    { name: 'photo3.webp', mimeType: 'image/webp', buffer: webpBuf },
    { name: 'photo4.heic', mimeType: 'image/heic', buffer: heicBuf }
  ]);

  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('.item-row')).toHaveCount(4);

  // Set output format to WebP, quality 80%, max dimension 200px
  await page.locator('#format').selectOption('image/webp');
  await page.locator('#quality').fill('80');
  await page.locator('#maxDimension').fill('200');

  await page.locator('#convertBatchBtn').click();

  // Wait for conversion completion
  await expect(page.locator('#batchStatus')).toContainText('finished', { timeout: 15000 });
  await expect(page.locator('.item-row.converted')).toHaveCount(4);

  // Assert actual output dimensions, format, and ratio preservation
  const outputMetrics = await page.evaluate(async () => {
    const items = window.__batchConverterState.items;
    const results = [];
    for (const item of items) {
      const img = new Image();
      const url = item.outputUrl;
      await new Promise(r => { img.onload = r; img.src = url; });
      results.push({
        name: item.file.name,
        width: img.naturalWidth,
        height: img.naturalHeight,
        type: item.outputBlob.type,
        size: item.outputBlob.size
      });
    }
    return results;
  });

  expect(outputMetrics).toHaveLength(4);

  // photo1: orig 800x400 -> maxDim 200 -> output 200x100
  const p1 = outputMetrics.find(m => m.name === 'photo1.png');
  expect(p1.width).toBe(200);
  expect(p1.height).toBe(100);
  expect(p1.type).toBe('image/webp');

  // photo2: orig 600x600 -> maxDim 200 -> output 200x200
  const p2 = outputMetrics.find(m => m.name === 'photo2.jpg');
  expect(p2.width).toBe(200);
  expect(p2.height).toBe(200);
  expect(p2.type).toBe('image/webp');

  // photo3: orig 400x800 -> maxDim 200 -> output 100x200
  const p3 = outputMetrics.find(m => m.name === 'photo3.webp');
  expect(p3.width).toBe(100);
  expect(p3.height).toBe(200);
  expect(p3.type).toBe('image/webp');

  // photo4: mock HEIC 400x300 -> maxDim 200 -> output 200x150
  const p4 = outputMetrics.find(m => m.name === 'photo4.heic');
  expect(p4.width).toBe(200);
  expect(p4.height).toBe(150);
  expect(p4.type).toBe('image/webp');

  // Download links enablement
  await expect(page.locator('#downloadAllBox')).toBeVisible();
  await expect(page.locator('#downloadZipBtn')).toBeEnabled();
  await expect(page.locator('.item-actions a.button.primary')).toHaveCount(4);
});

test('per-item failure isolation and retry functionality', async ({ page }) => {
  await page.goto('/batch-image-converter/');

  const validPng = Buffer.from(await createTestImageBuffer(page, 200, 200, 'image/png'));
  const corruptBuf = Buffer.from('this-is-not-an-image');

  await page.locator('#imageFiles').setInputFiles([
    { name: 'good.png', mimeType: 'image/png', buffer: validPng },
    { name: 'corrupt.png', mimeType: 'image/png', buffer: corruptBuf }
  ]);

  await page.locator('#convertBatchBtn').click();
  await expect(page.locator('#batchStatus')).toContainText('finished');

  await expect(page.locator('.item-row.converted')).toHaveCount(1);
  await expect(page.locator('.item-row.failed')).toHaveCount(1);

  // Download all ZIP available for converted item
  await expect(page.locator('#downloadAllBox')).toBeVisible();

  // Retry button available on corrupt item
  const retryBtn = page.locator('.item-row.failed .button:has-text("Retry")');
  await expect(retryBtn).toBeVisible();

  // Remove failed item
  const removeBtn = page.locator('.item-row.failed .button:has-text("Remove")');
  await removeBtn.click();

  await expect(page.locator('.item-row')).toHaveCount(1);
  await expect(page.locator('.item-row.converted')).toHaveCount(1);
});

test('batch file limit is enforced', async ({ page }) => {
  await page.goto('/batch-image-converter/');

  const png = Buffer.from(await createTestImageBuffer(page, 50, 50));
  const files = Array.from({ length: 31 }, (_, i) => ({
    name: `img_${i}.png`,
    mimeType: 'image/png',
    buffer: png
  }));

  await page.locator('#imageFiles').setInputFiles(files);
  await expect(page.locator('#globalError')).toBeVisible();
  await expect(page.locator('#globalError')).toContainText('up to 30 files');
  await expect(page.locator('#editor')).toBeHidden();
});

test('cancellation and resource cleanup', async ({ page }) => {
  await page.goto('/batch-image-converter/');

  const png = Buffer.from(await createTestImageBuffer(page, 100, 100));
  await page.locator('#imageFiles').setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: png },
    { name: 'b.png', mimeType: 'image/png', buffer: png },
    { name: 'c.png', mimeType: 'image/png', buffer: png }
  ]);

  await page.locator('#convertBatchBtn').click();
  // Click Cancel
  if (await page.locator('#cancelBtn').isVisible()) {
    await page.locator('#cancelBtn').click();
    await expect(page.locator('#batchStatus')).toContainText('cancelled');
  }

  // Clear All
  await page.locator('#clearBtn').click();
  await expect(page.locator('#editor')).toBeHidden();
  const itemCount = await page.evaluate(() => window.__batchConverterState.items.length);
  expect(itemCount).toBe(0);
});

test('bounded concurrency stays within limit of 2 workers', async ({ page }) => {
  await page.goto('/batch-image-converter/');

  const png = Buffer.from(await createTestImageBuffer(page, 300, 300));
  const files = Array.from({ length: 6 }, (_, i) => ({
    name: `batch_${i}.png`,
    mimeType: 'image/png',
    buffer: png
  }));

  await page.locator('#imageFiles').setInputFiles(files);
  await page.evaluate(() => window.__batchConverterState.resetMetrics());

  await page.locator('#convertBatchBtn').click();
  await expect(page.locator('#batchStatus')).toContainText('finished', { timeout: 15000 });

  const maxObserved = await page.evaluate(() => window.__batchConverterState.maxObservedConcurrency);
  expect(maxObserved).toBeGreaterThan(0);
  expect(maxObserved).toBeLessThanOrEqual(2);
});

test('no external network uploads during batch processing', async ({ page }) => {
  const requests = [];
  page.on('request', req => {
    if (req.method() === 'POST' || req.method() === 'PUT') {
      requests.push(req.url());
    }
  });

  await page.goto('/batch-image-converter/');
  const png = Buffer.from(await createTestImageBuffer(page, 100, 100));
  await page.locator('#imageFiles').setInputFiles([
    { name: 'test.png', mimeType: 'image/png', buffer: png }
  ]);

  await page.locator('#convertBatchBtn').click();
  await expect(page.locator('#batchStatus')).toContainText('finished');

  expect(requests).toHaveLength(0);
});

test('mobile viewport layout has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/batch-image-converter/');

  const png = Buffer.from(await createTestImageBuffer(page, 100, 100));
  await page.locator('#imageFiles').setInputFiles([
    { name: 'a-very-long-file-name-that-should-not-cause-horizontal-overflow-on-mobile-viewports.png', mimeType: 'image/png', buffer: png }
  ]);

  await expect(page.locator('#editor')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('Download all (.zip) button triggers zip download', async ({ page }) => {
  await page.goto('/batch-image-converter/');

  const png = Buffer.from(await createTestImageBuffer(page, 100, 100));
  await page.locator('#imageFiles').setInputFiles([
    { name: 'img1.png', mimeType: 'image/png', buffer: png },
    { name: 'img2.png', mimeType: 'image/png', buffer: png }
  ]);

  await page.locator('#convertBatchBtn').click();
  await expect(page.locator('#batchStatus')).toContainText('finished');

  await expect(page.locator('#downloadAllBox')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#downloadZipBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('converted-images.zip');
});

test('keyboard accessibility for batch actions', async ({ page }) => {
  await page.goto('/batch-image-converter/');

  const chooseBtn = page.locator('#chooseBtn');
  await chooseBtn.focus();
  await expect(chooseBtn).toBeFocused();

  const png = Buffer.from(await createTestImageBuffer(page, 100, 100));
  await page.locator('#imageFiles').setInputFiles([
    { name: 'kbd.png', mimeType: 'image/png', buffer: png }
  ]);

  await expect(page.locator('#editor')).toBeVisible();

  const convertBtn = page.locator('#convertBatchBtn');
  await convertBtn.focus();
  await expect(convertBtn).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.locator('#batchStatus')).toContainText('finished');
  await expect(page.locator('.item-row.converted')).toHaveCount(1);
});
