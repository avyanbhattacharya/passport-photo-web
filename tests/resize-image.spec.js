const { test, expect } = require('@playwright/test');

async function uploadTestImage(page) {
  const png = await page.evaluate(async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/><rect x="0" y="0" width="400" height="600" fill="red"/><rect x="400" y="0" width="400" height="600" fill="blue"/></svg>`;
    const img = new Image(); img.src = 'data:image/svg+xml,' + encodeURIComponent(svg); await img.decode();
    const c=document.createElement('canvas'); c.width=800;c.height=600;c.getContext('2d').drawImage(img,0,0);
    const b=await new Promise(r=>c.toBlob(r,'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  await page.locator('#imageFile').setInputFiles({ name:'test.png', mimeType:'image/png', buffer:Buffer.from(png) });
  await expect(page.locator('#editor')).toBeVisible();
}

test('image tool loads image and applies exact dimensions', async ({ page }) => {
  await page.goto('/resize-image/');
  await expect(page.getByRole('heading', { name: /resize & compress image/i })).toBeVisible();
  await uploadTestImage(page);
  await expect(page.locator('#originalInfo')).toContainText('800 × 600');
  await page.getByRole('button', { name:'1:1' }).click();
  await page.locator('#width').fill('600');
  await expect(page.locator('#height')).toHaveValue('600');
  await page.locator('#format').selectOption('image/jpeg');
  await page.locator('#targetSize').fill('200');
  await page.getByRole('button', { name:/resize & compress image/i }).click();
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#checks')).toContainText('600 × 600 px');
  await expect(page.locator('#checks')).toContainText('JPG');
  await expect(page.locator('#checks')).toContainText('Under 200.0 KB');
  await expect(page.locator('#resultMeta')).toContainText('Crop');
});

test('fit crop exposes an aspect-locked draggable crop selector', async ({ page }) => {
  await page.goto('/resize-image/');
  await uploadTestImage(page);
  await page.getByRole('button', { name:'1:1' }).click();
  const overlay = page.locator('#cropOverlay');
  await expect(overlay).toBeVisible();
  await expect(page.locator('#cropInfo')).toContainText('Selected 600 × 600 px');
  const before = await overlay.boundingBox();
  expect(before).toBeTruthy();
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 40, before.y + before.height / 2);
  await page.mouse.up();
  const after = await overlay.boundingBox();
  expect(after.x).toBeGreaterThan(before.x);
  await page.getByRole('button', { name:/reset crop/i }).click();
  const reset = await overlay.boundingBox();
  expect(Math.abs(reset.x - before.x)).toBeLessThan(3);
});

test('contain mode hides crop selector because the whole image is retained', async ({ page }) => {
  await page.goto('/resize-image/');
  await uploadTestImage(page);
  await page.getByText('Contain', { exact:true }).click();
  await expect(page.locator('#cropPanel')).toBeHidden();
  await expect(page.locator('#outputSummary')).toContainText('800 × 600 px');
});

test('image tool states local processing privacy boundary', async ({ page }) => {
  await page.goto('/resize-image/');
  await expect(page.locator('.privacy')).toContainText('stays on your device');
  await expect(page.locator('.privacy')).toContainText('No image-processing server');
});
