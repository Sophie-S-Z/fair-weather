import { devices, expect, test, type Locator, type Page } from '@playwright/test';

// The vertical slice (M1.8, M1.12). Dev builds only: ?chapter=N starts at chapter N, and ?fast=N
// multiplies every sim speed, so a whole chapter 0 to 3 run takes minutes.

const live = (page: Page) => page.locator('[aria-live="polite"]');
const scene = (page: Page) => page.getByRole('application', { name: 'The meadow' });
const dev = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { fairWeather: { speeds: number[]; frames: number } }).fairWeather,
  );

test('Begin starts chapter 0 and its first lines are in the beat line', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await expect(live(page)).toContainText('press Enter to wake it');
  await expect(live(page)).toContainText('The dawn touches the meadow');
  await expect(scene(page)).toBeFocused();
});

test('by keyboard: wake in chapter 0, then a slow reply still finishes chapter 1', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await expect(live(page)).toContainText('The dawn');
  await page.keyboard.press('Tab');
  await expect(page.getByText(/^Picked: /)).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Chapter 1' })).toBeVisible({ timeout: 20_000 });
  await expect(live(page)).toContainText('When Pim waves');
  // Past the 6 s window: the first bid gets the automatic away, and Pim bids again.
  await page.waitForTimeout(7_000);
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: 'H Hold still' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('g');
  await expect(page.getByRole('button', { name: 'G Glow back' })).toHaveAttribute('aria-pressed', 'true');
  const ch2 = page.getByRole('heading', { name: 'Chapter 2' });
  for (let i = 0; i < 60 && !(await ch2.isVisible()); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  }
  await expect(ch2).toBeVisible();
});

test('Skip chapter moves to the next chapter', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip chapter' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 1' })).toBeVisible();
});

test('the notes drawer opens with a button, takes focus, and closes with Escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  const notes = page.getByRole('button', { name: 'Notes' });
  await notes.click();
  await expect(notes).toHaveAttribute('aria-expanded', 'true');
  const panel = page.getByRole('region', { name: 'Margin notes' });
  await expect(panel).toBeFocused();
  await expect(panel).toContainText('Why a first look matters');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(notes).toBeFocused();
});

test('the bet card takes focus, keeps it, ignores Escape, and gives it back', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?chapter=2');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(scene(page)).toBeFocused();
  // The bet opens at chapter time 0 (ch2 open_bet), while the scene has focus.
  const dialog = page.getByRole('dialog', { name: 'A bet' });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole('button', { name: 'Pim' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Wisp' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Pim' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(scene(page)).toBeFocused();
  // The reveal names the guess and an answer that was one of the options.
  await expect(live(page)).toContainText(/Your guess: Pim\. The answer: (Pim|Krit|Echo|Moss|Bell|Wisp)\./, {
    timeout: 90_000,
  });
});

test('a hidden tab sets speed 0 and stops drawing; a visible one restores both', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await expect.poll(async () => (await dev(page)).speeds).toEqual([1]);
  await expect.poll(async () => (await dev(page)).frames).toBeGreaterThan(0);
  const setVisibility = (state: string) =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  expect((await dev(page)).speeds).toEqual([1, 0]);
  const frames = (await dev(page)).frames;
  await page.waitForTimeout(500);
  expect((await dev(page)).frames).toBe(frames);
  await setVisibility('visible');
  expect((await dev(page)).speeds).toEqual([1, 0, 1]);
  await expect.poll(async () => (await dev(page)).frames).toBeGreaterThan(frames);
});

test('Continue is enabled after a chapter has started, and resumes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  // The autosave is written a moment after the chapter starts; wait until it is in IndexedDB.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const open = indexedDB.open('fair-weather');
            open.onerror = () => {
              resolve(false);
            };
            open.onsuccess = () => {
              const db = open.result;
              if (!db.objectStoreNames.contains('saves')) {
                db.close();
                resolve(false);
                return;
              }
              const get = db.transaction('saves').objectStore('saves').getKey('auto');
              get.onsuccess = () => {
                db.close();
                resolve(get.result !== undefined);
              };
              get.onerror = () => {
                db.close();
                resolve(false);
              };
            };
          }),
      ),
    )
    .toBe(true);
  await page.reload();
  const cont = page.getByRole('button', { name: 'Continue' });
  await expect(cont).toBeEnabled();
  await cont.click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await expect(live(page)).toContainText('press Enter to wake it');
});

// Whole-slice runs (M1.12, spec T7). They drive the real UI only: keys, clicks, and taps.

