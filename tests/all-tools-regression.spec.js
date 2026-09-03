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
  ['/document-flattener/', /Document Flattener/i]
];

for (const [route, heading] of tools) {
  test(`${route} loads without app errors or broken local assets`, async ({ page }) => {
    const pageErrors = [];
    const brokenLocal = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('response', response => {
      const url = response.url();
      if (url.startsWith('http://127.0.0.1:4173') && response.status() >= 400) brokenLocal.push(`${response.status()} ${url}`);
    });
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();
    await expect(page.locator('h1').first()).toContainText(heading);
    await page.waitForTimeout(250);
    expect(pageErrors, `page errors on ${route}`).toEqual([]);
    expect(brokenLocal, `broken local assets on ${route}`).toEqual([]);
  });

  test(`${route} stays within the viewport`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    expect(metrics.scrollWidth - metrics.clientWidth, `${route} horizontal overflow`).toBeLessThanOrEqual(2);
  });
}

test('every sitemap tool URL is reachable locally', async ({ request }) => {
  const sitemapResponse = await request.get('/sitemap.xml');
  expect(sitemapResponse.ok()).toBeTruthy();
  const sitemap = await sitemapResponse.text();
  const paths = [...sitemap.matchAll(/<loc>https:\/\/cleanlocaltools\.com([^<]*)<\/loc>/g)].map(m => m[1] || '/');
  expect(paths.length).toBeGreaterThanOrEqual(tools.length);
  for (const path of paths) {
    const response = await request.get(path || '/');
    expect(response.ok(), `${path} from sitemap should be reachable`).toBeTruthy();
  }
});