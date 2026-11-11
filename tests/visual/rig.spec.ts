import { expect, test } from '@playwright/test';

const cases = [
  { name: 'rig-rest', shell: '0,0,0.5,0', what: 'at rest with a warm glow' },
  { name: 'rig-mid', shell: '0.5,0.5,0.5,0.5', what: 'at mid shell values' },
  { name: 'rig-overlap', shell: '0,0,0,0&pair=1', what: 'in front of another Pim hides it' },
];

for (const c of cases) {
  test(`the Pim rig ${c.what} matches the baseline`, async ({ page }) => {
    await page.goto(`/dev/rig.html?shell=${c.shell}&frame=0`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
    await expect(page.locator('canvas')).toHaveScreenshot(`${c.name}.png`, { maxDiffPixelRatio: 0.01 });
  });
}
