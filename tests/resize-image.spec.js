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

test('choose image button invokes the native file input', async ({ page }) => {
  await page.goto('/resize-image/');
  await expect(page.locator('#imageFile')).toHaveAttribute('accept','image/*');
  await page.evaluate(() => {
    const input=document.getElementById('imageFile');
    window.__pickerInvoked=false;
    input.click=()=>{window.__pickerInvoked=true};
  });
  await page.getByRole('button',{name:'Choose image'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__pickerInvoked)).toBe(true);
});

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
  await expect(page.locator('#result')).toBeVisible({timeout:15000});
  await expect(page.locator('#checks')).toContainText('600 × 600 px');
  await expect(page.locator('#checks')).toContainText('JPG');
  await expect(page.locator('#checks')).toContainText('Under 200.0 KB');
  await expect(page.locator('#resultMeta')).toContainText('View');
});

test('crop frame is fixed by aspect ratio and can be repositioned', async ({ page }) => {
  await page.goto('/resize-image/');
  await uploadTestImage(page);
  await page.getByRole('button', { name:'1:1' }).click();
  const overlay = page.locator('#cropOverlay');
  await expect(overlay).toBeVisible();
  await expect(page.locator('#cropSizeControls')).toHaveCount(0);
  await expect(overlay.locator('.handle')).toHaveCount(0);
  const before = await overlay.boundingBox();
  expect(before).toBeTruthy();
  expect(Math.abs(before.width - before.height)).toBeLessThan(3);
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 40, before.y + before.height / 2);
  await page.mouse.up();
  const after = await overlay.boundingBox();
  expect(after.x).toBeGreaterThan(before.x);
  expect(Math.abs(after.width - before.width)).toBeLessThan(1);
});

test('image zoom works above and below 100 percent while frame stays fixed', async ({ page }) => {
  await page.goto('/resize-image/');
  await uploadTestImage(page);
  await page.getByRole('button', { name:'1:1' }).click();
  const overlay = page.locator('#cropOverlay');
  const canvas = page.locator('#preview');
  const cropBefore = await overlay.boundingBox();
  const imageBefore = await canvas.boundingBox();

  await page.getByRole('button', { name:'Zoom image in' }).click();
  await expect(page.locator('#imageZoomValue')).toHaveText('110%');
  const cropAfterIn = await overlay.boundingBox();
  const imageAfterIn = await canvas.boundingBox();
  expect(Math.abs(cropAfterIn.width - cropBefore.width)).toBeLessThan(1);
  expect(imageAfterIn.width).toBeGreaterThan(imageBefore.width);

  await page.getByRole('button', { name:'Zoom image out' }).click();
  await page.getByRole('button', { name:'Zoom image out' }).click();
  await expect(page.locator('#imageZoomValue')).toHaveText('90%');
  const cropAfterOut = await overlay.boundingBox();
  const imageAfterOut = await canvas.boundingBox();
  expect(Math.abs(cropAfterOut.width - cropBefore.width)).toBeLessThan(1);
  expect(imageAfterOut.width).toBeLessThan(imageBefore.width);
});

test('zoom slider supports values below 100 percent', async ({ page }) => {
  await page.goto('/resize-image/');
  await uploadTestImage(page);
  await page.getByRole('button', { name:'1:1' }).click();
  await expect(page.locator('#imageZoomRange')).toHaveAttribute('min','50');
  await page.locator('#imageZoomRange').fill('75');
  await expect(page.locator('#imageZoomValue')).toHaveText('75%');
});

test('two-finger pinch changes image zoom in both directions', async ({ page }) => {
  await page.goto('/resize-image/');
  await uploadTestImage(page);
  await page.getByRole('button', { name:'1:1' }).click();
  await page.evaluate(() => {
    const el=document.getElementById('cropStage');
    const fire=(type,id,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y,isPrimary:id===1}));
    fire('pointerdown',1,200,250); fire('pointerdown',2,300,250);
    fire('pointermove',1,170,250); fire('pointermove',2,330,250);
    fire('pointerup',1,170,250); fire('pointerup',2,330,250);
  });
  let value = Number((await page.locator('#imageZoomValue').textContent()).replace('%',''));
  expect(value).toBeGreaterThan(100);

  await page.getByRole('button', { name:/reset crop/i }).click();
  await page.evaluate(() => {
    const el=document.getElementById('cropStage');
    const fire=(type,id,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',clientX:x,clientY:y,isPrimary:id===1}));
    fire('pointerdown',1,170,250); fire('pointerdown',2,330,250);
    fire('pointermove',1,210,250); fire('pointermove',2,290,250);
    fire('pointerup',1,210,250); fire('pointerup',2,290,250);
  });
  value = Number((await page.locator('#imageZoomValue').textContent()).replace('%',''));
  expect(value).toBeLessThan(100);
});

test('contain mode keeps full image preview visible and hides crop adjustments', async ({ page }) => {
  await page.goto('/resize-image/');
  await uploadTestImage(page);
  await page.getByText('Contain', { exact:true }).click();
  await expect(page.locator('#cropPanel')).toBeVisible();
  await expect(page.locator('#preview')).toBeVisible();
  await expect(page.locator('#cropOverlay')).toBeHidden();
  await expect(page.getByRole('button', { name:/reset crop/i })).toBeHidden();
  await expect(page.locator('#cropAdjustments')).toBeHidden();
  await expect(page.locator('#previewTitle')).toHaveText('Image preview');
  await expect(page.locator('#previewSubtitle')).toContainText('entire image');
  await expect(page.locator('#cropInfo')).toContainText('Full image 800 × 600 px');
});

test('image tool states local processing privacy boundary', async ({ page }) => {
  await page.goto('/resize-image/');
  await expect(page.locator('.privacy')).toContainText('stays on your device');
  await expect(page.locator('.privacy')).toContainText('No image-processing server');
});