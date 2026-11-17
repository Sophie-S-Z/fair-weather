// M4.19: the help sheet, the phone layout, and the bundled type (ADR 0014 items 14 and 15).
import { devices, expect, test, type Page } from '@playwright/test';
import { controlClashes, lastSpeed, running, seriousViolations } from './helpers.ts';

/** Starts chapter 0 and waits until the scene has focus. */
async function startGame(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  const scene = page.getByRole('application', { name: 'The meadow' });
  await expect(scene).toBeFocused();
  return scene;
}
/** Opens a new sandbox valley and waits for its first snapshot. */
async function startSandbox(page: Page) {
  await page.goto('/?sandbox=new');
  await expect(page.getByRole('heading', { name: 'Sandbox: A new valley' })).toBeVisible();
  const scene = page.getByRole('application', { name: 'The sandbox valley' });
  await expect(scene).toBeFocused();
  await expect.poll(() => running(page)).toBe(true);
  return scene;
}
/**
 * The focused element's tag, id and text when the focus is outside the element of `selector`, and
 * null when it is inside, so a failure names where the focus went.
 */
const focusOutside = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const now = document.activeElement;
    if (document.querySelector(sel)?.contains(now)) return null;
    return now === null ? 'nothing' : `${now.tagName} #${now.id} "${now.textContent.slice(0, 40)}"`;
  }, selector);
/** Starts the Fen with a one-page journey, so the journal and its dialog open. */
async function startFen(page: Page) {
  await page.goto('/?chapter=16');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: /^Wake as / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Murmuration Fen' })).toBeVisible();
  await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
  await page.evaluate(() => {
    const fw = (
      window as unknown as {
        fairWeather: { journey: () => { pages: unknown[]; keepsakes: unknown[] } | null };
      }
    ).fairWeather;
    const j = fw.journey();
    if (!j) throw new Error('no journey');
    j.pages = [
      {
        valley: 'fen',
        keepsake: null,
        stamp: 'welcomed',
        said: { value: 0.8, strength: 0.9 },
        postcard: null,
        caption: '',
      },
    ];
    j.keepsakes = [];
  });
}

test.describe('the help sheet', () => {
  test('? opens the keys in the game with the sim paused; Escape gives focus back to the scene', async ({
    page,
  }) => {
    const scene = await startGame(page);
    await expect.poll(() => lastSpeed(page)).toBe(1);
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'How to play' });
    await expect(help).toBeVisible();
    await expect(help.getByRole('heading', { name: 'How to play' })).toBeFocused();
    await expect(help.getByRole('row', { name: /Tab Move to the next creature/ })).toBeVisible();
    await expect(help.getByRole('row', { name: /^B Book of Skies/ })).toBeVisible();
    await expect(help.getByRole('row', { name: /Move to the tools/ })).toBeVisible();
    // Chapter 0 has one tool and no zoom, peek, walk, replies, or journal: no row for what does not work.
    for (const name of [/^P /, /^W /, /^Z, X /, /^G, H, R /, /^O, K /, /^L /, /^J, B /, /^1 to 8 /]) {
      await expect(help.getByRole('row', { name })).toHaveCount(0);
    }
    await expect.poll(() => lastSpeed(page)).toBe(0);
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
    await expect(scene).toBeFocused();
    await expect.poll(() => lastSpeed(page)).toBe(1);
  });

  test('? opens the keys from a button too, and not while typing in a field', async ({ page }) => {
    await startGame(page);
    await page.getByRole('button', { name: 'Diary and notes' }).focus();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'How to play' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Diary and notes' })).toBeFocused();
  });

  test('How to play opens the same sheet from a button, with the sim paused', async ({ page }) => {
    await startGame(page);
    await expect.poll(() => lastSpeed(page)).toBe(1);
    await page.getByRole('button', { name: 'How to play' }).click();
    const help = page.getByRole('dialog', { name: 'How to play' });
    await expect(help).toContainText('Choose a tool at the bottom of the screen.');
    await expect(help.getByRole('row', { name: /Tab Move to the next creature/ })).toBeVisible();
    await expect.poll(() => lastSpeed(page)).toBe(0);
    await help.getByRole('button', { name: 'Close' }).click();
    await expect(help).toBeHidden();
    await expect.poll(() => lastSpeed(page)).toBe(1);
  });

  test('the Settings screen says that ? shows the keys', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByText('Press ? in the game or the sandbox to see the keys.')).toBeVisible();
  });

  test('Close gives focus back, and Tab stays inside the sheet', async ({ page }) => {
    const scene = await startGame(page);
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'How to play' });
    await expect(help).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(help.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(help.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(help.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(help).toBeHidden();
    await expect(scene).toBeFocused();
  });

  test('? opens the sandbox keys, with 1 to 8 and paths, and Escape gives focus back', async ({ page }) => {
    const scene = await startSandbox(page);
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Keys' });
    await expect(help).toBeVisible();
    await expect(help.getByRole('row', { name: /^1 to 8 Pick a tool/ })).toBeVisible();
    await expect(help.getByRole('row', { name: /^Enter, then Enter / })).toBeVisible();
    await expect(help.getByRole('row', { name: /Journal/ })).toHaveCount(0);
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
    await expect(scene).toBeFocused();
  });
});

