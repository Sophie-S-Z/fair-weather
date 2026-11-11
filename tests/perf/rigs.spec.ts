import { expect, test } from '@playwright/test';

test('30 line rigs hold the frame budget', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/dev/perf.html?n=30&seconds=30');
  await page.waitForFunction(() => document.body.dataset['done'] === '1', null, { timeout: 80_000 });
  const perf = await page.evaluate(() => window.__perf);
  console.log(`perf: ${JSON.stringify(perf)}`);
  expect(perf?.frames).toBeGreaterThan(0);
  expect(perf?.drawCalls).toBeLessThanOrEqual(100);
  if (process.env['PERF_HEADED'] === '1') {
    expect(perf?.meanMs).toBeLessThanOrEqual(16.9);
    expect(perf?.p95Ms).toBeLessThanOrEqual(20);
  }
});
