const { test, expect } = require('@playwright/test');

test('tap counter increments and persists across reload', async ({ page }) => {
  await page.goto('/japa-counter/tap.html');
  const tap = page.getByRole('button', { name: /tap \+1/i });
  await tap.click();
  await tap.click();
  await tap.click();
  await expect(page.locator('#count')).toHaveText('3');

  await page.reload();
  await expect(page.locator('#count')).toHaveText('3');
});

test('tap counter completes a round at 108 and reset works', async ({ page }) => {
  await page.goto('/japa-counter/tap.html');
  await page.evaluate(() => localStorage.setItem('tap-japa-counter-state-v1', '107'));
  await page.reload();
  await page.getByRole('button', { name: /tap \+1/i }).click();
  await expect(page.locator('#count')).toHaveText('108');
  await expect(page.locator('#rounds')).toHaveText('1');
  await expect(page.locator('#current')).toHaveText('0 / 108');

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('#count')).toHaveText('0');
});
