const { test, expect } = require('@playwright/test');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAAAwAAWgmWQ0AAAAASUVORK5CYII=', 'base64');

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.addInitScript(() => {
    window.exifr = { parse: async () => ({ latitude: 33.2, longitude: -111.8, Make: 'Example Camera', DateTimeOriginal: '2026-09-03' }) };
  });
});

test('Metadata remover displays found fields and creates a clean copy', async ({ page }) => {
  await page.goto('/remove-photo-metadata/');
  await page.locator('#photoFile').setInputFiles({ name: 'vacation.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#metadata')).toContainText('latitude');
  await expect(page.locator('#metadata')).toContainText('Example Camera');
  await expect(page.locator('#note')).toContainText('embedded metadata');
  await page.locator('#cleanBtn').click();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#download')).toHaveAttribute('download', 'vacation-clean.png');
});

test('Metadata remover rejects unreadable image data without crashing', async ({ page }) => {
  await page.goto('/remove-photo-metadata/');
  await page.locator('#photoFile').setInputFiles({ name: 'bad.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not-an-image') });
  await expect(page.locator('#error')).toContainText('could not be read');
  await expect(page.locator('#editor')).toBeHidden();
});