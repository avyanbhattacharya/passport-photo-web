const { test, expect } = require('@playwright/test');

const pages = [
  ['/', 'https://cleanlocaltools.com/'],
  ['/passport-photo/', 'https://cleanlocaltools.com/passport-photo/'],
  ['/japa-counter/', 'https://cleanlocaltools.com/japa-counter/'],
  ['/japa-counter/tap.html', 'https://cleanlocaltools.com/japa-counter/tap.html'],
  ['/compress-pdf/', 'https://cleanlocaltools.com/compress-pdf/'],
  ['/merge-pdf/', 'https://cleanlocaltools.com/merge-pdf/'],
  ['/resize-image/', 'https://cleanlocaltools.com/resize-image/'],
  ['/clean-pdf-printer/', 'https://cleanlocaltools.com/clean-pdf-printer/'],
  ['/document-flattener/', 'https://cleanlocaltools.com/document-flattener/'],
  ['/image-to-pdf/', 'https://cleanlocaltools.com/image-to-pdf/'],
  ['/split-pdf/', 'https://cleanlocaltools.com/split-pdf/'],
  ['/heic-to-jpg/', 'https://cleanlocaltools.com/heic-to-jpg/'],
  ['/remove-photo-metadata/', 'https://cleanlocaltools.com/remove-photo-metadata/'],
  ['/qr-code-maker/', 'https://cleanlocaltools.com/qr-code-maker/']
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