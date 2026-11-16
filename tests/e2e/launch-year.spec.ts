// M4.21 (ADR 0014 item 17, T7): the phone run and the reduced-motion run go from Begin to "The End"
// by pressing each chapter's Skip once its first snapshot has come, so neither waits on how fast CI
// draws or steps. On the way each checks that no two visible controls overlap, and axe checks every
// screen. The no-WebGL run that pages the still version to "The End" is in stills.spec.ts.
import AxeBuilder from '@axe-core/playwright';
import { devices, expect as baseExpect, test, type Locator, type Page } from '@playwright/test';
import { buttonAt, controlClashes, pausedFrames, press, tap } from './helpers.ts';

// Each screen is scanned and measured on software rendering, where a valley draws about once a second.
const expect = baseExpect.configure({ timeout: 20_000 });

test.skip(({ browserName }) => browserName !== 'chromium', 'The whole-journey runs are long; Chromium only.');

/** Every screen between Begin and "The End", in play order (the heading each shows). */
const SCREENS = [
  'Chapter 0',
  'Chapter 1',
  'Chapter 2',
  'Chapter 3',
  'Interlude: The Door for Two',
  'Chapter 4',
  'Interlude: The Telephone Sketch',
  'Chapter 5',
  'Interlude: Dream Bubbles',
  'Chapter 6',
  'Chapter 7',
  "Interlude: Wisp's Postcard",
  'Chapter 8',
  'Interlude: The Long Night',
  'Chapter 9',
  'Chapter 10',
  'The Bridge',
  'Murmuration Fen',
  'Hearsay Hollow',
  'Halcyon',
  'The Homecoming',
  'The End',
];

/** The chapters whose bet opens in the first second (content/chapters). */
const BET_AT_START = new Set(['Chapter 2', 'Chapter 4', 'Chapter 6', 'Chapter 8']);

const snapshots = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: { snapshots: number } }).fairWeather.snapshots);

/**
 * Runs Begin to "The End". `press` presses the button named `name` (a tap or a click) and returns
 * whether it was there. `freeze` stops a screen where it is, so a chapter that ends on its own
 * (a twist can come in seconds) is not skipped by a Skip meant for the one before it. `answer`
 * presses the first choice of a bet card the same way.
 */
async function playToTheEnd(
  page: Page,
  press: (name: string) => Promise<boolean>,
  freeze: (name: string) => Promise<void>,
  answer: (choice: Locator) => Promise<void>,
): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  expect(await press('Begin')).toBe(true);
  for (const name of SCREENS) {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);
    const paused = page.getByRole('button', { name: 'Pause' });
    // A bet's reveal can end a chapter before the freeze, which then stops the next one: its first snapshot is in.
    if (name !== 'The End' && (await paused.getAttribute('aria-pressed').catch(() => null)) !== 'true') {
      // The first snapshot of the screen is in: its scene draws, and an interlude's activity or the fire shows.
      const seen = await snapshots(page);
      await expect
        .poll(() => snapshots(page), { message: `${name}: the first snapshot` })
        .toBeGreaterThan(seen);
    }
    if (BET_AT_START.has(name)) {
      // A bet that opens at the start covers the screen until it is answered, with its first choice.
      const bet = page.getByRole('dialog', { name: 'A bet' });
      await expect(bet).toBeVisible();
      await layoutAndAxe(page, name);
      await answer(bet.getByRole('button').first());
      await expect(bet).toBeHidden();
      await freeze(name);
      // The answer runs the bet's reveal, which can end the chapter before the freeze: then it is over.
      if (!(await page.getByRole('heading', { level: 1 }).innerText()).includes(name)) continue;
      await layoutAndAxe(page, `${name} after its bet`);
    } else {
      await freeze(name);
      await layoutAndAxe(page, name);
    }
    if (name === 'The End') break;
    if (name === 'Chapter 10' || name === 'The Bridge') {
      // A frozen fire or bridge does not hear Listen or Wake: the player lets it go on first.
      const pause = page.getByRole('button', { name: 'Pause' });
      if ((await pause.isVisible()) && (await pause.getAttribute('aria-pressed')) === 'true')
        expect(await press('Pause')).toBe(true);
    }
    if (name === 'Chapter 10') {
      for (let k = 0; k < 5; k++) expect(await press('Listen')).toBe(true);
    } else if (name === 'The Bridge') {
      expect(await press('Wake as')).toBe(true);
    } else {
      expect(await press('Skip chapter')).toBe(true);
    }
  }
}

/** The checks every screen gets: no serious axe issue, and no two visible controls that overlap. */
async function layoutAndAxe(page: Page, name: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(
    violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    `${name}: axe`,
  ).toEqual([]);
  expect(await controlClashes(page), `${name}: controls that overlap`).toEqual([]);
}

test.describe('on a phone, by taps only', () => {
  const { viewport, userAgent, deviceScaleFactor, hasTouch } = devices['Pixel 7'];
  test.use({ viewport, userAgent, deviceScaleFactor, hasTouch, isMobile: true });

  test('Begin to "The End" with one Skip for each chapter: no control covers another, and axe finds nothing', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const touch = async (name: string) => {
      // The hero choice scrolls inside the phone's screen: the player scrolls Wake into view first.
      await page
        .getByRole('button', { name })
        .first()
        .scrollIntoViewIfNeeded({ timeout: 1000 })
        .catch(() => undefined);
      const at = await buttonAt(page, 'main', name);
      if (!at) return false;
      await page.touchscreen.tap(at.x, at.y);
      return true;
    };
    await playToTheEnd(
      page,
      touch,
      async () => {
        // Pause toggles, and a bet's reveal may already have moved the game to a screen paused by the last tap.
        const pause = page.getByRole('button', { name: 'Pause' });
        if (!(await pause.isVisible())) return;
        if ((await pause.getAttribute('aria-pressed')) !== 'true') await touch('Pause');
      },
      async (choice) => {
        const box = await choice.boundingBox();
        if (!box) throw new Error('The bet choice has no box to tap');
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      },
    );
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('Begin to "The End" with one Skip for each chapter: no control covers another, axe finds nothing, and every paused scene is still', async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const click = async (name: string) => (await tap(page, 'main', name)) !== null;
    await playToTheEnd(
      page,
      click,
      async (name) => {
        // The bridge and The End have no Pause: there is no paused scene to compare.
        if (!(await page.getByRole('button', { name: 'Pause' }).isVisible())) return;
        const [a, b] = await pausedFrames(page);
        expect(a.equals(b), `${name}: the paused scene does not change`).toBe(true);
      },
      (choice) => press(page, choice),
    );
  });
});