const FAST = '10';
const SCENE_ASPECT = 1600 / 900; // content/scenes/kith-meadow.json; the view fits it in the canvas
const endTitle = (page: Page) => page.getByRole('heading', { name: 'End of the first spring' });
const chapter = (page: Page, n: number) => page.getByRole('heading', { name: `Chapter ${String(n)}` });

/** Canvas points on a grid over the fitted scene, top row first, where no HUD element is on top. */
async function scenePoints(page: Page, step: number): Promise<{ x: number; y: number }[]> {
  return page.evaluate(
    ({ step, aspect }) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return [];
      const r = canvas.getBoundingClientRect();
      const w = Math.min(r.width, r.height * aspect);
      const h = w / aspect;
      const left = r.left + (r.width - w) / 2;
      const top = r.top + (r.height - h) / 2;
      const out: { x: number; y: number }[] = [];
      for (let y = top + step / 2; y < top + h; y += step)
        for (let x = left + step / 2; x < left + w; x += step)
          if (document.elementFromPoint(x, y) === canvas) out.push({ x, y });
      return out;
    },
    { step, aspect: SCENE_ASPECT },
  );
}

/**
 * Clicks or taps across the scene until the status line names a picked creature, and so wakes it
 * with the Wake tool. It pauses first when it can, as a slow player might, so no sim days pass
 * while it looks (a sleeper left hungry for days goes away). It gives up when the chapter heading
 * `title` goes away or a dialog opens, so it never clicks into the next screen.
 */
async function pickByPointer(page: Page, touch: boolean, step: number, title: string): Promise<boolean> {
  const press = (x: number, y: number) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const toggle = (b: Locator) => (touch ? b.tap() : b.click());
  const pause = page.getByRole('button', { name: 'Pause' });
  const pausing = (await pause.isEnabled()) && (await pause.getAttribute('aria-pressed')) === 'false';
  if (pausing) await toggle(pause);
  let found = false;
  for (const { x, y } of await scenePoints(page, step)) {
    await press(x, y);
    const now = await page.evaluate(
      (t) => ({
        picked: [...document.querySelectorAll('p')].some((p) => p.textContent.startsWith('Picked: ')),
        gone:
          document.querySelector('h1')?.textContent !== t ||
          document.querySelector('[role="dialog"]') !== null,
      }),
      title,
    );
    found = now.picked;
    if (now.picked || now.gone) break;
  }
  if (pausing && (await pause.isVisible()) && (await pause.isEnabled())) await toggle(pause);
  return found;
}

/** Clicks a button that may go away as the chapter moves on; a missing button is skipped. */
async function tryClick(button: Locator): Promise<void> {
  await button.click({ timeout: 1_000 }).catch(() => undefined);
}

/**
 * The auto-player: it reads the screen and acts with the active tool, as a player would. It wakes
 * one creature per chapter, answers every bet with its last option, holds still for every wave, and
 * sets one bench at the spot nearest the middle of the scene.
 */
async function autoPlay(page: Page): Promise<void> {
  const bet = page.getByRole('dialog', { name: 'A bet' });
  const tray = page.getByRole('group', { name: 'Tools' });
  const acted = new Set<string>();
  let shown = '';
  let framesAtStart = 0;
  while (!(await endTitle(page).isVisible())) {
    if (await bet.isVisible()) {
      await tryClick(bet.getByRole('button').last());
      continue;
    }
    const [title = ''] = await page.locator('h1').allTextContents();
    // Like a player, it acts once the new chapter's scene is on screen (the runner needs a snapshot).
    if (title !== shown) {
      shown = title;
      framesAtStart = (await dev(page)).frames;
    }
    if ((await dev(page)).frames <= framesAtStart) {
      await page.waitForTimeout(100);
      continue;
    }
    const [tool = ''] = await tray.getByRole('button', { pressed: true }).allTextContents();
    const key = `${title}/${tool}`;
    if (tool.includes('Wake') && !acted.has(key)) {
      acted.add(key);
      await pickByPointer(page, false, 16, title);
    } else if (tool.includes('Respond')) {
      await tryClick(page.getByRole('button', { name: 'H Hold still' }));
    } else if (tool.includes('Bench') && !acted.has(key)) {
      const box = await scene(page).boundingBox();
      if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      acted.add(key);
    }
    await page.waitForTimeout(250);
  }
}

