import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

// Offline after the first load (ADR 0014 item 12). Runs over a built, previewed game with the
// service worker registered.

const errors = (page: Page): string[] => {
  const seen: string[] = [];
  page.on('pageerror', (e) => seen.push(e.message));
  return seen;
};

test('the built worker precaches every file in dist but itself and maps', () => {
  const dist = join(import.meta.dirname, '../../dist');
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  const list = JSON.parse(/self\.PRECACHE = (\[.*\]);/.exec(sw)?.[1] ?? 'null') as string[];
  const files = readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((f) => f.isFile() && f.name !== 'sw.js' && !f.name.endsWith('.map'))
    .map((f) => `/${relative(dist, join(f.parentPath, f.name))}`)
    .sort();
  expect(list).toEqual(['/', ...files]);
});

test('after one load the game starts with the network off', async ({ page, context }) => {
  const seen = errors(page);
  const failed: string[] = [];
  page.on('requestfailed', (r) => failed.push(r.url()));
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The first load is not controlled (no clients.claim): one reload puts the worker in charge. A
  // controller means it activated, so its install and the whole precache are done.
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
  // The sim worker's script retries after 1 s and 2 s and then the still page shows (ADR 0014
  // item 11): wait that long, so a worker that is not precached cannot pass.
  await page.waitForTimeout(3500);
  expect(failed).toEqual([]);
  await expect(page.getByText('This browser cannot show the moving valley')).toHaveCount(0);
  expect(seen).toEqual([]);
});

test('a page address with a query opens the cached page offline and keeps its query', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.goto('/?v1.abc');
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('?v1.abc');
});
