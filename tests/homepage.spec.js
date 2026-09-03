const { test, expect } = require('@playwright/test');

const catalogLinks = [
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

test('homepage presents the private-local story, catalog, and browser navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Clean Local Tools/);
  await expect(page.getByRole('heading', { name: /useful file tools/i })).toBeVisible();
  await expect(page.getByText('Your files never leave your machine.', { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Your file stays on this device')).toBeVisible();
  await expect(page.getByRole('heading', { name: /popular tools/i })).toBeVisible();

  for (const linkName of catalogLinks) {
    await expect(page.getByRole('link', { name: linkName }).first()).toBeVisible();
  }

  await page.getByRole('link', { name: /image to pdf/i }).first().click();
  await expect(page).toHaveURL(/\/image-to-pdf\/$/);
  await expect(page.getByRole('heading', { name: /image to pdf/i }).first()).toBeVisible();
});

test('mobile homepage keeps the promise and popular tools compact', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /useful file tools/i })).toBeVisible();
  await expect(page.getByLabel('Your file stays on this device')).toBeVisible();
  await expect(page.getByRole('link', { name: /view all tools/i })).toBeVisible();

  const popular = page.locator('.popular-grid .tool-card');
  await expect(popular).toHaveCount(6);
  await expect(popular.nth(0)).toBeVisible();
  await expect(popular.nth(3)).toBeVisible();
  await expect(popular.nth(4)).toBeHidden();
  await expect(popular.nth(5)).toBeHidden();

  const metrics = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
});
