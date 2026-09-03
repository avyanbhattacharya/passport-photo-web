const { test, expect } = require('@playwright/test');
const path = require('path');
const fixture = path.join(__dirname, 'fixtures', 'image-test.svg');

test('image tool loads image and applies exact dimensions', async ({ page }) => {
  await page.goto('/resize-image/');
  await expect(page.getByRole('heading', { name: /resize & compress image/i })).toBeVisible();
  // SVG is intentionally converted to PNG in-browser so the production input path receives a supported raster image.
  const png = await page.evaluate(async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><rect x="50" y="50" width="700" height="500" fill="lightblue"/></svg>`;
    const img = new Image(); img.src = 'data:image/svg+xml,' + encodeURIComponent(svg); await img.decode();
    const c=document.createElement('canvas'); c.width=800;c.height=600;c.getContext('2d').drawImage(img,0,0);
    const b=await new Promise(r=>c.toBlob(r,'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  await page.locator('#imageFile').setInputFiles({ name:'test.png', mimeType:'image/png', buffer:Buffer.from(png) });
  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#originalInfo')).toContainText('800 × 600');
  await page.getByRole('button', { name:'1:1' }).click();
  await page.locator('#width').fill('600');
  await expect(page.locator('#height')).toHaveValue('600');
  await page.locator('#format').selectOption('image/jpeg');
  await page.locator('#targetSize').fill('200');
  await page.getByRole('button', { name:/make image fit requirements/i }).click();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#checks')).toContainText('600 × 600 px');
  await expect(page.locator('#checks')).toContainText('JPG');
  await expect(page.locator('#checks')).toContainText('Under 200.0 KB');
});

test('image tool states local processing privacy boundary', async ({ page }) => {
  await page.goto('/resize-image/');
  await expect(page.locator('.privacy')).toContainText('stays on your device');
  await expect(page.locator('.privacy')).toContainText('No image-processing server');
});
