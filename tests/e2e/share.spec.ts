// Share a valley (plan task M4.12, ADR 0014 item 7): a link or a file holds the setup and the
// commands, and opening one gives the same world at the same tick, paused. A broken or old link
// opens the lost-valley page. The e2e-firefox and e2e-webkit projects run this file too, so the
// round trip is checked in each engine (the hash is the same in every engine).
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { hash, keepProfile, openNew, press, running, sandboxRun, sent } from './helpers.ts';

// These tests check the round trip, not the layout, so the page is a small desktop one: with no GPU
// every frame is drawn in software, and its cost grows with its pixels, so each step waits less.
test.use({ viewport: { width: 960, height: 540 } });

type Hash = { tick: number; value: string };
/** The kinds of the run's structures, in id order. */
const structures = async (page: Page) => (await sandboxRun(page))?.lite.structures.map((s) => s.kind) ?? [];
/** The sandbox save the profile holds, or null. */
const storedSandbox = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const req = indexedDB.open('fair-weather', 1);
        req.onsuccess = () => {
          const get = req.result.transaction('saves').objectStore('saves').get('profile');
          get.onsuccess = () => {
            resolve((get.result as { sandbox?: unknown } | undefined)?.sandbox ?? null);
          };
        };
      }),
  );
const heading = (page: Page) => page.getByRole('heading', { name: 'Sandbox: A new valley' });
const scene = (page: Page) => page.getByRole('application', { name: 'The sandbox valley' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Share this valley' });
const pause = (page: Page) =>
  page.getByRole('group', { name: 'Time' }).getByRole('button', { name: 'Pause' });

/** A bench, a path, and a whisper, by keys only. */
async function act(page: Page): Promise<void> {
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect.poll(() => structures(page)).toEqual(['bench']);
  await page.keyboard.press('2');
  await page.keyboard.press('Enter');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(() => structures(page)).toEqual(['bench', 'path']);
  await page.keyboard.press('8');
  const before = await sent(page);
  const picked = page.getByRole('status').filter({ hasText: /Picked: / });
  for (let i = 0; i < 40 && !(await picked.isVisible()); i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const card = page.getByRole('dialog', { name: 'Whisper about whom?' });
  await press(page, card.getByRole('button').first());
  await press(page, card.getByRole('button', { name: 'Kind', exact: true }));
  await expect.poll(() => sent(page)).toBe(before + 1);
}

/** Opens the Share panel, which pauses the run. */
async function share(page: Page): Promise<void> {
  await press(page, page.getByRole('button', { name: 'Share this valley' }));
  await expect(dialog(page)).toBeVisible();
  await expect(pause(page)).toHaveAttribute('aria-pressed', 'true');
}
async function pauseNow(page: Page): Promise<void> {
  await press(page, pause(page));
  await expect(pause(page)).toHaveAttribute('aria-pressed', 'true');
}

/** The valley is paused at `want`: its hash, its Pause pressed, and no step after a while. */
async function pausedAt(page: Page, want: { tick: number; value: string }): Promise<void> {
  await expect(heading(page)).toBeVisible();
  await expect.poll(() => hash(page)).toEqual(want);
  await expect(pause(page)).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(500);
  expect(await hash(page)).toEqual(want);
}

/** Pins `text` on the strip, at the tick drawn now. */
async function pin(page: Page, text: string): Promise<void> {
  const strip = page.getByRole('region', { name: 'Timeline' });
  await press(page, strip.getByRole('button', { name: 'Pin a note' }));
  await strip.getByLabel('Note (at most 80 characters)').fill(text);
  await page.keyboard.press('Enter');
  await expect(strip.getByRole('button', { name: `Note on day 1: ${text}` })).toBeVisible();
}

/** The JSON a link's `v1.<data>` holds: the URL-safe base64 of raw deflate. */
const linkJson = (url: string): string =>
  inflateRawSync(Buffer.from(url.slice(url.indexOf('#v1.') + 4), 'base64url')).toString('utf8');

test('a shared link opens the same valley at the same tick, paused, for a player before Part 1', async ({
  page,
  browser,
}) => {
  await openNew(page);
  await act(page);
  await pin(page, 'Pim waits by the bench.');
  await pauseNow(page);
  await share(page);
  const url = await dialog(page).getByLabel('Link to this valley').inputValue();
  expect(url).toMatch(/^http:\/\/localhost:5179\/#v1\.[A-Za-z0-9_-]+$/);
  // The player's notes stay on the device: the link holds none.
  expect(linkJson(url)).toContain('"script"');
  expect(linkJson(url)).not.toContain('Pim waits');
  const want = await hash(page);
  expect(want.tick).toBeGreaterThan(0);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await press(page, dialog(page).getByRole('button', { name: 'Close' }));
  await expect(page.getByRole('button', { name: 'Share this valley' })).toBeFocused();

  // Another player, before the end of Part 1: a profile of their own, with no kept year. The first
  // page is done: closed, it stops drawing its frames, which the second page's steps would wait behind.
  await page.close();
  const other = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  await other.goto(url);
  await pausedAt(other, want);
  expect(await other.evaluate(() => location.hash)).toBe('');
  // A reload does not open the link again, and the link did not open the title's Sandbox button.
  await other.reload();
  await expect(other.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  await expect(other.getByRole('button', { name: 'Sandbox' })).toBeDisabled();
  await other.context().close();
});

test('Go on with your last valley after Back to title gives the same world, with its notes', async ({
  page,
}) => {
  await openNew(page);
  // A kept year, so the title's Sandbox button opens the start choice after Back to title.
  await keepProfile(page, []);
  await act(page);
  await pin(page, 'Pim waits by the bench.');
  await pauseNow(page);
  const want = await hash(page);
  await press(page, page.getByRole('button', { name: 'Back to title' }));
  await press(page, page.getByRole('button', { name: 'Sandbox' }));
  await press(page, page.getByRole('button', { name: 'Go on with your last valley' }));
  await pausedAt(page, want);
  await expect(
    page
      .getByRole('region', { name: 'Timeline' })
      .getByRole('button', { name: 'Note on day 1: Pim waits by the bench.' }),
  ).toBeVisible();
});

test('Copy the link gives the link to the clipboard and says so', async ({ page }) => {
  // The clipboard is the browser's: a stand-in keeps what the page writes, in every engine.
  await page.addInitScript(() => {
    const w = window as unknown as { copied: string[] };
    w.copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => Promise.resolve(void w.copied.push(text)) },
    });
  });
  await openNew(page);
  await share(page);
  const url = await dialog(page).getByLabel('Link to this valley').inputValue();
  await expect(dialog(page).getByRole('status')).toHaveText('');
  await press(page, dialog(page).getByRole('button', { name: 'Copy the link' }));
  await expect(dialog(page).getByRole('status')).toHaveText('The link is copied.');
  expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([url]);
});

for (const [name, broken] of [
  ['a cut link', (url: string) => url.slice(0, -12)],
  ['a v2 link', (url: string) => url.replace('#v1.', '#v2.')],
] as const) {
  test(`${name} opens "This valley could not be found", and Start fresh goes to the title`, async ({
    page,
  }) => {
    await openNew(page);
    await share(page);
    const url = await dialog(page).getByLabel('Link to this valley').inputValue();
    await page.goto(broken(url));
    await expect(page.getByRole('heading', { name: 'This valley could not be found' })).toBeVisible();
    expect(await page.evaluate(() => location.hash)).toBe('');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    await press(page, page.getByRole('button', { name: 'Start fresh' }));
    await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  });
}

test('a valley too large for a link saves as a file, and opening that file gives the same world', async ({
  page,
  context,
}) => {
  // Dev only: ?linkChars=200 makes every link too long, so Share offers the file.
  await openNew(page, '&linkChars=200');
  await act(page);
  await pauseNow(page);
  await share(page);
  await expect(dialog(page)).toContainText('This valley is too large for a link. Save it as a file.');
  await expect(dialog(page).getByLabel('Link to this valley')).toHaveCount(0);
  const want = await hash(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog(page).getByRole('button', { name: 'Save the file' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('fair-weather-valley.fairweather');
  const file = await download.path();
  expect(readFileSync(file, 'utf8')).toMatch(/^v1\.[A-Za-z0-9_-]+\n$/);

  await page.close(); // done with: closed, it stops drawing frames that the next page's steps would wait behind
  const other = await context.newPage();
  await openNew(other);
  await share(other);
  await dialog(other).getByLabel('Open a valley file').setInputFiles(file);
  await expect(dialog(other)).toHaveCount(0);
  await pausedAt(other, want);
});

/** A link of a new valley of seed 8 that another page shares, and its hash. */
async function theirLink(context: BrowserContext): Promise<{ url: string; theirs: Hash }> {
  const sender = await context.newPage();
  await sender.goto('/?sandbox=new&seed=8');
  await expect.poll(() => running(sender)).toBe(true);
  await share(sender);
  const url = await dialog(sender).getByLabel('Link to this valley').inputValue();
  const theirs = await hash(sender);
  await sender.close();
  return { url, theirs };
}

/** Places a bench by keys, and pauses once it stands; gives the hash then. */
async function placeBench(page: Page): Promise<Hash> {
  await scene(page).focus();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await press(page, page.getByRole('group', { name: 'Time' }).getByRole('button', { name: '1×' }));
  await expect.poll(() => structures(page)).toEqual(['bench']);
  await pauseNow(page);
  return hash(page);
}

/** The player's own valley of seed 7 with a bench, kept by Back to title; gives its hash. */
async function keepOwnValley(page: Page): Promise<Hash> {
  await openNew(page);
  await keepProfile(page, []);
  const mine = await placeBench(page);
  await press(page, page.getByRole('button', { name: 'Back to title' }));
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  return mine;
}

/** Back to title, then Go on with your last valley. */
async function goOn(page: Page): Promise<void> {
  await press(page, page.getByRole('button', { name: 'Back to title' }));
  await press(page, page.getByRole('button', { name: 'Sandbox' }));
  await press(page, page.getByRole('button', { name: 'Go on with your last valley' }));
}

test('a link opened and left at once keeps the last valley the player had', async ({ page, context }) => {
  const { url, theirs } = await theirLink(context);
  const mine = await keepOwnValley(page);
  // The title is at the page's own address, so the link changes only the fragment: the page loads
  // again for it.
  await page.goto(url);
  await pausedAt(page, theirs);
  await goOn(page);
  await pausedAt(page, mine);
});

test('a link opened and acted in becomes the last valley', async ({ page, context }) => {
  const { url, theirs } = await theirLink(context);
  await keepOwnValley(page);
  await page.goto(url);
  await pausedAt(page, theirs);
  const after = await placeBench(page);
  await goOn(page);
  await pausedAt(page, after);
});

test('a challenge link opens with the challenge as it ended', async ({ page, context }) => {
  const card = (p: Page) => p.getByRole('region', { name: 'Challenges' });
  // The result is the card's last paragraph.
  const line = (p: Page) => card(p).locator('p').last();
  await openNew(page, '&fast=10');
  await press(page, card(page).getByRole('button', { name: 'Get through winter with nobody leaving.' }));
  await expect(line(page)).toHaveText(/^The challenge is not finished/);
  // The shortest seasons, so winter ends in two days.
  await press(page, page.getByText('Rules', { exact: true }));
  await page.getByLabel('Season length').focus();
  await page.keyboard.press('Home');
  await expect(line(page)).not.toHaveText(/^The challenge is not finished/, {
    timeout: 60_000,
  });
  const ended = await line(page).textContent();
  await share(page);
  const url = await dialog(page).getByLabel('Link to this valley').inputValue();
  const want = await hash(page);

  await page.close();
  const other = await context.newPage();
  await other.goto(url);
  await pausedAt(other, want);
  await expect(line(other)).toHaveText(ended ?? '');
});

// Fix round 1.

test('a bench placed while paused is in the link: Share steps the run one tick first', async ({
  page,
  context,
}) => {
  await openNew(page);
  await pauseNow(page);
  const paused = await hash(page);
  await scene(page).focus();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await share(page);
  const url = await dialog(page).getByLabel('Link to this valley').inputValue();
  const want = await hash(page);
  expect(want.tick).toBe(paused.tick + 1);
  expect(await structures(page)).toEqual(['bench']);
  const other = await context.newPage();
  await other.goto(url);
  await pausedAt(other, want);
  expect(await structures(other)).toEqual(['bench']);
});

test('an opened Bell link keeps its dance: Start the dance stays off', async ({ page, context }) => {
  const card = (p: Page) => p.getByRole('region', { name: 'Challenges' });
  await openNew(page);
  await press(page, card(page).getByRole('button', { name: 'Make Bell dance with only two bridges.' }));
  await press(page, card(page).getByRole('button', { name: 'Start the dance' }));
  await expect(card(page).getByRole('button', { name: 'Start the dance' })).toBeDisabled();
  await share(page);
  const url = await dialog(page).getByLabel('Link to this valley').inputValue();
  const other = await context.newPage();
  await other.goto(url);
  await expect(card(other).getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(card(other).getByRole('button', { name: 'Start the dance' })).toBeDisabled();
});

test('Share is off while the strip is rewound, and says why', async ({ page }) => {
  await openNew(page, '&fast=10');
  await expect
    .poll(() => sandboxRun(page).then((r) => r?.lite.day ?? 0), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  const button = page.getByRole('button', { name: 'Share this valley' });
  await expect(button).toBeEnabled();
  const range = page.getByRole('region', { name: 'Timeline' }).getByLabel('Rewind');
  await range.focus();
  await page.keyboard.press('Home');
  await expect(button).toBeDisabled();
  await expect(button).toHaveAccessibleDescription('Go back to now to share this valley.');
  await press(
    page,
    page.getByRole('region', { name: 'Timeline' }).getByRole('button', { name: 'Back to now' }),
  );
  await expect(button).toBeEnabled();
});

test('the valley is kept when the tab is hidden after the player acted', async ({ page }) => {
  await openNew(page);
  await keepProfile(page, []);
  const want = await placeBench(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => storedSandbox(page)).not.toBeNull();
  await page.goto('/');
  await press(page, page.getByRole('button', { name: 'Sandbox' }));
  await press(page, page.getByRole('button', { name: 'Go on with your last valley' }));
  await pausedAt(page, want);
});

test('a last valley that no longer opens shows the lost page once, and is not offered again', async ({
  page,
}) => {
  await page.goto('/');
  await keepProfile(page, []);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('fair-weather', 1);
        req.onsuccess = () => {
          const store = req.result.transaction('saves', 'readwrite').objectStore('saves');
          const get = store.get('profile');
          get.onsuccess = () => {
            const put = store.put({ ...get.result, sandbox: { link: 'v1.AAAA', notes: [] } }, 'profile');
            put.onsuccess = () => {
              resolve();
            };
          };
        };
        req.onerror = () => {
          reject(req.error ?? new Error('open failed'));
        };
      }),
  );
  await page.reload();
  await press(page, page.getByRole('button', { name: 'Sandbox' }));
  await press(page, page.getByRole('button', { name: 'Go on with your last valley' }));
  await expect(page.getByRole('heading', { name: 'This valley could not be found' })).toBeVisible();
  await press(page, page.getByRole('button', { name: 'Start fresh' }));
  await press(page, page.getByRole('button', { name: 'Sandbox' }));
  await expect(page.getByRole('button', { name: 'A new valley' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go on with your last valley' })).toHaveCount(0);
});

test('a link says it is opening, and a worker that cannot run says the valley could not open', async ({
  page,
  context,
}) => {
  const { url } = await theirLink(context);
  // A slow worker: the link waits for it, and says so.
  await page.route('**/src/sim-host/worker.ts*', async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  await page.goto(url);
  await expect(page.getByRole('status').filter({ hasText: 'Opening' })).toHaveText('Opening the valley.');
  await expect(heading(page)).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Opening' })).toHaveCount(0);
  // No worker at all: the open fails, and the line says so.
  await page.unroute('**/src/sim-host/worker.ts*');
  await page.route('**/src/sim-host/worker.ts*', (route) => route.abort());
  await page.goto('/');
  await page.goto(url);
  await expect(page.getByRole('status').filter({ hasText: 'could not open' })).toHaveText(
    'The valley could not open. Go back to the title to try again.',
  );
});