test('the auto-player finishes chapters 0 to 3', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/?fast=${FAST}`);
  await page.getByRole('button', { name: 'Begin' }).click();
  await autoPlay(page);
  await expect(endTitle(page)).toBeFocused();
  expect(errors).toEqual([]);
});

test('a keyboard-only run finishes chapters 0 to 3', async ({ page }) => {
  test.setTimeout(600_000);
  /** Presses `key` until `done` is visible; the screen moves on by itself between presses. */
  const pressUntil = async (key: string, done: Locator) => {
    for (let i = 0; i < 2_000 && !(await done.isVisible()); i++) {
      await page.keyboard.press(key);
      await page.waitForTimeout(250);
    }
    await expect(done).toBeVisible();
  };
  await page.goto(`/?fast=${FAST}`);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  // Chapter 0: Tab picks a sleeper, Enter wakes it.
  await expect(chapter(page, 0)).toBeVisible();
  await expect(scene(page)).toBeFocused();
  await expect(live(page)).toContainText('The dawn'); // the first snapshot is in, so Tab has creatures
  await page.keyboard.press('Tab');
  await expect(page.getByText(/^Picked: /)).toBeVisible();
  await page.keyboard.press('Enter');
  // Chapter 1: the digit picks Respond, R picks Rumble, Enter answers the wave.
  await expect(chapter(page, 1)).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press('2');
  await page.keyboard.press('r');
  await expect(page.getByRole('button', { name: 'R Rumble' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('g');
  await expect(page.getByRole('button', { name: 'G Glow back' })).toHaveAttribute('aria-pressed', 'true');
  await pressUntil('Enter', chapter(page, 2));
  // Chapter 2: the bet card takes focus; the arrow-free path is Tab to an option, then Enter.
  const bet = page.getByRole('dialog', { name: 'A bet' });
  await expect(bet).toBeVisible({ timeout: 60_000 });
  await page.keyboard.press('Tab');
  await expect(bet.getByRole('button', { name: 'Krit' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(bet).toBeHidden();
  await expect(scene(page)).toBeFocused();
  // Chapter 3: Bench is the tool; the arrows move the spot, and Enter sets the bench there.
  await expect(chapter(page, 3)).toBeVisible({ timeout: 300_000 });
  await expect(page.getByText(/^Bench spot: /)).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText('Bench spot: under crooked tree')).toBeVisible();
  await expect(live(page)).toContainText('A crooked tree'); // the runner takes verbs after a snapshot
  await page.keyboard.press('Enter');
  await expect(live(page)).toContainText('A bench sits under the tree');
  await expect(endTitle(page)).toBeVisible({ timeout: 300_000 });
  await expect(endTitle(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
});

test.describe('on a phone', () => {
  // Firefox has no isMobile emulation; it still gets the phone viewport and touch.
  const { viewport, userAgent, deviceScaleFactor, hasTouch } = devices['Pixel 7'];
  test.use({
    viewport,
    userAgent,
    deviceScaleFactor,
    hasTouch,
    isMobile: async ({ browserName }, use) => use(browserName !== 'firefox'),
  });

  test('a tap wakes a creature and finishes chapter 0', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/?fast=${FAST}`);
    await page.getByRole('button', { name: 'Begin' }).tap();
    await expect(chapter(page, 0)).toBeVisible();
    await expect(live(page)).toContainText('The dawn'); // the scene is drawn, so there is a creature to tap
    expect(await pickByPointer(page, true, 8, 'Chapter 0')).toBe(true);
    await expect(chapter(page, 1)).toBeVisible({ timeout: 60_000 });
  });
});

/** Two shots of the paused scene, half a second apart. */
async function pausedFrames(page: Page): Promise<[Buffer, Buffer]> {
  // Wait until the scene is being drawn from snapshots, so the pause holds a drawn world.
  const frames = (await dev(page)).frames;
  await expect.poll(async () => (await dev(page)).frames).toBeGreaterThan(frames);
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(500); // the last snapshot's tween and any camera move settle
  const canvas = page.locator('canvas');
  const a = await canvas.screenshot();
  await page.waitForTimeout(500);
  return [a, await canvas.screenshot()];
}

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('chapter 0 finishes, and the paused scene does not boil', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/?fast=${FAST}`);
    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(chapter(page, 0)).toBeVisible();
    await expect(scene(page)).toBeFocused();
    await expect(live(page)).toContainText('The dawn');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(chapter(page, 1)).toBeVisible({ timeout: 60_000 });
    const [a, b] = await pausedFrames(page);
    expect(a.equals(b)).toBe(true);
  });
});

test('without reduced motion, the paused scene boils (the control for the test above)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(chapter(page, 0)).toBeVisible();
  const [a, b] = await pausedFrames(page);
  expect(a.equals(b)).toBe(false);
});
