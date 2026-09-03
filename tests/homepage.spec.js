const { test, expect } = require('@playwright/test');

test('homepage presents the catalog and browser navigation works', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Clean Local Tools/);
  await expect(page.getByRole('heading', { name: /simple tools/i })).toBeVisible();

  const links = [
    /passport photo/i,
    /japa counter/i,
    /compress pdf/i,
    /merge pdf/i,
    /resize & compress image/i,
    /clean pdf printer/i,
    /document flattener/i,
    /image to pdf/i,
    /split pdf/i,
    /heic to jpg/i,
    /remove photo metadata/i,
    /qr code maker/i
  ];

  for (const linkName of links) {
    await expect(page.getByRole('link', { name: linkName })).toBeVisible();
  }

  await page.getByRole('link', { name: /image to pdf/i }).click();
  await expect(page).toHaveURL(/\/image-to-pdf\/$/);
  await expect(page.getByRole('heading', { name: /image to pdf/i }).first()).toBeVisible();
});
