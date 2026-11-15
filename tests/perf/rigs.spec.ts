import { expect, test } from '@playwright/test';

// Frame times are asserted only on a real GPU (PERF_HEADED=1, ADR 0014 item 16). PERF_PHONE=1 adds
// 4x CPU throttling at 412 x 915 and only prints.
const headed = process.env['PERF_HEADED'] === '1';
const phone = process.env['PERF_PHONE'] === '1';
const GIF_MAX_MS = 2000;

test.use(phone ? { viewport: { width: 412, height: 915 } } : {});

for (const [name, query] of [
  ['30 line rigs', 'n=30&seconds=30'],
  ['the heaviest Meadow with 30 creatures', 'scene=meadow&n=30&seconds=30'],
] as const) {
  test(`${name} hold the frame budget`, async ({ page }) => {
    test.setTimeout(120_000);
    if (phone)
      await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(`/dev/perf.html?${query}`);
    await page.waitForFunction(() => document.body.dataset['done'] === '1', null, { timeout: 100_000 });
    const perf = await page.evaluate(() => window.__perf);
    console.log(`perf (${name}${phone ? ', phone proxy' : ''}): ${JSON.stringify(perf)}`);
    expect(perf?.frames).toBeGreaterThan(0);
    expect(perf?.drawCalls).toBeLessThanOrEqual(100);
    if (headed && !phone) {
      expect(perf?.meanMs).toBeLessThanOrEqual(16.9);
      expect(perf?.p95Ms).toBeLessThanOrEqual(20);
      if (perf?.gifMs !== undefined) expect(perf.gifMs).toBeLessThanOrEqual(GIF_MAX_MS);
    }
  });
}
