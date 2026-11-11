import { expect, test } from '@playwright/test';

test('the Pim rig at mid shell values matches the baseline', async ({ page }) => {
  await page.goto('/dev/rig.html?shell=0.5,0.5,0.5,0.5&frame=0');
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  await expect(page.locator('canvas')).toHaveScreenshot('rig-mid.png', { maxDiffPixelRatio: 0.01 });
});
