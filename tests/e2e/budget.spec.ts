import { expect, test } from '@playwright/test';

// CI has no GPU, so only the draw-call budget is checked here (ADR 0014 item 16). The measured
// frame must hold the whole heaviest Meadow first, so a missing part can never pass silently.
test('the heaviest Meadow frame takes at most 100 draw calls', async ({ page }) => {
  await page.goto('/dev/perf.html?scene=meadow&n=30&seconds=2');
  await page.waitForFunction(() => document.body.dataset['done'] === '1');
  const perf = await page.evaluate(() => window.__perf);
  expect(perf?.world).toMatchObject({
    creatures: 30,
    water: 1,
    bridges: 2,
    lanterns: 1,
    paths: 2,
    mushroom: 1,
    fog: true,
    lens: true,
    heat: true,
  });
  const calls = Number(await page.locator('body').getAttribute('data-calls'));
  expect(calls).toBeGreaterThan(0);
  expect(calls).toBeLessThanOrEqual(100);
});
