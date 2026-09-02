const { test, expect } = require('@playwright/test');

test('touchless counter starts, pauses, changes speed and persists', async ({ page }) => {
  await page.goto('/japa-counter/');
  await expect(page.getByText('Touchless Japa Counter')).toBeVisible();

  await page.locator('#speed').fill('1');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.waitForTimeout(1250);

  const runningCount = Number((await page.locator('#count').innerText()).replaceAll(',', ''));
  expect(runningCount).toBeGreaterThanOrEqual(1);

  await page.getByRole('button', { name: 'Pause' }).click();
  const pausedCount = await page.locator('#count').innerText();
  await page.waitForTimeout(400);
  await expect(page.locator('#count')).toHaveText(pausedCount);

  await page.reload();
  await expect(page.locator('#count')).toHaveText(pausedCount);
  await expect(page.locator('#status')).toHaveText('Paused');
});

test('touchless counter derives 108-round totals from persisted state', async ({ page }) => {
  await page.goto('/japa-counter/');
  await page.evaluate(() => {
    localStorage.setItem('naam-japa-counter-state-v1', JSON.stringify({
      running: false,
      startedAt: null,
      accumulatedElapsedMs: 108000,
      accumulatedNaam: 108,
      secondsPerNaam: 1
    }));
  });
  await page.reload();
  await expect(page.locator('#count')).toHaveText('108');
  await expect(page.locator('#rounds')).toHaveText('1');
  await expect(page.locator('#current')).toHaveText('0 / 108');
});
