const { test, expect } = require('@playwright/test');

const pages = [
  ['/', 'https://cleanlocaltools.com/'],
  ['/passport-photo/', 'https://cleanlocaltools.com/passport-photo/'],
  ['/japa-counter/', 'https://cleanlocaltools.com/japa-counter/'],
  ['/japa-counter/tap.html', 'https://cleanlocaltools.com/japa-counter/tap.html'],
  ['/compress-pdf/', 'https://cleanlocaltools.com/compress-pdf/'],
  ['/merge-pdf/', 'https://cleanlocaltools.com/merge-pdf/']
];

for (const [path, canonical] of pages) {
  test(`${path} has canonical metadata and noindex is absent`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots || '').not.toMatch(/noindex/i);
  });
}

test('sitemap lists every public tool page', async ({ request }) => {
  const response = await request.get('/sitemap.xml');
  expect(response.ok()).toBeTruthy();
  const xml = await response.text();
  for (const [, canonical] of pages) expect(xml).toContain(`<loc>${canonical}</loc>`);
});
