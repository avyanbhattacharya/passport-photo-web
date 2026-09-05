const { test, expect } = require('@playwright/test');

const tools = [
  ['/', /Useful file tools/i],
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
  ['/qr-code-maker/', /QR Code Maker/i],
  ['/about/', /Mission and Vision/i],
  ['/principles/', /Project Principles/i]
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

    const metrics = await page.evaluate(() => {
      const clientWidth = document.documentElement.clientWidth;
      const offenders = [...document.querySelectorAll('body *')]
        .map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            className: typeof el.className === 'string' ? el.className : '',
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth
          };
        })
        .filter(item => item.right > clientWidth + 2 || item.left < -2 || item.scrollWidth > item.clientWidth + 2)
        .slice(0, 12);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth,
        offenders
      };
    });
    const overflowMessage = `${route} horizontal overflow; offenders=${JSON.stringify(metrics.offenders)}`;
    expect(metrics.scrollWidth - metrics.clientWidth, overflowMessage).toBeLessThanOrEqual(2);

    expect(pageErrors, `page errors on ${route}`).toEqual([]);
    expect(brokenLocal, `broken local assets on ${route}`).toEqual([]);
  });
}

test('documentation pages use the open site-aligned editorial layout', async ({ page }) => {
  await page.goto('/about/', { waitUntil: 'domcontentloaded' });
  const metrics = await page.evaluate(() => {
    const article = document.querySelector('.doc-article');
    const content = document.querySelector('.doc-content');
    const articleBox = article.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();
    const articleStyle = getComputedStyle(article);
    return {
      viewportWidth: document.documentElement.clientWidth,
      articleLeft: articleBox.left,
      articleWidth: articleBox.width,
      contentLeft: contentBox.left,
      contentWidth: contentBox.width,
      articleBackground: articleStyle.backgroundColor,
      articleBorderWidth: articleStyle.borderTopWidth,
      articleRadius: articleStyle.borderTopLeftRadius
    };
  });
  expect(metrics.articleWidth).toBeGreaterThan(Math.min(metrics.viewportWidth - 80, 900));
  expect(Math.abs(metrics.articleLeft - metrics.contentLeft)).toBeLessThanOrEqual(1);
  expect(metrics.contentWidth).toBeLessThanOrEqual(760);
  expect(metrics.articleBackground).toBe('rgba(0, 0, 0, 0)');
  expect(metrics.articleBorderWidth).toBe('0px');
  expect(metrics.articleRadius).toBe('0px');
});
