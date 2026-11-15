// Opt-in analytics (plan task M4.15, ADR 0014 item 9). The e2e dev server names an address
// (playwright.config.ts), so the Settings switch shows; no production build does.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const COUNT = '**/__count';

/** Collects every request to the count address; the address answers nothing, so the game sees a failed send. */
async function watch(page: Page) {
  const seen: { body: string | null; headers: Record<string, string> }[] = [];
  await page.route(COUNT, (route) => {
    const r = route.request();
    seen.push({ body: r.postData(), headers: r.headers() });
    return route.fulfill({ status: 204 });
  });
  return seen;
}

async function settings(page: Page, on: boolean) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const box = page.getByRole('checkbox', { name: 'Send counts to help us make the game better' });
  await expect(box).not.toBeChecked();
  if (on) await box.check();
  await page.getByRole('button', { name: 'Back' }).click();
}

test('with the switch off, chapter 0 sends no request to the count address', async ({ page }) => {
  const seen = await watch(page);
  await settings(page, false);
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await page.waitForTimeout(500);
  expect(seen).toEqual([]);
});

test('with the switch on, the start of chapter 0 sends exactly one count and no cookie', async ({ page }) => {
  const seen = await watch(page);
  await settings(page, true);
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0]?.body).toBe('{"v":1,"e":"chapter","chapter":"ch0"}');
  expect(seen[0]?.headers['cookie']).toBeUndefined();
  expect(seen[0]?.headers['content-type']).toContain('text/plain');
});

test('Settings, with the switch and its line, has no serious axe issue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('When this is on, the game sends only three counts')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
