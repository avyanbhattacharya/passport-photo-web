const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { toolContracts } = require('./tool-contracts');

const captureReference = process.env.VISUAL_BASELINE_CAPTURE === '1';
const visualContracts = toolContracts.filter(contract => contract.visual);

for (const contract of visualContracts) {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 960 },
    { name: 'mobile', width: 390, height: 844 }
  ]) {
    test(`${contract.id} ${viewport.name} visual regression`, async ({ page }, testInfo) => {
      const snapshot = `${contract.id}-${viewport.name}.png`;
      const baseline = testInfo.snapshotPath(snapshot);
      test.skip(!captureReference && !fs.existsSync(baseline), `Awaiting an approved visual baseline for ${contract.id}.`);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(contract.route, { waitUntil: 'networkidle' });
      await expect(page.locator('h1').first()).toContainText(contract.heading);
      await expect(page).toHaveScreenshot(snapshot, {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        maxDiffPixelRatio: 0.005
      });
    });
  }
}
