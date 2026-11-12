import { devices, expect, test, type Locator, type Page } from '@playwright/test';

// The vertical slice (M1.8, M1.12). Dev builds only: ?chapter=N starts at chapter N, and ?fast=N
// multiplies every sim speed, so a whole chapter 0 to 3 run takes minutes.

const live = (page: Page) => page.locator('[aria-live="polite"]');
/** Presses Tab until the status line names `name`: ch0's Pim beats wait for the sim to wake Pim. */
const tabTo = async (page: Page, name: string) => {
  // The status line is a live region (role=status), so a screen reader hears each pick.
  const picked = page.getByRole('status').filter({ hasText: new RegExp(`^Picked: ${name}(,|$)`) });
  for (let i = 0; i < 40 && !(await picked.isVisible()); i++) await page.keyboard.press('Tab');
  await expect(picked).toBeVisible();
};
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
  await tabTo(page, 'Pim');
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

test('Skip chapter moves to the next chapter, whose heading names it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0: First Light' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip chapter' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 1: The Wave' })).toBeVisible();
});

test("the player's 2x survives the next chapter's start", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await page.getByRole('button', { name: '2×' }).click();
  await page.getByRole('button', { name: 'Skip chapter' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2×' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await dev(page)).speeds.at(-1)).toBe(2);
});

test('chapter 3: one bench, the tray shows it used, and a reply with no wave gets a line', async ({
  page,
}) => {
  await page.goto('/?chapter=3');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(live(page)).toContainText('A crooked tree'); // the runner takes verbs after a snapshot
  const bench = page.getByRole('group', { name: 'Tools' }).getByRole('button', { name: /Bench/ });
  await page.keyboard.press('Enter');
  await expect(live(page)).toContainText('A bench sits under the tree');
  await expect(bench).toContainText('used');
  await page.keyboard.press('2');
  await page.keyboard.press('Enter');
  await expect(live(page)).toContainText('Nobody is waving at the sky');
});

test('the place tool is named by what it sets', async ({ page }) => {
  const tray = page.getByRole('group', { name: 'Tools' });
  // ch6 sets lanterns and ch9 bridges (index 9 and 14 in play order).
  for (const [index, name] of [
    [9, 'Lantern'],
    [14, 'Bridge'],
  ] as const) {
    await page.goto(`/?chapter=${String(index)}`);
    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(tray.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    await expect(tray.getByRole('button', { name: /Bench/ })).toHaveCount(0);
  }
});

test('Z zooms out to the Cosmos and X back in; Escape lets go of a thread mark first', async ({ page }) => {
  // ch5 (index 7): whisper, thread, and zoom.
  await page.goto('/?chapter=7');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(scene(page)).toBeFocused();
  await expect(live(page)).toContainText('Late summer'); // the first snapshot is in, so Tab has creatures
  await page.keyboard.press('z');
  const cosmos = page.getByRole('application', { name: /^The Cosmos/ });
  await expect(cosmos).toBeFocused();
  await expect(page.getByRole('status')).toContainText('The Cosmos');
  await page.keyboard.press('x');
  await expect(scene(page)).toBeFocused();
  // Thread is tool 3: Tab picks a creature, Enter marks it, Escape lets go and keeps focus here.
  await page.keyboard.press('3');
  await tabTo(page, 'Pim');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Thread from');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status')).not.toContainText('Thread from');
  await expect(scene(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Tools' }).getByRole('button').first()).toBeFocused();
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
/** Pim's feet in content/scenarios/m0.json; Pim sleeps there at ch0's dawn, so the search starts there. */
const PIM_START = { x: 160, y: 130 };
/** The slice runs end where chapter 3 hands over to the first interlude. */
const interlude = (page: Page) => page.getByRole('heading', { name: 'Interlude: The Door for Two' });
const chapter = (page: Page, n: number) => page.getByRole('heading', { name: `Chapter ${String(n)}` });

/**
 * Canvas points on a grid over the fitted scene where no HUD element is on top, nearest first to
 * the scene point `near` (the wide shot shows the whole scene, so scene units map onto the fit).
 */
async function scenePoints(
  page: Page,
  step: number,
  near: { x: number; y: number },
): Promise<{ x: number; y: number }[]> {
  return page.evaluate(
    ({ step, aspect, near }) => {
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
      const nx = left + (near.x / 1600) * w;
      const ny = top + (near.y / 900) * h;
      return out.sort((a, b) => Math.hypot(a.x - nx, a.y - ny) - Math.hypot(b.x - nx, b.y - ny));
    },
    { step, aspect: SCENE_ASPECT, near },
  );
}

/**
 * Clicks or taps across the scene, nearest Pim's spot first, until the status line names Pim as
 * picked, and so wakes each creature it hits with the Wake tool (ch0's Pim beats wait for Pim's
 * wake). It pauses first when it can, as a slow player might, so no sim days pass while it looks.
 * The status has no state while paused (no snapshot), so "Picked: Pim" alone counts. It gives up
 * when the chapter heading `title` goes away or a dialog opens, so it never clicks into the next
 * screen.
 */
async function pickByPointer(page: Page, touch: boolean, step: number, title: string): Promise<boolean> {
  const press = (x: number, y: number) => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
  const toggle = (b: Locator) => (touch ? b.tap() : b.click());
  const pause = page.getByRole('button', { name: 'Pause' });
  const pausing = (await pause.isEnabled()) && (await pause.getAttribute('aria-pressed')) === 'false';
  if (pausing) await toggle(pause);
  let found = false;
  for (const { x, y } of await scenePoints(page, step, PIM_START)) {
    await press(x, y);
    const now = await page.evaluate(
      ({ t, w }) => ({
        picked: [...document.querySelectorAll('p')].some((p) =>
          new RegExp(`^Picked: ${w}(,|$)`).test(p.textContent),
        ),
        gone:
          document.querySelector('h1')?.textContent !== t ||
          document.querySelector('[role="dialog"]') !== null,
      }),
      { t: title, w: 'Pim' },
    );
    found = now.picked;
    if (now.picked || now.gone) break;
  }
  if (pausing && (await pause.isVisible()) && (await pause.isEnabled())) await toggle(pause);
  return found;
}

/**
 * Clicks the middle of a button that may go away as the chapter moves on: the button under the
 * element `scope` (a CSS selector) whose text has `text`, or its last button. A missing button is
 * skipped. It finds the button in one page.evaluate and clicks at once, as a player would. Locator
 * actions wait on animation frames (to resolve the locator, and for click, to see the button hold
 * still), so with a short timeout they time out when software rendering draws two or three
 * frames a second, as on CI with no GPU; and at ?fast=10 a sky bid's 6 s reply window is only
 * 0.6 s of real time.
 */
async function tryClick(page: Page, scope: string, text?: string): Promise<void> {
  const at = await page.evaluate(
    ({ scope, text }) => {
      const buttons = [...(document.querySelector(scope)?.querySelectorAll('button') ?? [])];
      const b = text === undefined ? buttons.at(-1) : buttons.find((e) => e.textContent.includes(text));
      const r = b?.getBoundingClientRect();
      return r && r.width > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    },
    { scope, text },
  );
  if (at) await page.mouse.click(at.x, at.y);
}

/**
 * The auto-player: it reads the screen and acts with the active tool, as a player would. It clicks
 * until it wakes Pim in chapter 0, answers every bet with its last option, holds still for every wave, and
 * sets one bench at the spot nearest the middle of the scene.
 */
async function autoPlay(page: Page): Promise<void> {
  const bet = page.getByRole('dialog', { name: 'A bet' });
  const tray = page.getByRole('group', { name: 'Tools' });
  const acted = new Set<string>();
  let shown = '';
  let framesAtStart = 0;
  while (!(await interlude(page).isVisible())) {
    if (await bet.isVisible()) {
      await tryClick(page, '[role="dialog"]');
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
    // Keyed by verb, not the button text, which changes once the bench is used: a second click on
    // the scene could land on the end screen and take its focus.
    const key = `${title}/${['Wake', 'Bench'].find((v) => tool.includes(v)) ?? tool}`;
    if (tool.includes('Wake') && !acted.has(key)) {
      acted.add(key);
      await pickByPointer(page, false, 16, title);
    } else if (tool.includes('Respond')) {
      await tryClick(page, '[aria-label="Reply to the sky"]', 'Hold still');
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
  await expect(interlude(page)).toBeVisible();
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
  // Chapter 0: Tab picks Pim, Enter wakes Pim.
  await expect(chapter(page, 0)).toBeVisible();
  await expect(scene(page)).toBeFocused();
  await expect(live(page)).toContainText('The dawn'); // the first snapshot is in, so Tab has creatures
  await tabTo(page, 'Pim');
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
  await expect(interlude(page)).toBeVisible({ timeout: 300_000 });
});

test('the end screen takes focus, and its button returns to the title', async ({ page }) => {
  // Chapter 10 is the last in play order (index 15); skipping it ends the year so far.
  await page.goto('/?chapter=15');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(chapter(page, 10)).toBeVisible();
  await page.getByRole('button', { name: 'Skip chapter' }).click();
  const endTitle = page.getByRole('heading', { name: 'End of the year so far' });
  await expect(endTitle).toBeFocused();
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

  test('a tap wakes Pim and finishes chapter 0', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/?fast=${FAST}`);
    await page.getByRole('button', { name: 'Begin' }).tap();
    await expect(chapter(page, 0)).toBeVisible();
    await expect(live(page)).toContainText('The dawn'); // the scene is drawn, so there is a creature to tap
    expect(await pickByPointer(page, true, 8, 'Chapter 0: First Light')).toBe(true);
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
    await tabTo(page, 'Pim');
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
