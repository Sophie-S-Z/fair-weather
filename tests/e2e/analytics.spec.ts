// Opt-in analytics (plan task M4.15, ADR 0014 item 9). The e2e dev server names an address
// (playwright.config.ts), so the Settings switch shows; no production build does.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { keepProfile } from './helpers.ts';

const COUNT = '**/__count';

/** Collects every request to the count address, with the headers that the page really sent (cookies included). */
async function watch(page: Page) {
  const seen: { body: string | null; headers: Record<string, string> }[] = [];
  await page.route(COUNT, async (route) => {
    const r = route.request();
    seen.push({ body: r.postData(), headers: await r.allHeaders() });
    await route.fulfill({ status: 204 });
  });
  return seen;
}

async function settings(page: Page, on: boolean) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  const box = page.getByRole('checkbox', { name: 'Send counts to help us make the game better' });
  if (on) await box.check();
  else await expect(box).not.toBeChecked();
  await page.getByRole('button', { name: 'Back' }).click();
}

async function begin(page: Page) {
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
}

test('with the switch off, chapter 0 sends nothing; the first request seen is a later one', async ({
  page,
}) => {
  const seen = await watch(page);
  await settings(page, false);
  await begin(page);
  // The control: the same page, a new visit with the switch on. Its start is the first request that arrives.
  await settings(page, true);
  await begin(page);
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0]?.body).toBe('{"v":1,"e":"chapter","chapter":"ch0"}');
});

test('with the switch on, the start of chapter 0 sends exactly one count and no cookie', async ({
  page,
  context,
}) => {
  // A cookie for the page's own origin, which is the count address's origin too: a fetch with
  // credentials 'same-origin' or 'include' would carry it.
  await context.addCookies([{ name: 'c', value: '1', url: 'http://localhost:5179' }]);
  const seen = await watch(page);
  await settings(page, true);
  await begin(page);
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0]?.body).toBe('{"v":1,"e":"chapter","chapter":"ch0"}');
  expect(seen[0]?.headers['cookie']).toBeUndefined();
  expect(seen[0]?.headers['content-type']).toContain('text/plain');
});

test('leaving the sandbox after one visible minute sends exactly one sandbox count', async ({ page }) => {
  await page.clock.install();
  const seen = await watch(page);
  await settings(page, true);
  await page.goto('/?sandbox=new');
  await expect(page.getByRole('heading', { name: 'Sandbox: A new valley' })).toBeVisible();
  await page.clock.fastForward('01:05');
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0]?.body).toBe('{"v":1,"e":"sandbox","minutes":1}');
});

/** Turns the switch on, keeps a finished Part 1 in the profile, and loads the title with the Sandbox button open. */
async function titleWithSandbox(page: Page) {
  await settings(page, true);
  await keepProfile(page, []);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Sandbox' })).toBeEnabled();
}

test('time on the start-choice screen counts, and Back to title there sends the minutes', async ({
  page,
}) => {
  await page.clock.install();
  const seen = await watch(page);
  await titleWithSandbox(page);
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox', exact: true })).toBeVisible();
  await page.clock.fastForward('01:05');
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0]?.body).toBe('{"v":1,"e":"sandbox","minutes":1}');
});

test('a visit under one minute sends nothing; time outside the sandbox never counts toward the next visit', async ({
  page,
}) => {
  await page.clock.install();
  const seen = await watch(page);
  await titleWithSandbox(page);
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'A new valley' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox: A new valley' })).toBeVisible();
  await page.clock.fastForward('00:30');
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  // Five minutes on the title are no sandbox time.
  await page.clock.fastForward('05:00');
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox', exact: true })).toBeVisible();
  await page.clock.fastForward('01:05');
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  await expect.poll(() => seen.length).toBe(1);
  expect(seen[0]?.body).toBe('{"v":1,"e":"sandbox","minutes":1}');
});

test('Settings, with the switch and its line, has no serious axe issue', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('When this is on, the game sends only three counts')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
