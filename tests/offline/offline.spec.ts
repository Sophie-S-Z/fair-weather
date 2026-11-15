import { expect, test, type Page } from '@playwright/test';

// Offline after the first load (ADR 0014 item 12). Runs over a built, previewed game with the
// service worker registered.

const errors = (page: Page): string[] => {
  const seen: string[] = [];
  page.on('pageerror', (e) => seen.push(e.message));
  return seen;
};

test('after one load the game starts with the network off', async ({ page, context }) => {
  const seen = errors(page);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The first load is not controlled (no clients.claim): one reload puts the worker in charge.
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  // Registration and the precache finish before the page is reloaded offline.
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith('fair-weather-'))))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();
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
