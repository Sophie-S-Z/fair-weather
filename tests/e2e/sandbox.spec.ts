// The sandbox screen (plan task M4.10, ADR 0014 items 1 to 5). Dev ?sandbox=new opens a new Kith
// valley; the dev hook reads the run's newest snapshot.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { WorldLite } from '../../src/sim-host/protocol.ts';
import { canvasPoints } from './helpers.ts';

/** The sandbox run's newest snapshot and its tick, or null before the first. */
const run = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { fairWeather: { sandbox(): { tick: number; lite: WorldLite } | null } }
    ).fairWeather.sandbox(),
  );
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
  await expect(gift).toHaveAttribute('aria-valuetext', '3.5');
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
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('fair-weather', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('saves');
        req.onerror = () => {
          reject(req.error ?? new Error('open failed'));
        };
        req.onsuccess = () => {
          const tx = req.result.transaction('saves', 'readwrite');
          const verses = [{ title: 'The Asking', text: 'A test verse.', note: null }];
          tx.objectStore('saves').put(
            { pages: [{ narrator: 'Pim', verses, year: 1, seed: 1 }], feathers: 0 },
            'profile',
          );
          tx.oncomplete = () => {
            resolve();
          };
          tx.onerror = () => {
            reject(tx.error ?? new Error('put failed'));
          };
        };
      }),
  );
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
