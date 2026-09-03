const { test, expect } = require('@playwright/test');

test('homepage exposes the current tools and navigation works', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Clean Local Tools/);
  await expect(page.getByRole('heading', { name: /simple tools/i })).toBeVisible();
  const passport = page.getByRole('link', { name: /passport photo/i });
  const japa = page.getByRole('link', { name: /japa counter/i });
  const compress = page.getByRole('link', { name: /compress pdf/i });
  const merge = page.getByRole('link', { name: /merge pdf/i });
  const resize = page.getByRole('link', { name: /resize & compress image/i });
  for (const link of [passport,japa,compress,merge,resize]) await expect(link).toBeVisible();
  await passport.click(); await expect(page).toHaveURL(/\/passport-photo\/$/); await expect(page.getByRole('heading', { name: /free passport photo maker/i })).toBeVisible();
  await page.goto('/'); await japa.click(); await expect(page).toHaveURL(/\/japa-counter\/$/); await expect(page.getByRole('heading', { name: /touchless japa counter/i })).toBeVisible();
  await page.goto('/'); await compress.click(); await expect(page).toHaveURL(/\/compress-pdf\/$/); await expect(page.getByRole('heading', { name: /^compress pdf$/i })).toBeVisible();
  await page.goto('/'); await merge.click(); await expect(page).toHaveURL(/\/merge-pdf\/$/); await expect(page.getByRole('heading', { name: /^merge pdf$/i })).toBeVisible();
  await page.goto('/'); await resize.click(); await expect(page).toHaveURL(/\/resize-image\/$/); await expect(page.getByRole('heading', { name: /resize & compress image/i })).toBeVisible();
});
