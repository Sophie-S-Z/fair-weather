import { expect, test } from '@playwright/test';

const cases = [
  { name: 'meadow', query: '', what: 'at a fixed tick' },
  { name: 'meadow-high-contrast', query: '?contrast=1', what: 'in high contrast' },
];

for (const c of cases) {
  test(`the Meadow ${c.what} matches the baseline`, async ({ page }) => {
    await page.goto(`/dev/meadow.html${c.query}`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
    await expect(page.locator('canvas')).toHaveScreenshot(`${c.name}.png`, { maxDiffPixelRatio: 0.01 });
    // The whole scene stays within a handful of batches (spec 11.4 allows 100).
    expect(Number(await page.locator('body').getAttribute('data-calls'))).toBeLessThanOrEqual(10);
  });
}
