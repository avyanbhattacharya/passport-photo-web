const { test, expect } = require('@playwright/test');
const path = require('node:path');

const fixture = path.join(__dirname, 'fixtures', 'sheetlocal-budget.csv');

test('SheetLocal profiles a local CSV and runs guided analyses', async ({ page }) => {
  const externalRequests = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) externalRequests.push(url.href);
  });

  await page.goto('/sheetlocal/');
  await expect(page.getByRole('heading', { name: 'Understand a spreadsheet without uploading it.' })).toBeVisible();
  await expect(page.getByText('Your files never leave your machine.')).toBeVisible();

  await page.locator('#csvFile').setInputFiles(fixture);
  await expect(page.getByText('sheetlocal-budget.csv')).toBeVisible();
  await expect(page.getByText('10 rows')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spreadsheet overview' })).toBeVisible();

  await page.getByRole('button', { name: 'Top categories' }).click();
  await expect(page.getByRole('heading', { name: 'Top categories' })).toBeVisible();
  await expect(page.getByText('$2,416.00')).toBeVisible();

  await page.getByRole('button', { name: 'Find duplicates' }).click();
  await expect(page.getByText('Found 1 repeated row.')).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test('SheetLocal keeps questions constrained and downloads reports locally', async ({ page }) => {
  await page.goto('/sheetlocal/');
  await page.locator('#csvFile').setInputFiles(fixture);
  await expect(page.getByText('sheetlocal-budget.csv')).toBeVisible();

  await page.locator('#questionInput').fill('Write arbitrary SQL for this spreadsheet');
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.getByText('Try “top categories,” “compare periods,” “find duplicates,” “unusual values,” or “missing data.”')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('sheetlocal-report.txt');
});
