const { test, expect } = require('@playwright/test');

const tools = [
  ['/', /Clean Local Tools|Simple tools/i],
  ['/passport-photo/', /Passport Photo/i],
  ['/japa-counter/', /Japa Counter/i],
  ['/japa-counter/tap.html', /Japa Counter/i],
  ['/compress-pdf/', /Compress PDF/i],
  ['/merge-pdf/', /Merge PDF/i],
  ['/resize-image/', /Resize & Compress Image/i],
  ['/clean-pdf-printer/', /Clean PDF Printer/i],
  ['/document-flattener/', /Document Flattener/i],
  ['/image-to-pdf/', /Image to PDF/i],
  ['/split-pdf/', /Split PDF/i],
  ['/heic-to-jpg/', /HEIC to JPG/i],
  ['/remove-photo-metadata/', /Remove Photo Metadata/i],
  ['/qr-code-maker/', /QR Code Maker/i]
];

for (const [route, heading] of tools) {
  test(`${route} cross-browser smoke`, async ({ page }) => {
    const pageErrors = [];
    const brokenLocal = [];

    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('response', response => {
      const url = response.url();
      if (url.startsWith('http://127.0.0.1:4173') && response.status() >= 400) {
        brokenLocal.push(`${response.status()} ${url}`);
      }
    });

    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();
    await expect(page.locator('h1').first()).toContainText(heading);
    await expect(page.locator('body')).toContainText('Your files never leave your machine.');

    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    expect(metrics.scrollWidth - metrics.clientWidth, `${route} horizontal overflow`).toBeLessThanOrEqual(2);

    expect(pageErrors, `page errors on ${route}`).toEqual([]);
    expect(brokenLocal, `broken local assets on ${route}`).toEqual([]);
  });
}
