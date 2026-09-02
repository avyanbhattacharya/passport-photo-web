const { test, expect } = require('@playwright/test');

test('homepage exposes the current tools and navigation works', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Clean Local Tools/);
  await expect(page.getByRole('heading', { name: /simple tools/i })).toBeVisible();

  const passport = page.getByRole('link', { name: /passport photo/i });
  const japa = page.getByRole('link', { name: /japa counter/i });
  await expect(passport).toBeVisible();
  await expect(japa).toBeVisible();

  await passport.click();
  await expect(page).toHaveURL(/\/passport-photo\/$/);
  await expect(page.getByRole('heading', { name: /free passport photo maker/i })).toBeVisible();

  await page.goto('/');
  await japa.click();
  await expect(page).toHaveURL(/\/japa-counter\/$/);
  await expect(page.getByRole('heading', { name: /touchless japa counter/i })).toBeVisible();
});