/** Sets the real text-size setting (it is kept in the browser, so later pages use it). */
async function setTextSize(page: Page, size: '1.25' | '1.5') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Text size').selectOption(size);
  await page.getByRole('button', { name: 'Back' }).click();
}

/** Every line of chapter 2's intro is in the story strip, which scrolls to it, and none steals focus. */
async function expectAllLines(page: Page) {
  await page.goto('/?chapter=2');
  await page.getByRole('button', { name: 'Begin' }).click();
  const lines = page.locator('.beat-line p');
  await expect.poll(() => lines.count()).toBeGreaterThanOrEqual(6);
  const strip = page.getByRole('group', { name: 'Story lines' });
  await expect(strip).toHaveAttribute('tabindex', '0');
  const count = await lines.count();
  for (let i = 0; i < count; i++) {
    await lines.nth(i).scrollIntoViewIfNeeded();
    const inside = await page.evaluate((n) => {
      const box = document.querySelector('.beat-line')?.getBoundingClientRect();
      const r = document.querySelectorAll('.beat-line p')[n]?.getBoundingClientRect();
      return !!box && !!r && r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
    }, i);
    expect(inside).toBe(true);
  }
  // The strip never took the focus.
  expect(await page.evaluate(() => document.activeElement?.classList.contains('beat-line'))).toBe(false);
}

test('in landscape the chapter 2 intro shows all of its lines in the story strip', async ({ page }) => {
  await expectAllLines(page);
});

/** Starts chapter 2 and answers its bet, so the story strip overflows with the chapter's lines. */
async function startChapter2(page: Page) {
  await page.goto('/?chapter=2');
  await page.getByRole('button', { name: 'Begin' }).click();
  const bet = page.getByRole('dialog', { name: 'A bet' });
  await expect(bet).toBeVisible({ timeout: 20_000 });
  await bet.getByRole('button', { name: 'Pim' }).click();
  await expect(bet).toBeHidden();
  const scene = page.getByRole('application', { name: 'The meadow' });
  await expect(scene).toBeFocused();
  const strip = page.getByRole('group', { name: 'Story lines' });
  await expect(strip).toHaveAttribute('tabindex', '0');
  return { scene, strip };
}

