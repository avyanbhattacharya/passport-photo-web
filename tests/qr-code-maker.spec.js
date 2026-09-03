const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.addInitScript(() => {
    function QRCode(el, options) {
      const canvas = document.createElement('canvas');
      canvas.width = options.width; canvas.height = options.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 16, 16);
      el.appendChild(canvas);
    }
    QRCode.CorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };
    window.QRCode = QRCode;
  });
});

test('QR maker validates empty input and generates a downloadable PNG', async ({ page }) => {
  await page.goto('/qr-code-maker/');
  await page.locator('#generateBtn').click();
  await expect(page.locator('#error')).toContainText('Enter a link');
  await page.locator('#content').fill('https://cleanlocaltools.com/');
  await page.locator('#size').selectOption('256');
  await page.locator('#level').selectOption('H');
  await page.locator('#generateBtn').click();
  await expect(page.locator('#result')).toBeVisible();
  const canvas = page.locator('#qrOutput canvas');
  await expect(canvas).toHaveAttribute('data-encoded', 'https://cleanlocaltools.com/');
  await expect(canvas).toHaveJSProperty('width', 256);
  await expect(page.locator('#download')).toHaveAttribute('download', 'qr-code.png');
  await expect(page.locator('#download')).toHaveAttribute('href', /^data:image\/png/);
});

test('QR maker remains within viewport on mobile-sized layouts', async ({ page }) => {
  await page.goto('/qr-code-maker/');
  await page.locator('#content').fill('hello');
  await page.locator('#generateBtn').click();
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(m.sw - m.cw).toBeLessThanOrEqual(2);
});