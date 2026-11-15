// Share a valley (plan task M4.12, ADR 0014 item 7): a link or a file holds the setup and the
// commands, and opening one gives the same world at the same tick, paused. A broken or old link
// opens the lost-valley page. The e2e-firefox and e2e-webkit projects run this file too, so the
// round trip is checked in each engine (the hash is the same in every engine).
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { WorldLite } from '../../src/sim-host/protocol.ts';
import { keepProfile } from './helpers.ts';

type Hash = { tick: number; value: string };
type Dev = {
  sandbox(): { tick: number; lite: WorldLite } | null;
  hash(): Promise<{ tick: number; value: string }>;
  sent: number;
};
/** The dev hook's hash of the world now and its tick. */
const hash = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: Dev }).fairWeather.hash());
/** The command lists the runner sent. */
const sent = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: Dev }).fairWeather.sent);
/** The kinds of the run's structures, in id order. */
const structures = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { fairWeather: Dev }).fairWeather.sandbox()?.lite.structures.map((s) => s.kind) ??
      [],
  );
const running = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: Dev }).fairWeather.sandbox() !== null);
const heading = (page: Page) => page.getByRole('heading', { name: 'Sandbox: A new valley' });
const scene = (page: Page) => page.getByRole('application', { name: 'The sandbox valley' });
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Share this valley' });
const pause = (page: Page) =>
  page.getByRole('group', { name: 'Time' }).getByRole('button', { name: 'Pause' });

/** Opens a new Kith valley of seed 7 and waits for its first snapshot, so the tools act. */
async function openNew(page: Page, query = ''): Promise<void> {
  await page.goto(`/?sandbox=new&seed=7${query}`);
  await expect(heading(page)).toBeVisible();
  await expect(scene(page)).toBeFocused();
  await expect.poll(() => running(page)).toBe(true);
}

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
  await card.getByRole('button').first().click();
  await card.getByRole('button', { name: 'Kind', exact: true }).click();
  await expect.poll(() => sent(page)).toBe(before + 1);
}

/** Opens the Share panel, which pauses the run. */
async function share(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Share this valley' }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(pause(page)).toHaveAttribute('aria-pressed', 'true');
}
async function pauseNow(page: Page): Promise<void> {
  await pause(page).click();
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
  await strip.getByRole('button', { name: 'Pin a note' }).click();
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
  await dialog(page).getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Share this valley' })).toBeFocused();

  // Another player, before the end of Part 1: a profile of their own, with no kept year.
  const other = await (await browser.newContext()).newPage();
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
  await page.getByRole('button', { name: 'Back to title' }).click();
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await page.getByRole('button', { name: 'Go on with your last valley' }).click();
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
  await dialog(page).getByRole('button', { name: 'Copy the link' }).click();
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
    await page.getByRole('button', { name: 'Start fresh' }).click();
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
  await page.getByRole('group', { name: 'Time' }).getByRole('button', { name: '1×' }).click();
  await expect.poll(() => structures(page)).toEqual(['bench']);
  await pauseNow(page);
  return hash(page);
}

/** The player's own valley of seed 7 with a bench, kept by Back to title; gives its hash. */
async function keepOwnValley(page: Page): Promise<Hash> {
  await openNew(page);
  await keepProfile(page, []);
  const mine = await placeBench(page);
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  return mine;
}

/** Back to title, then Go on with your last valley. */
async function goOn(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Back to title' }).click();
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await page.getByRole('button', { name: 'Go on with your last valley' }).click();
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
  await openNew(page, '&fast=10');
  await card(page).getByRole('button', { name: 'Get through winter with nobody leaving.' }).click();
  await expect(card(page).getByRole('status')).toHaveText(/^The challenge is not finished/);
  // The shortest seasons, so winter ends in two days.
  await page.getByText('Rules', { exact: true }).click();
  await page.getByLabel('Season length').focus();
  await page.keyboard.press('Home');
  await expect(card(page).getByRole('status')).not.toHaveText(/^The challenge is not finished/, {
    timeout: 60_000,
  });
  const ended = await card(page).getByRole('status').textContent();
  await share(page);
  const url = await dialog(page).getByLabel('Link to this valley').inputValue();
  const want = await hash(page);

  const other = await context.newPage();
  await other.goto(url);
  await pausedAt(other, want);
  await expect(card(other).getByRole('status')).toHaveText(ended ?? '');
});
