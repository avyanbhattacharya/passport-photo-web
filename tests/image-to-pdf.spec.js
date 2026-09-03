const { test, expect } = require('@playwright/test');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP8z8DAwMDAxMDAwMAAAAwAAWgmWQ0AAAAASUVORK5CYII=', 'base64');

test('Image to PDF accepts multiple images, reorders them, and creates a PDF', async ({ page }) => {
  await page.goto('/image-to-pdf/');
  const input = page.locator('#imageFiles');
  await input.setInputFiles([
    { name: 'first.png', mimeType: 'image/png', buffer: png },
    { name: 'second.png', mimeType: 'image/png', buffer: png }
  ]);
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('.row')).toHaveCount(2);
  await expect(page.locator('.name').nth(0)).toHaveText('first.png');
  await page.locator('.row').nth(0).getByTitle('Move down').click();
  await expect(page.locator('.name').nth(0)).toHaveText('second.png');
  await page.locator('#pageSize').selectOption('a4');
  await page.locator('#makePdf').click();
  await expect(page.locator('#result')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#download')).toHaveAttribute('download', 'images.pdf');
  await expect(page.locator('#resultText')).toContainText('2 images');
});

test('Image to PDF rejects unsupported files and stays mobile-safe', async ({ page }) => {
  await page.goto('/image-to-pdf/');
  await page.locator('#imageFiles').setInputFiles({ name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await expect(page.locator('#error')).toContainText('JPG, PNG or WebP');
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(m.sw - m.cw).toBeLessThanOrEqual(2);
});