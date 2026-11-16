import { expect, test, type Page } from '@playwright/test';

const cases = [
  { name: 'meadow', query: '', what: 'at a fixed tick', maxCalls: 10 },
  { name: 'meadow-high-contrast', query: '?contrast=1', what: 'in high contrast', maxCalls: 10 },
  {
    name: 'meadow-thaw',
    query: '?season=thaw&land=brook',
    what: 'in thaw with the brook, two bridges, a lantern, the mushroom, and Bell dancing',
    maxCalls: 14,
  },
  {
    name: 'fen-dusk',
    query: '?valley=fen',
    what: 'in Murmuration Fen at dusk, with the flock up and Tove beside the hero',
    maxCalls: 10,
  },
  {
    name: 'hollow-day',
    query: '?valley=hollow',
    what: 'in Hearsay Hollow by day, with its paved lanes, the press, and Quill in focus',
    maxCalls: 12,
  },
  {
    name: 'halcyon-day',
    query: '?valley=halcyon',
    what: 'in Halcyon by day, over the calm mirror sea, with Wisp in focus',
    maxCalls: 12,
  },
  {
    name: 'foglight-day',
    query: '?valley=foglight',
    what: 'in Foglight Heights by day, with its terraces, the fog, the veil past sight, and Brume in focus',
    maxCalls: 12,
  },
  {
    name: 'council-day',
    query: '?valley=council',
    what: "in the Toadstool Council by day, with its stakes, the hero's vote, and Ambry in focus",
    maxCalls: 12,
  },
  {
    name: 'shallows-day',
    query: '?valley=shallows',
    what: "in Lily Shallows by day, with its pads, each frog's songs, and Pell in focus",
    maxCalls: 12,
  },
  {
    name: 'meadow-sandbox',
    query: '?sandbox=1',
    what: 'in the sandbox, with two paths and the gate dark',
    maxCalls: 11,
  },
];

/** Opens the Meadow dev page and returns its frame's WebGL draw-call count. */
async function open(page: Page, query: string): Promise<number> {
  await page.goto(`/dev/meadow.html${query}`);
  await expect(page.locator('body')).toHaveAttribute('data-ready', '1');
  return Number(await page.locator('body').getAttribute('data-calls'));
}

for (const c of cases) {
  test(`the Meadow ${c.what} matches the baseline`, async ({ page }) => {
    const calls = await open(page, c.query);
    await expect(page.locator('canvas')).toHaveScreenshot(`${c.name}.png`, { maxDiffPixelRatio: 0.01 });
    // The whole scene stays within a handful of batches (spec 11.4 allows 100).
    expect(calls).toBeLessThanOrEqual(c.maxCalls);
  });
}

test('water, bridges, a lantern, and the mushroom add at most 4 draw calls, none per creature', async ({
  page,
}) => {
  const plain = await open(page, '?season=thaw');
  const land = await open(page, '?season=thaw&land=brook');
  expect(land - plain).toBeLessThanOrEqual(4);
});

test('paths and the gate lamp add at most 1 draw call', async ({ page }) => {
  const plain = await open(page, '');
  const sandbox = await open(page, '?sandbox=1');
  expect(sandbox - plain).toBeLessThanOrEqual(1);
});
