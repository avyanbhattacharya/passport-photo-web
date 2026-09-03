const { test, expect } = require('@playwright/test');

async function testPng(page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 480;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d9d9d9'; ctx.fillRect(0,0,640,480);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(90,55); ctx.lineTo(555,75); ctx.lineTo(525,425); ctx.lineTo(110,405); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222'; ctx.font = '28px Arial'; ctx.fillText('TEST DOCUMENT',160,135);
    ctx.fillRect(160,175,300,8); ctx.fillRect(160,205,260,8); ctx.fillRect(160,235,310,8);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return { name: 'document.png', mimeType: 'image/png', buffer: Buffer.from(bytes) };
}

test('Add Document Photo button invokes the image picker', async ({ page }) => {
  await page.goto('/document-flattener/');
  await expect(page.locator('#libraryFile')).toHaveAttribute('accept', 'image/*');
  await page.evaluate(() => {
    const input = document.getElementById('libraryFile');
    window.__pickerClicked = false;
    input.click = () => { window.__pickerClicked = true; };
  });
  await page.getByRole('button', { name: /add document photo/i }).click();
  await expect.poll(() => page.evaluate(() => window.__pickerClicked)).toBe(true);
});

test('selected image opens editor and renders flattened result', async ({ page }) => {
  await page.goto('/document-flattener/');
  const file = await testPng(page);
  await page.locator('#libraryFile').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible({ timeout: 10000 });
  const sourceSize = await page.locator('#sourceCanvas').evaluate(c => ({ width:c.width, height:c.height }));
  expect(sourceSize.width).toBeGreaterThan(0);
  expect(sourceSize.width).toBeLessThanOrEqual(640);
  expect(sourceSize.height).toBeGreaterThan(0);
  await expect.poll(() => page.locator('#resultCanvas').evaluate(c => c.width), { timeout: 10000 }).toBeGreaterThan(0);
  await expect(page.locator('#status')).toContainText('Output');
  await expect(page.locator('.corner')).toHaveCount(4);
});

test('finish modes are selectable and do not lose the document', async ({ page }) => {
  await page.goto('/document-flattener/');
  const file = await testPng(page);
  await page.locator('#libraryFile').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();
  for (const name of ['Clean', 'B&W', 'Original']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveClass(/active/);
    await expect.poll(() => page.locator('#resultCanvas').evaluate(c => c.width)).toBeGreaterThan(0);
  }
});

test('corner handles stay aligned with displayed source image', async ({ page }) => {
  await page.goto('/document-flattener/');
  const file = await testPng(page);
  await page.locator('#libraryFile').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const c=document.getElementById('sourceCanvas').getBoundingClientRect();
    return [...document.querySelectorAll('.corner')].every(el => {
      const h=el.getBoundingClientRect(),cx=h.left+h.width/2,cy=h.top+h.height/2;
      return cx>=c.left-2&&cx<=c.right+2&&cy>=c.top-2&&cy<=c.bottom+2;
    });
  })).toBe(true);
});

test('document editor has no horizontal page overflow on phone-sized viewport', async ({ page }) => {
  await page.goto('/document-flattener/');
  const file = await testPng(page);
  await page.locator('#libraryFile').setInputFiles(file);
  await expect(page.locator('#editor')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});