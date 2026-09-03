const { test, expect } = require('@playwright/test');

test('homepage exposes every current tool and navigation works', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Clean Local Tools/);
  await expect(page.getByRole('heading', { name: /simple tools/i })).toBeVisible();

  const tools = [
    [/passport photo/i, /\/passport-photo\/$/, /passport photo/i],
    [/japa counter/i, /\/japa-counter\/$/, /touchless japa counter/i],
    [/compress pdf/i, /\/compress-pdf\/$/, /^compress pdf$/i],
    [/merge pdf/i, /\/merge-pdf\/$/, /^merge pdf$/i],
    [/resize & compress image/i, /\/resize-image\/$/, /resize & compress image/i],
    [/clean pdf printer/i, /\/clean-pdf-printer\/$/, /clean pdf printer/i],
    [/document flattener/i, /\/document-flattener\/$/, /document flattener/i]
  ];

  for (const [linkName] of tools) await expect(page.getByRole('link', { name: linkName })).toBeVisible();

  for (const [linkName, url, heading] of tools) {
    await page.goto('/');
    await page.getByRole('link', { name: linkName }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  }
});