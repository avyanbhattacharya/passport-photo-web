const { test, expect } = require('@playwright/test');

const pngBytes = Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAAAwAAWgmWQ0AAAAASUVORK5CYII=', 'base64'));

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.addInitScript(bytes => {
    window.heic2any = async ({ toType }) => new Blob([new Uint8Array(bytes)], { type: toType });
  }, pngBytes);
});

test('HEIC converter accepts files and creates downloadable JPG output', async ({ page }) => {
  await page.goto('/heic-to-jpg/');
  await page.locator('#heicFiles').setInputFiles({ name: 'iphone.heic', mimeType: 'image/heic', buffer: Buffer.from('fake-heic') });
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('.name')).toHaveText('iphone.heic');
  await page.locator('#convertBtn').click();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('.download-row')).toHaveCount(1);
  await expect(page.locator('.download-row a')).toHaveAttribute('download', 'iphone.jpg');
});

test('HEIC converter switches to PNG and rejects unrelated files', async ({ page }) => {
  await page.goto('/heic-to-jpg/');
  await page.locator('#heicFiles').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
  await expect(page.locator('#error')).toContainText('HEIC or HEIF');
  await page.locator('#heicFiles').setInputFiles({ name: 'photo.heif', mimeType: 'image/heif', buffer: Buffer.from('fake') });
  await page.locator('#format').selectOption('image/png');
  await expect(page.locator('#quality')).toBeDisabled();
  await page.locator('#convertBtn').click();
  await expect(page.locator('.download-row a')).toHaveAttribute('download', 'photo.png');
});