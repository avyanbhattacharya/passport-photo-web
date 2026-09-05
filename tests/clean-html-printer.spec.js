const { test, expect } = require('@playwright/test');
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const sample = `<article><h1>My article</h1><section><p>Unwanted promotion</p><img src="${pixel}" alt="Promotion"></section><p>Keep this paragraph</p><p>Last paragraph</p></article>`;
async function open(page, html = sample) {
  await page.goto('/clean-html-printer/');
  await page.locator('summary').click();
  await page.locator('#source').fill(html);
  await page.locator('#openPaste').click();
  await expect(page.locator('#print')).toBeEnabled();
  return page.frameLocator('#preview');
}
test('section deletion closes the gap, undo and redo restore history, reset restores original', async ({ page }) => {
  const doc = await open(page);
  const before = await doc.getByText('Keep this paragraph').boundingBox();
  await doc.getByText('Unwanted promotion').click();
  await page.locator('#parent').click();
  await expect(page.locator('#selection')).toContainText('section');
  await page.locator('#remove').click();
  await expect(doc.locator('section')).toHaveCount(0);
  const after = await doc.getByText('Keep this paragraph').boundingBox();
  expect(after.y).toBeLessThan(before.y);
  await page.locator('#undo').click(); await expect(doc.locator('section')).toHaveCount(1);
  await page.locator('#redo').click(); await expect(doc.locator('section')).toHaveCount(0);
  await page.locator('#reset').click(); await expect(doc.locator('section')).toHaveCount(1);
  await expect(page.locator('#undo')).toBeDisabled();
});
test('remove all images, keyboard selection, and new edit clears redo', async ({ page }) => {
  const doc = await open(page);
  await page.locator('#images').click(); await expect(doc.locator('img')).toHaveCount(0);
  await page.locator('#undo').click(); await expect(doc.locator('img')).toHaveCount(1);
  await doc.getByText('Last paragraph').focus(); await doc.getByText('Last paragraph').press('Enter');
  await page.locator('#remove').click(); await expect(doc.getByText('Last paragraph')).toHaveCount(0);
  await expect(page.locator('#redo')).toBeDisabled();
});
test('untrusted HTML cannot run scripts, navigate or fetch remote resources', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (request.url().includes('evil.invalid')) requests.push(request.url()); });
  const doc = await open(page, `<html><head><base href="https://evil.invalid/"><meta http-equiv="refresh" content="0;url=https://evil.invalid/"><style>@import 'https://evil.invalid/css';</style></head><body onload="parent.hacked=true"><script>parent.hacked=true</script><iframe src="https://evil.invalid/"></iframe><img src="https://evil.invalid/image" onerror="parent.hacked=true"><svg><image href="https://evil.invalid/svg"/></svg><form action="https://evil.invalid"><input value="secret"></form><a href="javascript:parent.hacked=true">Safe text</a><div style="height:9999px;background:url(https://evil.invalid/bg)">Keep content</div></body></html>`);
  await expect(doc.getByText('Keep content')).toBeVisible();
  await expect(doc.locator('script,iframe,svg,form,input,a,img,link,base')).toHaveCount(0);
  await expect(doc.locator('body [style],body [onload],body [onerror]')).toHaveCount(0);
  expect(await page.evaluate(() => window.hacked)).toBeUndefined();
  expect(requests).toEqual([]);
});
test('file upload works, invalid and oversized input preserve the previous document', async ({ page }) => {
  await page.goto('/clean-html-printer/');
  await page.locator('#htmlFile').setInputFiles({ name: 'article.html', mimeType: 'text/html', buffer: Buffer.from(sample) });
  await expect(page.frameLocator('#preview').locator('h1')).toHaveText('My article');
  await page.locator('#htmlFile').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('no') });
  await expect(page.locator('#error')).toContainText('choose an HTML');
  await page.locator('#htmlFile').setInputFiles({ name: 'large.html', mimeType: 'text/html', buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 'a') });
  await expect(page.locator('#error')).toContainText('smaller than 2 MB');
  await expect(page.frameLocator('#preview').locator('h1')).toHaveText('My article');
});
test('empty input is explained, tables survive and empty output cannot print', async ({ page }) => {
  const doc = await open(page, '<table><tr><td>Only content</td></tr></table>');
  await expect(doc.locator('td')).toHaveText('Only content');
  await doc.locator('table').focus(); await doc.locator('table').press('Enter');
  await page.locator('#remove').click(); await expect(doc.locator('table')).toHaveCount(0);
  await page.locator('#print').click(); await expect(page.locator('#status')).toContainText('Keep some content');
  await page.locator('#source').fill('<script>alert(1)</script>'); await page.locator('#openPaste').click();
  await expect(page.locator('#error')).toContainText('No printable content');
});
test('print settings reach the isolated document and selection never prints', async ({ page }) => {
  const doc = await open(page);
  await page.locator('#paper').selectOption('Letter');
  await page.locator('#orientation').selectOption('landscape');
  await page.locator('#fontSize').selectOption('14');
  await expect(doc.locator('#printStyles')).toHaveJSProperty('textContent', expect.stringContaining('size:Letter landscape'));
  await expect(doc.locator('#printStyles')).toHaveJSProperty('textContent', expect.stringContaining('font-size:14pt'));
  await page.locator('#preview').evaluate(frame => { frame.contentWindow.print = () => { frame.dataset.printed = 'yes'; }; });
  await doc.getByText('Keep this paragraph').click();
  await page.locator('#print').click();
  await expect(page.locator('#preview')).toHaveAttribute('data-printed', 'yes');
  await expect(doc.locator('[data-selected]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
});