test('in landscape a wheel over the story strip scrolls its lines', async ({ page }) => {
  const { strip } = await startChapter2(page);
  const r = await strip.boundingBox();
  if (!r) throw new Error('no strip');
  const x = r.x + r.width / 2;
  const y = r.y + r.height / 2;
  // The strip, not the scene under it, takes the pointer, and a finger drag scrolls it.
  expect(
    await page.evaluate((at) => document.elementFromPoint(at.x, at.y)?.closest('.beat-line') !== null, {
      x,
      y,
    }),
  ).toBe(true);
  expect(await strip.evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y');
  await strip.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => strip.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test('in landscape a tap on the scene beside the story strip reaches the scene', async ({ page }) => {
  const { scene, strip } = await startChapter2(page);
  const r = await strip.boundingBox();
  if (!r) throw new Error('no strip');
  const x = r.x - 20;
  const y = r.y + r.height / 2;
  expect(
    await page.evaluate(
      (at) => document.elementFromPoint(at.x, at.y)?.closest('[role="application"]') !== null,
      { x, y },
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(scene).not.toBeFocused();
  await page.mouse.click(x, y);
  await expect(scene).toBeFocused();
});

test('in landscape the story strip comes before the tools in the tab order, as it does on screen', async ({
  page,
}) => {
  const { strip } = await startChapter2(page);
  const wake = page.getByRole('button', { name: /Wake/ });
  const top = async (l: typeof strip) => (await l.boundingBox())?.y ?? 0;
  expect(await top(strip)).toBeLessThan(await top(wake));
  await page.keyboard.press('Escape');
  await expect(wake).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(strip).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(wake).toBeFocused();
});

/** The top of the bottom bar, and the bottom of what sits above it: the title, the drawer button, and the Cosmos band. */
const barAndAbove = (page: Page) =>
  page.evaluate(() => ({
    bar: document.querySelector('.bottom')?.getBoundingClientRect().top ?? 0,
    above: Math.max(
      ...['.title', '.drawer', '.band'].map(
        (s) => document.querySelector(s)?.getBoundingClientRect().bottom ?? 0,
      ),
    ),
  }));

test('on a landscape phone with the largest text no control covers another, and the bar is below the top row', async ({
  page,
}) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await setTextSize(page, '1.5');
  await startChapter2(page);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  expect(await controlClashes(page)).toEqual([]);
  const { bar, above } = await barAndAbove(page);
  expect(bar).toBeGreaterThanOrEqual(above);
});

test('on a landscape phone with the largest text the Cosmos keeps its band clear and every control in reach', async ({
  page,
}) => {
  await page.setViewportSize({ width: 915, height: 412 });
  await setTextSize(page, '1.5');
  await page.goto('/?chapter=9');
  await page.getByRole('button', { name: 'Begin' }).click();
  const bet = page.getByRole('dialog', { name: 'A bet' });
  await expect(bet).toBeVisible({ timeout: 20_000 });
  await bet.getByRole('button').first().click();
  await expect(bet).toBeHidden({ timeout: 20_000 });
  await page.getByRole('application', { name: 'The meadow' }).focus();
  await page.keyboard.press('z');
  const panel = page.getByRole('region', { name: 'Who is friends with whom' });
  await expect(panel.getByLabel('Rewind')).toBeAttached();
  await expect(page.getByText('Village size and trust this chapter')).toBeVisible();
  expect(await controlClashes(page)).toEqual([]);
  // The band, where the canvas draws the timeline, stays clear of the bar.
  const { bar, above } = await barAndAbove(page);
  expect(bar).toBeGreaterThanOrEqual(above);
  const controls = [
    panel.locator('summary'),
    panel.getByRole('list', { name: 'Creatures here' }),
    panel.getByLabel('Rewind'),
    panel.getByRole('button', { name: 'Back to now' }),
  ];
  for (const control of controls) {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport({ ratio: 0.99 });
  }
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
  const width = viewport.width;

  /** The box of the first element `selector` finds, or null. */
  const box = (page: Page, selector: string) =>
    page.evaluate((s) => {
      const r = document.querySelector(s)?.getBoundingClientRect();
      return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
    }, selector);
  /**
   * The visible buttons, inputs, and status lines that the canvas covers or that cover it, by
   * name; the page's own sr-only text has no size.
   */
  const overlaps = (page: Page) =>
    page.evaluate(() => {
      const c = document.querySelector('canvas')?.getBoundingClientRect();
      if (!c) return ['no canvas'];
      const hit: string[] = [];
      // The scene itself is the canvas's box; every other control, focusable region, and status line counts.
      const things = 'button, input, summary, [tabindex="0"]:not([role="application"]), [role="status"]';
      for (const el of document.querySelectorAll(things)) {
        const r = el.getBoundingClientRect();
        // Folded content (a closed panel) is not shown, though it has a box.
        if (r.width <= 1 || r.height <= 1 || !el.checkVisibility({ visibilityProperty: true })) continue;
        const w = Math.min(r.right, c.right) - Math.max(r.left, c.left);
        const h = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
        if (w > 0.5 && h > 0.5)
          hit.push(
            `${el.tagName} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}`,
          );
      }
      return hit;
    });
  /** Whether the button named `name` is what a tap at its middle reaches. */
  const reachable = (page: Page, name: string) =>
    page.evaluate((n) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === n);
      const r = b?.getBoundingClientRect();
      if (!b || !r) return false;
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('button') === b;
    }, name);
  const noSidewaysScroll = async (page: Page) => {
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fits).toBe(true);
  };

  test('the scene ends above the tools, and the page never scrolls sideways', async ({ page }) => {
    await startGame(page);
    await expect(page.getByRole('group', { name: 'Tools' })).toBeVisible();
    const canvas = await box(page, 'canvas');
    const tray = await box(page, '[aria-label="Tools"]');
    expect(canvas).not.toBeNull();
    expect(tray).not.toBeNull();
    expect(canvas?.bottom).toBeLessThanOrEqual((tray?.top ?? 0) + 0.5);
    // The canvas has drawn at its new size, not the window's.
    await expect
      .poll(() => page.evaluate(() => document.querySelector('canvas')?.getBoundingClientRect().height))
      .toBeLessThan(await page.evaluate(() => window.innerHeight));
    await noSidewaysScroll(page);
  });

  test('in the game no button, field, or status line is over the canvas, and Pause and 1x can be tapped', async ({
    page,
  }) => {
    await startGame(page);
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    expect(await overlaps(page)).toEqual([]);
    expect(await reachable(page, 'Pause')).toBe(true);
    expect(await reachable(page, '1×')).toBe(true);
    // The story lines scroll in a strip of a fixed height inside the bottom bar, under the canvas.
    const beat = await box(page, '.beat-line');
    const canvas = await box(page, 'canvas');
    expect(beat?.top).toBeGreaterThanOrEqual((canvas?.bottom ?? 0) - 1);
    expect(
      await page.evaluate(() => getComputedStyle(document.querySelector('.beat-line') as Element).height),
    ).toBe('96px');
  });

  test('in the sandbox no button, field, or status line is over the canvas, and Pause and 1x can be tapped', async ({
    page,
  }) => {
    await startSandbox(page);
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    expect(await overlaps(page)).toEqual([]);
    expect(await reachable(page, 'Pause')).toBe(true);
    expect(await reachable(page, '1×')).toBe(true);
    const canvas = await box(page, 'canvas');
    expect(canvas?.bottom).toBeGreaterThan(200);
  });

  test('an open drawer sheet keeps Tab inside it', async ({ page }) => {
    await startGame(page);
    await page.getByRole('button', { name: 'Diary and notes' }).tap();
    await expect(page.locator('#drawer-panel')).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await focusOutside(page, '#drawer-panel')).toBeNull();
    }
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusOutside(page, '#drawer-panel')).toBeNull();
    }
    // The page behind the sheet is inert, and Escape closes the sheet and gives the button focus back.
    expect(
      await page.evaluate(() => document.querySelector('[role="application"]')?.closest('[inert]') !== null),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#drawer-panel')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Diary and notes' })).toBeFocused();
  });

  test('an open sandbox panel sheet keeps Tab inside it, and Close gives focus back', async ({ page }) => {
    await startSandbox(page);
    await page.getByText('Weather', { exact: true }).tap();
    const panel = page.locator('details[open]');
    await expect(panel).toBeVisible();
    // The sheet traps Tab from its toggle event, which comes a task after the panel opens.
    await expect(page.locator('details:not([open])').first()).toHaveAttribute('inert', '');
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      expect(await focusOutside(page, 'details[open]')).toBeNull();
    }
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusOutside(page, 'details[open]')).toBeNull();
    }
    expect(
      await page.evaluate(() => document.querySelector('[role="application"]')?.closest('[inert]') !== null),
    ).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('details[open]')).toHaveCount(0);
    await expect(page.getByText('Weather', { exact: true })).toBeFocused();
  });

  test('in the Cosmos view the panel is in the bottom bar, and nothing is over the canvas', async ({
    page,
  }) => {
    await page.goto('/?chapter=9');
    await page.getByRole('button', { name: 'Begin' }).click();
    // On a phone the opening bet card appears at once.
    const bet = page.getByRole('dialog', { name: 'A bet' });
    await expect(bet).toBeVisible({ timeout: 20_000 });
    await bet.getByRole('button').first().tap();
    await expect(bet).toBeHidden({ timeout: 20_000 });
    const scene = page.getByRole('application', { name: 'The meadow' });
    await scene.focus();
    await page.keyboard.press('z');
    const panel = page.getByRole('region', { name: 'Who is friends with whom' });
    await expect(panel.getByRole('listitem').first()).toBeVisible();
    await expect(panel.getByLabel('Rewind')).toBeVisible();
    expect(await overlaps(page)).toEqual([]);
    const bar = await box(page, '.bottom');
    const cosmos = await box(page, '[aria-labelledby="cosmos-title"]');
    expect(cosmos?.top).toBeGreaterThanOrEqual((bar?.top ?? 0) - 1);
    await noSidewaysScroll(page);
  });

  test('a beat with several lines shows all of them in the story strip, newest in view', async ({ page }) => {
    await page.goto('/?chapter=2');
    await page.getByRole('button', { name: 'Begin' }).click();
    const lines = page.locator('.beat-line p');
    await expect.poll(() => lines.count()).toBeGreaterThanOrEqual(3);
    const strip = page.getByRole('group', { name: 'Story lines' });
    await expect(strip).toHaveAttribute('tabindex', '0');
    // The newest line is in view as it arrives, and each older one scrolls into view.
    const inside = (i: number) =>
      page.evaluate((n) => {
        const box = document.querySelector('.beat-line')?.getBoundingClientRect();
        const r = document.querySelectorAll('.beat-line p')[n]?.getBoundingClientRect();
        return !!box && !!r && r.top >= box.top - 1 && r.bottom <= box.bottom + 1;
      }, i);
    const count = await lines.count();
    expect(await inside(count - 1)).toBe(true);
    for (let i = 0; i < count; i++) {
      await lines.nth(i).scrollIntoViewIfNeeded();
      expect(await inside(i)).toBe(true);
      await expect(lines.nth(i)).not.toHaveCSS('display', 'none');
    }
  });

  test('at 360x640 with the largest text every sandbox control can be scrolled to', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await startSandbox(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '150%';
    });
    // What does not fit is reached by the player's own scrolling, not only by a script.
    const scrolls = await page.evaluate(() => {
      const column = document.querySelector('.sandbox') as HTMLElement;
      return (
        column.scrollHeight <= column.clientHeight ||
        ['auto', 'scroll'].includes(getComputedStyle(column).overflowY)
      );
    });
    expect(scrolls).toBe(true);
    for (const name of ['Population', 'Rules', 'Weather', 'Network']) {
      const summary = page.getByText(name, { exact: true });
      await summary.scrollIntoViewIfNeeded();
      await expect(summary).toBeInViewport({ ratio: 1 });
    }
    const status = page.getByRole('status').filter({ hasText: /^Tool: / });
    await status.scrollIntoViewIfNeeded();
    await expect(status).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'Pause' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeInViewport({ ratio: 1 });
    await noSidewaysScroll(page);
  });

  test('on a wide portrait screen two open panels leave the scene a usable height', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await startSandbox(page);
    await page.getByText('Population', { exact: true }).click();
    await page.getByText('Network', { exact: true }).click();
    await expect(page.locator('details.panel[open]')).toHaveCount(2);
    for (const panel of await page.locator('details.panel[open]').all()) {
      const h = (await panel.boundingBox())?.height ?? 0;
      expect(h).toBeLessThanOrEqual(1024 * 0.4 + 1);
    }
    // At least 12rem, the scene's own minimum.
    const canvas = await box(page, 'canvas');
    expect((canvas?.bottom ?? 0) - (canvas?.top ?? 0)).toBeGreaterThanOrEqual(190);
    expect(await overlaps(page)).toEqual([]);
  });

  test('on a wide portrait screen the open drawer is clear of the story lines', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await startGame(page);
    await expect(page.locator('[aria-live="polite"]')).toContainText('The dawn');
    await page.getByRole('button', { name: 'Diary and notes' }).click();
    await expect(page.locator('#drawer-panel')).toBeVisible();
    const strip = await box(page, '.beat-line');
    const drawer = await box(page, '#drawer-panel');
    expect(strip?.right).toBeLessThanOrEqual((drawer?.left ?? 0) + 0.5);
  });

  /**
   * The canvas is at least 12rem tall, nothing is over it, and every control of the top row and the
   * bottom bar can be scrolled to and seen.
   */
  async function expectUsablePortraitGame(page: Page) {
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const canvas = await box(page, 'canvas');
    expect((canvas?.bottom ?? 0) - (canvas?.top ?? 0)).toBeGreaterThanOrEqual(12 * rem - 1);
    expect(await overlaps(page)).toEqual([]);
    const scrolls = await page.evaluate(() => {
      const bar = document.querySelector('.bottom') as HTMLElement;
      return (
        bar.scrollHeight <= bar.clientHeight || ['auto', 'scroll'].includes(getComputedStyle(bar).overflowY)
      );
    });
    expect(scrolls).toBe(true);
    const controls = page.locator(
      '.top button, .bottom button, .bottom input, .bottom summary, .bottom [tabindex="0"]',
    );
    // Handles, not indexes: the story strip joins the tab order only while its lines overflow.
    for (const control of await controls.elementHandles()) {
      if (!(await control.evaluate((el) => (el as Element).checkVisibility()))) continue;
      await control.scrollIntoViewIfNeeded();
      const seen = await control.evaluate((el) => {
        const r = (el as Element).getBoundingClientRect();
        return (
          r.top >= -0.5 && r.left >= -0.5 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5
        );
      });
      expect(seen).toBe(true);
    }
    await noSidewaysScroll(page);
  }

  test('at 360x640 with the largest text the meadow keeps a 12rem canvas and reaches every control', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await setTextSize(page, '1.5');
    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeAttached();
    await expectUsablePortraitGame(page);
  });

  test('at 360x640 with the largest text the Cosmos keeps a 12rem canvas and reaches every control', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await setTextSize(page, '1.5');
    await page.goto('/?chapter=9');
    await page.getByRole('button', { name: 'Begin' }).click();
    const bet = page.getByRole('dialog', { name: 'A bet' });
    await expect(bet).toBeVisible({ timeout: 20_000 });
    await bet.getByRole('button').first().tap();
    await expect(bet).toBeHidden({ timeout: 20_000 });
    await page.getByRole('application', { name: 'The meadow' }).focus();
    await page.keyboard.press('z');
    const panel = page.getByRole('region', { name: 'Who is friends with whom' });
    await expect(panel.getByLabel('Rewind')).toBeAttached();
    await expectUsablePortraitGame(page);
    for (const name of ['Rewind', 'Back to now']) {
      const control = name === 'Rewind' ? panel.getByLabel('Rewind') : panel.getByRole('button', { name });
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport({ ratio: 0.99 });
    }
  });

  test('in portrait the chapter 2 intro shows all of its lines in the story strip', async ({ page }) => {
    await expectAllLines(page);
  });

  test('the type is Atkinson Hyperlegible', async ({ page }) => {
    await startGame(page);
    await expect
      .poll(() => page.evaluate(() => document.fonts.check('16px "Atkinson Hyperlegible"')))
      .toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
      'Atkinson Hyperlegible',
    );
  });

  test('the drawer is a full-width sheet', async ({ page }) => {
    await startGame(page);
    await page.getByRole('button', { name: 'Diary and notes' }).tap();
    await expect(page.locator('#drawer-panel')).toBeVisible();
    const sheet = await box(page, '#drawer-panel');
    expect(sheet?.left).toBe(0);
    expect(sheet?.right).toBe(width);
    expect(sheet?.bottom).toBe(viewport.height);
    await noSidewaysScroll(page);
  });

  test('the game has no serious axe issues, also with the help sheet open', async ({ page }) => {
    await startGame(page);
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'How to play' });
    await expect(help).toBeVisible();
    const sheet = await box(page, '[role="dialog"]');
    expect(sheet?.left).toBe(0);
    expect(sheet?.right).toBe(width);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('the journal is a full-width sheet with no serious axe issues', async ({ page }) => {
    await startFen(page);
    await page.keyboard.press('j');
    const journal = page.getByRole('dialog', { name: 'Travel journal' });
    await expect(journal).toBeVisible();
    const sheet = await box(page, '[role="dialog"]');
    expect(sheet?.left).toBe(0);
    expect(sheet?.right).toBe(width);
    await noSidewaysScroll(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('the sandbox has no serious axe issues, and an open panel is a full-width sheet', async ({ page }) => {
    await startSandbox(page);
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByText('Weather', { exact: true }).tap();
    const panel = page.locator('details[open]');
    await expect(panel).toBeVisible();
    const sheet = await box(page, 'details[open]');
    expect(sheet?.left).toBe(0);
    expect(sheet?.right).toBe(width);
    expect(sheet?.top).toBe(0);
    expect(sheet?.bottom).toBe(viewport.height);
    await noSidewaysScroll(page);
    expect(await seriousViolations(page)).toEqual([]);
    await panel.getByRole('button', { name: 'Close' }).tap();
    await expect(panel).toHaveCount(0);
    await expect(page.getByText('Weather', { exact: true })).toBeFocused();
  });
});
