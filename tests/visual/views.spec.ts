import { expect, test } from '@playwright/test';

const cases = [
  { name: 'cosmos', query: '?view=cosmos', what: 'The Cosmos view' },
  {
    name: 'cosmos-high-contrast',
    query: '?view=cosmos&contrast=1',
    what: 'The Cosmos view in high contrast',
  },
  { name: 'soul', query: '?view=soul', what: 'The Soul view' },
  { name: 'soul-high-contrast', query: '?view=soul&contrast=1', what: 'The Soul view in high contrast' },
];

for (const c of cases) {
  test(`${c.what} matches the baseline`, async ({ page }) => {
    await page.goto(`/dev/views.html${c.query}`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', '1', { timeout: 30_000 });
    await expect(page.locator('canvas')).toHaveScreenshot(`${c.name}.png`, { maxDiffPixelRatio: 0.01 });
    // The view adds a few batches to the Meadow's (spec 11.4 allows 100).
    expect(Number(await page.locator('body').getAttribute('data-calls'))).toBeLessThanOrEqual(20);
  });
}
