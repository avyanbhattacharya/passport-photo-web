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
  await expect(page.locator('#preview')).toHaveAttribute('width', '630');
  await expect(page.locator('#preview')).toHaveAttribute('height', '810');

  await page.locator('#brightness').evaluate(el => {
    el.value = '10';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#brightnessValue')).toHaveText('10');

  await page.getByRole('button', { name: 'Reset adjustments' }).click();
  await expect(page.locator('#brightness')).toHaveValue('0');
});


test('passport editor preview stays contained on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/passport-photo/');
  const fixture = path.join(__dirname, 'fixtures', 'passport-test.svg');
  await page.locator('#fileInput').setInputFiles(fixture);
  const bounds = await page.locator('#previewGuide').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { right: rect.right, viewport: document.documentElement.clientWidth };
  });
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
});

test('passport 4x6 print sheet downloads after an image is loaded', async ({ page }) => {
  await page.goto('/passport-photo/');
  const fixture = path.join(__dirname, 'fixtures', 'passport-test.svg');
  await page.locator('#fileInput').setInputFiles(fixture);
  await expect(page.locator('#downloadCard')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /download 4×6 print sheet/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('passport-photo-4x6-sheet-6-copies.jpg');
});

test('630 by 810 passport download is JPEG and stays within 250 KB', async ({ page }) => {
  await page.goto('/passport-photo/');
  const fixture = path.join(__dirname, 'fixtures', 'passport-test.svg');
  await page.locator('#fileInput').setInputFiles(fixture);
  await page.locator('#format').selectOption('35x45');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download single photo/i }).click()
  ]);
  expect(download.suggestedFilename()).toBe('630x810-passport-photo.jpg');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  expect(bytes.length).toBeLessThanOrEqual(250 * 1024);
  expect(bytes.subarray(0, 3).toString('hex')).toBe('ffd8ff');
  const dimensions = await page.evaluate(async base64 => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
    image.onerror = reject;
    image.src = `data:image/jpeg;base64,${base64}`;
  }), bytes.toString('base64'));
  expect(dimensions).toEqual([630, 810]);
});

test('auto-position reserves hairline headroom rather than filling the crop', async ({ page }) => {
  await page.goto('/passport-photo/');
  const behavior = await page.evaluate(async () => (await (await fetch('/assets/advanced.js')).text()));

  // Face landmarks omit the crown, so these calibrated targets aim for the
  // required 80–85% full-head height while retaining a hair margin.
  expect(behavior).toContain('targetFace:.64');
  expect(behavior).toContain('targetEye:.48');
  expect(behavior).toContain('estimatedCrown=m.minY-m.faceH*.14');
  expect(behavior).toContain("msg.textContent='Loading the on-device face model…'");
  expect(behavior).toContain("msg.textContent='Applying the passport framing…'");
  expect(behavior).toContain('withTimeout(imageLandmarker(),20000');
  expect(behavior.match(/await detectPreview/g)).toHaveLength(1);
  expect(behavior).not.toContain('for(let pass=0;pass<3;pass++)');
});


test('35×45 print sheet downloads the guide-friendly six-copy layout', async ({ page }) => {
  await page.goto('/passport-photo/');
  const fixture = path.join(__dirname, 'fixtures', 'passport-test.svg');
  await page.locator('#fileInput').setInputFiles(fixture);
  await page.locator('#format').selectOption('35x45');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download 4×6 print sheet/i }).click()
  ]);
  expect(download.suggestedFilename()).toBe('passport-photo-4x6-sheet-6-copies.jpg');
});


test('auto-position and framing checks use an appropriate profile for both output formats', async ({ page }) => {
  await page.goto('/passport-photo/');
  const behavior = await page.evaluate(async () => (await (await fetch('/assets/advanced.js')).text()));
  const checks = await page.evaluate(async () => (await (await fetch('/assets/app.js')).text()));

  expect(behavior).toContain("targetFace:.43");
  expect(behavior).toContain("targetEye:.44");
  expect(behavior).toContain("targetFace:.64");
  expect(behavior).toContain("targetEye:.48");
  expect(checks).toContain("framing=window.getPassportFormat().framing");
  expect(checks).toContain("passMin:.34,passMax:.52");
  expect(checks).toContain("passMin:.41,passMax:.49");

  const profiles = await page.evaluate(() => ({
    us: window.passportAutoPositionProfile('us').targetFace,
    biometric: window.passportAutoPositionProfile('biometric').targetFace,
    canada: window.passportAutoPositionProfile('canada').targetFace,
    custom: window.passportAutoPositionProfile('custom').targetFace
  }));
  expect(profiles).toEqual({ us: .43, biometric: .64, canada: .46, custom: .52 });
});

test('2×2 print sheet uses a clean exact six-copy layout', async ({ page }) => {
  await page.goto('/passport-photo/');
  const fixture = path.join(__dirname, 'fixtures', 'passport-test.svg');
  await page.locator('#fileInput').setInputFiles(fixture);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /download 4×6 print sheet/i }).click()
  ]);
  expect(download.suggestedFilename()).toBe('passport-photo-4x6-sheet-6-copies.jpg');
});


test('passport format library includes common verified sizes and a custom option', async ({ page }) => {
  await page.goto('/passport-photo/');
  const fixture = path.join(__dirname, 'fixtures', 'passport-test.svg');
  await page.locator('#fileInput').setInputFiles(fixture);
  const format = page.locator('#format');
  await expect(format.locator('option')).toHaveCount(8);
  await format.selectOption('canada-50x70');
  await expect(page.locator('#preview')).toHaveAttribute('width', '591');
  await expect(page.locator('#preview')).toHaveAttribute('height', '827');
  await format.selectOption('custom');
  await expect(page.locator('#customFormatControls')).toBeVisible();
  await page.locator('#customWidth').fill('35');
  await page.locator('#customHeight').fill('45');
  await expect(page.locator('#preview')).toHaveAttribute('width', '413');
  await expect(page.locator('#preview')).toHaveAttribute('height', '531');
});

test('print layout uses clean exact tiling and outside guides only when space permits', async ({ page }) => {
  await page.goto('/passport-photo/');
  const app = await page.evaluate(async () => (await (await fetch('/assets/app.js')).text()));
  expect(app).toContain('layout.exact');
  expect(app).toContain('showGuides=!layout.exact');
  expect(app).toContain('sheetLayout(format.printW,format.printH)');
});
