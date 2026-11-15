// The sandbox screen (plan task M4.10, ADR 0014 items 1 to 5). Dev ?sandbox=new opens a new Kith
// valley; the dev hook reads the run's newest snapshot.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { canvasPoints, keepProfile, sandboxRun as run, seriousViolations, untilStatus } from './helpers.ts';

/** A tool's radio, also in a closed panel. */
const radio = (page: Page, name: string) => page.getByRole('radio', { name, includeHidden: true });
const status = (page: Page) => page.getByRole('status').filter({ hasText: /^Tool: / });
const structures = async (page: Page) => (await run(page))?.lite.structures ?? [];

/** Opens a new Kith valley and waits for its first snapshot, so the tools act. */
async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/?sandbox=new${query}`);
  await expect(page.getByRole('heading', { name: 'Sandbox: A new valley' })).toBeVisible();
  await expect(page.getByRole('application', { name: 'The sandbox valley' })).toBeFocused();
  await expect.poll(async () => (await run(page)) !== null).toBe(true);
}

const PANELS = ['Population', 'Rules', 'Weather', 'Network'];
const panel = (page: Page, name: string) =>
  page.locator('details', { has: page.getByText(name, { exact: true }) });

test('the four panels start closed', async ({ page }) => {
  await open(page);
  for (const name of PANELS) await expect(panel(page, name)).not.toHaveAttribute('open');
});

// One test per panel: an axe run on a page that draws in software takes seconds.
for (const name of PANELS) {
  test(`axe finds no serious issue with the ${name} panel open`, async ({ page }) => {
    await open(page);
    await page.getByText(name, { exact: true }).click();
    await expect(panel(page, name)).toHaveAttribute('open');
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
}

test('the Rules panel opens Where this model is wrong as a modal dialog with the sim paused', async ({
  page,
}) => {
  await open(page);
  await page.getByText('Rules', { exact: true }).click();
  const button = page.getByRole('button', { name: 'Where this model is wrong' });
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Where this model is wrong' });
  await expect(dialog.getByRole('heading', { level: 2, name: 'Where this model is wrong' })).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { fairWeather: { speeds: number[] } }).fairWeather.speeds.at(-1),
      ),
    )
    .toBe(0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  // Tab stays inside the dialog: the links, then Back, and round again.
  const count = await dialog.locator('a[href], button').count();
  for (let i = 0; i < count + 1; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
});

test('Where this model is wrong in the sandbox leaves a paused sim paused', async ({ page }) => {
  await open(page);
  const speed = () =>
    page.evaluate(() =>
      (window as unknown as { fairWeather: { speeds: number[] } }).fairWeather.speeds.at(-1),
    );
  await page.keyboard.press('Space');
  await expect.poll(speed).toBe(0);
  await page.getByText('Rules', { exact: true }).click();
  await page.getByRole('button', { name: 'Where this model is wrong' }).click();
  const dialog = page.getByRole('dialog', { name: 'Where this model is wrong' });
  await expect(dialog).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect.poll(speed).toBe(0);
});

test('keys only: 1 picks Place, Enter places a bench at the cursor, 8 picks Whisper', async ({ page }) => {
  await open(page);
  await page.keyboard.press('1');
  await expect(radio(page, 'Place')).toBeChecked();
  await expect(status(page)).toHaveText(/^Tool: Place\. Spot near: under crooked tree/);
  await page.keyboard.press('Enter');
  // The cursor starts at the scene's first bench spot (content/scenes/kith-meadow.json).
  await expect
    .poll(async () => (await structures(page)).map(({ kind, x, y }) => ({ kind, x, y })))
    .toEqual([{ kind: 'bench', x: 600, y: 430 }]);
  await page.keyboard.press('8');
  await expect(radio(page, 'Whisper')).toBeChecked();
  await expect(radio(page, 'Place')).not.toBeChecked();
  await expect(status(page)).toHaveText(/^Tool: Whisper/);
});

test('a drag with Paths draws a path that the next snapshot holds', async ({ page }) => {
  await open(page);
  await page.keyboard.press('2');
  await expect(radio(page, 'Paths')).toBeChecked();
  const [from] = await canvasPoints(page, 40, { x: 900, y: 500 }, true);
  if (!from) throw new Error('no free canvas point');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 120, from.y, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await structures(page)).filter((s) => s.kind === 'path')).toHaveLength(1);
});

test('setting Gift value starts the run again at day 0, with a bench placed before still there', async ({
  page,
}) => {
  await open(page, '&fast=10');
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await structures(page)).length).toBe(1);
  const [bench] = await structures(page);
  // A day passes, so the new run's day 0 is a new start.
  await expect.poll(async () => (await run(page))?.lite.day ?? 0, { timeout: 30_000 }).toBeGreaterThan(0);
  const before = (await run(page))?.tick ?? 0;
  await page.getByText('Rules', { exact: true }).click();
  await expect(
    page.getByText('When you change a rule, the valley starts again from its first day.'),
  ).toBeVisible();
  const gift = page.getByLabel('Gift value');
  await expect(gift).toHaveAttribute('aria-valuetext', '3');
  await gift.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gift).toHaveAttribute('aria-valuetext', '4');
  await expect.poll(async () => ((await run(page))?.tick ?? before) < before).toBe(true);
  const after = await run(page);
  expect(after?.lite.day).toBe(0);
  expect(after?.lite.structures).toEqual([bench]);
});

test('Gossip threshold stays off while Mixed thresholds is on, and says why', async ({ page }) => {
  await open(page);
  await page.getByText('Network', { exact: true }).click();
  const gossip = page.getByLabel('Gossip threshold');
  await expect(gossip).toBeDisabled();
  await expect(gossip).toHaveAccessibleDescription(
    'Turn off Mixed thresholds to give all creatures one threshold.',
  );
  await page.getByLabel('Mixed thresholds').uncheck();
  await expect(gossip).toBeEnabled();
});

test('the title opens the sandbox once Part 1 is over, and Back to title returns focus to the Sandbox button', async ({
  page,
}) => {
  await page.goto('/');
  // One kept year in the profile, as a finished Part 1 leaves it.
  await keepProfile(page, []);
  await page.reload();
  const sandbox = page.getByRole('button', { name: 'Sandbox' });
  await expect(sandbox).toBeEnabled();
  await sandbox.click();
  await expect(page.getByRole('heading', { name: 'Sandbox', exact: true })).toBeVisible();
  // No Kith is kept yet, so the choice starts at a new valley.
  await expect(page.getByRole('button', { name: 'Your Kith' })).toHaveCount(0);
  await page.getByRole('button', { name: 'A new valley' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox: A new valley' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  await expect(sandbox).toBeFocused();
});

test('with only Weather open, Tab goes from its knobs to its first tool, Sunlight', async ({ page }) => {
  await open(page);
  await page.getByText('Weather', { exact: true }).click();
  await expect(panel(page, 'Weather')).toHaveAttribute('open');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Fog level')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Wind strength')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(radio(page, 'Sunlight')).toBeFocused();
  // Place, in the closed Population panel, stays the tool.
  await expect(radio(page, 'Place')).toBeChecked();
});

test('with Population open too, so Place shows checked, Tab from Wind strength goes to Sunlight', async ({
  page,
}) => {
  await open(page);
  await page.getByText('Population', { exact: true }).click();
  await page.getByText('Weather', { exact: true }).click();
  await expect(radio(page, 'Place')).toBeVisible();
  await expect(radio(page, 'Place')).toBeChecked();
  await page.getByLabel('Wind strength').focus();
  await page.keyboard.press('Tab');
  await expect(radio(page, 'Sunlight')).toBeFocused();
});

test('the start choice lists the finished valleys in first-played order, and the Fen opens with its own rules', async ({
  page,
}) => {
  await page.goto('/');
  await keepProfile(page, ['halcyon', 'fen']);
  await page.reload();
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await expect(page.getByRole('group', { name: 'Start from' }).getByRole('button')).toHaveText([
    'A new valley',
    'Halcyon',
    'Murmuration Fen',
  ]);
  await page.getByRole('button', { name: 'Murmuration Fen' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox: Murmuration Fen' })).toBeVisible();
  await expect.poll(async () => (await run(page)) !== null).toBe(true);
  await page.getByText('Rules', { exact: true }).click();
  await expect(page.getByLabel('Lowest flock threshold')).toBeVisible();
  // Halcyon's own knob is not the Fen's.
  await expect(page.getByLabel('Gift warmth')).toHaveCount(0);
});

test('axe finds no serious issue on the start choice', async ({ page }) => {
  await page.goto('/');
  await keepProfile(page, ['halcyon']);
  await page.reload();
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await expect(page.getByRole('group', { name: 'Start from' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('a rule change that the worker cannot start puts the knob back, says so, and keeps the rules off', async ({
  page,
}) => {
  await page.clock.install();
  await open(page);
  // The next run's worker does not load, so the host gives up before its first snapshot.
  await page.route('**/src/sim-host/worker.ts*', (route) => route.abort());
  await page.getByText('Rules', { exact: true }).click();
  const gift = page.getByLabel('Gift value');
  await expect(gift).toHaveValue('3');
  await gift.focus();
  await page.keyboard.press('ArrowRight');
  await untilStatus(
    page,
    'could not start',
    'The valley could not start again. The rules did not change. Go back to the title to try again.',
  );
  await expect(gift).toHaveValue('3');
  await expect(gift).toHaveAttribute('aria-valuetext', '3');
  // No run goes on, so no control that starts one again works, and a new tool does not hide the notice.
  await expect(gift).toBeDisabled();
  await expect(page.getByLabel('Mixed thresholds', { exact: true })).toBeDisabled();
  // The knob is off, so the focus goes to the one way on.
  await expect(page.getByRole('button', { name: 'Back to title' })).toBeFocused();
  await page.getByRole('application', { name: 'The sandbox valley' }).focus();
  await page.keyboard.press('3');
  await page.keyboard.press('ArrowRight');
  await untilStatus(
    page,
    'could not start',
    'The valley could not start again. The rules did not change. Go back to the title to try again.',
  );
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
});

test('a worker that gives up after the first snapshot stops the run with the same notice and state', async ({
  page,
}) => {
  // Every worker the page spawns, and whether it has posted a message yet.
  await page.addInitScript(() => {
    const seen: { worker: Worker; loaded: boolean }[] = [];
    (window as unknown as { workers: typeof seen }).workers = seen;
    const Real = window.Worker;
    window.Worker = class extends Real {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        const entry = { worker: this, loaded: false };
        seen.push(entry);
        this.addEventListener('message', () => (entry.loaded = true), { once: true });
      }
    };
  });
  await open(page);
  // Paused, so no new tick comes: the second error is at the tick of the first, and the host gives up.
  await page.getByRole('group', { name: 'Time' }).getByRole('button', { name: 'Pause' }).click();
  const fail = () =>
    page.evaluate(() => {
      const seen = (window as unknown as { workers: { worker: Worker; loaded: boolean }[] }).workers;
      seen.at(-1)?.worker.dispatchEvent(new ErrorEvent('error'));
    });
  await fail();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { workers: { loaded: boolean }[] }).workers.at(-1)?.loaded ?? false,
      ),
    )
    .toBe(true);
  await fail();
  await expect(page.getByRole('status').filter({ hasText: 'could not run' })).toHaveText(
    'The game could not run this valley. Go back to the title to try again.',
  );
  await expect(page.getByLabel('Gift value')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Back to title' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
});

test('while a rule change starts the run again, no other rule can change', async ({ page }) => {
  await open(page);
  // The next run's worker loads only when the test lets it, so the start waits.
  let load = (): void => undefined;
  const loaded = new Promise<void>((resolve) => {
    load = resolve;
  });
  await page.route('**/src/sim-host/worker.ts*', async (route) => {
    await loaded;
    await route.continue();
  });
  await page.getByText('Rules', { exact: true }).click();
  await page.getByText('Network', { exact: true }).click();
  const gift = page.getByLabel('Gift value');
  const mixed = page.getByLabel('Mixed thresholds', { exact: true });
  await gift.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gift).toBeDisabled();
  await expect(mixed).toBeDisabled();
  await expect(page.getByLabel('Fog level')).toBeDisabled();
  load();
  await expect(gift).toBeEnabled();
  await expect(mixed).toBeEnabled();
  await expect(gift).toHaveAttribute('aria-valuetext', '4');
  await expect(mixed).toBeChecked();
});

test('a first start that the worker cannot run says so on the start choice', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await keepProfile(page, []);
  await page.reload();
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await page.route('**/src/sim-host/worker.ts*', (route) => route.abort());
  await page.getByRole('button', { name: 'A new valley' }).click();
  await untilStatus(
    page,
    'could not start',
    'The game could not start this valley. Go back to the title to try again.',
  );
  await expect(page.getByRole('button', { name: 'A new valley' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Back to title' })).toBeFocused();
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
});

// The timeline strip, the notes, and the challenge card (plan task M4.11, ADR 0014 items 5 and 6).

/** The dev hook's speeds sent to the sim and the command lists the runners sent. */
const dev = (page: Page) =>
  page.evaluate(() => {
    const d = (window as unknown as { fairWeather: { speeds: number[]; sent: number } }).fairWeather;
    return { speed: d.speeds.at(-1), sent: d.sent };
  });
const strip = (page: Page) => page.getByRole('region', { name: 'Timeline' });
const card = (page: Page) => page.getByRole('region', { name: 'Challenges' });
/** The range's text for a day (a pattern): its creatures and their mean warmth. */
const dayText = (d: string) => new RegExp(`^Day ${d}: \\d+ creatures, mean warmth -?\\d\\.\\d\\d$`);

/** Opens a new valley at ?fast=10 and waits for its second day, so the strip has room to move. */
async function openDay2(page: Page): Promise<void> {
  await open(page, '&fast=10');
  await expect.poll(async () => (await run(page))?.lite.day ?? 0, { timeout: 30_000 }).toBeGreaterThan(0);
}

test('scrubbing the strip pauses the sim and shows the rewound day, and Back to now goes on', async ({
  page,
}) => {
  await openDay2(page);
  const range = strip(page).getByLabel('Rewind');
  await expect(range).toHaveAttribute('aria-valuetext', dayText('[2-9]'));
  await expect.poll(async () => (await dev(page)).speed).toBe(1);
  await range.focus();
  await page.keyboard.press('Home');
  await expect(range).toHaveAttribute('aria-valuetext', dayText('1'));
  await expect.poll(async () => (await dev(page)).speed).toBe(0);
  await expect(page.getByRole('status').filter({ hasText: 'Rewound' })).toBeVisible();
  const paused = (await run(page))?.tick ?? 0;
  await strip(page).getByRole('button', { name: 'Back to now' }).click();
  await expect.poll(async () => (await dev(page)).speed).toBe(1);
  await expect.poll(async () => (await run(page))?.tick ?? 0).toBeGreaterThan(paused);
  await expect(page.getByRole('status').filter({ hasText: 'Rewound' })).toHaveCount(0);
});

/** Rewinds the strip to its first day, so a note pinned now is on day 1. */
async function rewindToDay1(page: Page): Promise<void> {
  const range = strip(page).getByLabel('Rewind');
  await range.focus();
  await page.keyboard.press('Home');
  await expect(range).toHaveAttribute('aria-valuetext', dayText('1'));
}

test('a pinned note of 90 characters keeps 80 and shows on the strip, and a rule change drops it', async ({
  page,
}) => {
  await openDay2(page);
  await rewindToDay1(page);
  const words = 'The bench by the crooked tree fills up at dusk, and Pim waits there for the others.';
  const ninety = words.padEnd(90, '.');
  expect(ninety).toHaveLength(90);
  await strip(page).getByRole('button', { name: 'Pin a note' }).click();
  const field = strip(page).getByLabel('Note (at most 80 characters)');
  await expect(field).toBeFocused();
  await field.fill(ninety);
  // The field cuts as the player types.
  await expect(field).toHaveValue(ninety.slice(0, 80));
  await page.keyboard.press('Enter');
  const note = strip(page).getByRole('button', { name: /^Note on day 1: / });
  await expect(note).toHaveAccessibleName(`Note on day 1: ${ninety.slice(0, 80)}`);
  await expect(note).toHaveText(`Note on day 1: ${ninety.slice(0, 80)}`);
  await expect(strip(page).getByRole('button', { name: 'Pin a note' })).toBeFocused();
  // The note's button rewinds to its tick.
  await strip(page).getByRole('button', { name: 'Back to now' }).click();
  const range = strip(page).getByLabel('Rewind');
  await expect(range).toHaveAttribute('aria-valuetext', dayText('[2-9]'));
  await note.click();
  await expect(range).toHaveAttribute('aria-valuetext', dayText('1'));
  await expect.poll(async () => (await dev(page)).speed).toBe(0);
  await strip(page).getByRole('button', { name: 'Back to now' }).click();
  // A rule change starts a new run, and the notes marked moments of the old one.
  await page.getByText('Rules', { exact: true }).click();
  await page.getByLabel('Gift value').focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await run(page))?.lite.day).toBe(0);
  await expect(strip(page).getByRole('button', { name: /^Note on day/ })).toHaveCount(0);
});

test("the Bell card's Start the dance works once", async ({ page }) => {
  await open(page);
  await card(page).getByRole('button', { name: 'Make Bell dance with only two bridges.' }).click();
  await expect(card(page)).toContainText('Make Bell dance with only two bridges.');
  // The challenge's own start: chapter 9's brook.
  await expect.poll(async () => (await run(page))?.lite.water).toEqual([{ x: 780, y: 0, w: 60, h: 900 }]);
  const dance = card(page).getByRole('button', { name: 'Start the dance' });
  await expect(dance).toBeEnabled();
  const before = (await dev(page)).sent;
  await dance.click();
  await expect(dance).toBeDisabled();
  expect((await dev(page)).sent).toBe(before + 1);
  await expect(card(page).getByRole('button', { name: 'Try again' })).toBeEnabled();
  // Try again starts the challenge again, and the dance is there once more.
  await card(page).getByRole('button', { name: 'Try again' }).click();
  await expect(dance).toBeEnabled();
});

test('picking winter starts in the season content/sandbox.json gives it, and Stop ends the challenge', async ({
  page,
}) => {
  const file = JSON.parse(readFileSync('content/sandbox.json', 'utf8')) as {
    challenges: { id: string; text: string; start: { season: string } }[];
  };
  const winter = file.challenges.find((c) => c.id === 'winter');
  if (!winter) throw new Error('no winter challenge');
  await open(page);
  await card(page).getByRole('button', { name: winter.text }).click();
  await expect(card(page).getByText('The challenge is not finished.')).toHaveText(
    `The challenge is not finished. Season: ${winter.start.season}.`,
  );
  await expect.poll(async () => (await run(page))?.lite.season).toBe(winter.start.season);
  await expect(card(page).getByRole('button', { name: 'Start the dance' })).toHaveCount(0);
  await card(page).getByRole('button', { name: 'Stop the challenge' }).click();
  await expect(card(page).getByRole('button', { name: winter.text })).toBeFocused();
  // Without the challenge, Kith starts in spring again.
  await expect.poll(async () => (await run(page))?.lite.season).toBe('spring');
});

test('axe finds no serious issue with the card open and a note open', async ({ page }) => {
  await open(page);
  await card(page).getByRole('button', { name: 'Make Bell dance with only two bridges.' }).click();
  await expect(card(page).getByRole('button', { name: 'Start the dance' })).toBeVisible();
  await strip(page).getByRole('button', { name: 'Pin a note' }).click();
  await expect(strip(page).getByLabel('Note (at most 80 characters)')).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('Tab reaches the strip, its notes, and the card in order', async ({ page }) => {
  await openDay2(page);
  await rewindToDay1(page);
  await strip(page).getByRole('button', { name: 'Pin a note' }).click();
  await strip(page).getByLabel('Note (at most 80 characters)').fill('Pim waits.');
  await page.keyboard.press('Enter');
  await strip(page).getByLabel('Rewind').focus();
  await page.keyboard.press('Tab');
  await expect(strip(page).getByRole('button', { name: 'Back to now' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(strip(page).getByRole('button', { name: 'Note on day 1: Pim waits.' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(strip(page).getByRole('button', { name: 'Pin a note' })).toBeFocused();
  // The card's fold, then its first challenge.
  await page.keyboard.press('Tab');
  await expect(card(page).getByText('Challenges', { exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    card(page).getByRole('button', { name: 'Get through winter with nobody leaving.' }),
  ).toBeFocused();
});

test('a note that ends in a family emoji at character 80 keeps it whole, and picking a challenge drops the note', async ({
  page,
}) => {
  await openDay2(page);
  await rewindToDay1(page);
  const family = '👩‍👩‍👧';
  await strip(page).getByRole('button', { name: 'Pin a note' }).click();
  await strip(page)
    .getByLabel('Note (at most 80 characters)')
    .fill(`${'a'.repeat(79)}${family}${family}b`);
  await page.keyboard.press('Enter');
  await expect(strip(page).getByRole('button', { name: /^Note on day 1: / })).toHaveText(
    `Note on day 1: ${'a'.repeat(79)}${family}`,
  );
  await strip(page).getByRole('button', { name: 'Back to now' }).click();
  await card(page).getByRole('button', { name: 'Get through winter with nobody leaving.' }).click();
  // The focus goes to the card's first control on.
  await expect(card(page).getByRole('button', { name: 'Try again' })).toBeFocused();
  await expect(strip(page).getByRole('button', { name: /^Note on day/ })).toHaveCount(0);
});

test('a challenge starts with the default knobs and switches, and Bell gives the focus to Start the dance', async ({
  page,
}) => {
  await open(page);
  await page.getByText('Rules', { exact: true }).click();
  await page.getByText('Network', { exact: true }).click();
  const gift = page.getByLabel('Gift value');
  const mixed = page.getByLabel('Mixed thresholds', { exact: true });
  await gift.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gift).toHaveAttribute('aria-valuetext', '4');
  await expect(gift).toBeEnabled();
  await mixed.uncheck();
  await expect(mixed).toBeEnabled();
  await card(page).getByRole('button', { name: 'Make Bell dance with only two bridges.' }).click();
  await expect(card(page).getByRole('button', { name: 'Start the dance' })).toBeFocused();
  await expect(gift).toHaveAttribute('aria-valuetext', '3');
  await expect(mixed).toBeChecked();
});

test('Stop the challenge goes back to the valley, knobs, and bench from before it, at day 0', async ({
  page,
}) => {
  await page.goto('/');
  await keepProfile(page, ['fen']);
  await page.reload();
  await page.getByRole('button', { name: 'Sandbox' }).click();
  await page.getByRole('button', { name: 'Murmuration Fen' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox: Murmuration Fen' })).toBeVisible();
  await expect.poll(async () => (await run(page)) !== null).toBe(true);
  const base = (await structures(page)).length;
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await structures(page)).length).toBe(base + 1);
  const placed = await structures(page);
  await page.getByText('Rules', { exact: true }).click();
  const flock = page.getByLabel('Lowest flock threshold');
  const before = await flock.getAttribute('aria-valuetext');
  await flock.focus();
  await page.keyboard.press('ArrowRight');
  await expect(flock).not.toHaveAttribute('aria-valuetext', before ?? '');
  await expect(flock).toBeEnabled();
  const set = await flock.getAttribute('aria-valuetext');
  await card(page).getByRole('button', { name: 'Get through winter with nobody leaving.' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox: A new valley' })).toBeVisible();
  await card(page).getByRole('button', { name: 'Stop the challenge' }).click();
  await expect(page.getByRole('heading', { name: 'Sandbox: Murmuration Fen' })).toBeVisible();
  await expect(flock).toHaveAttribute('aria-valuetext', set ?? '');
  await expect.poll(async () => (await run(page))?.lite.day).toBe(0);
  expect(await structures(page)).toEqual(placed);
});
