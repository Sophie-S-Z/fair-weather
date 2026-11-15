// M4.19: the help sheet, the phone layout, and the bundled type (ADR 0014 items 14 and 15).
import AxeBuilder from '@axe-core/playwright';
import { devices, expect, test, type Page } from '@playwright/test';

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}
const speeds = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: { speeds: number[] } }).fairWeather.speeds.at(-1));

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
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { fairWeather: { sandbox(): unknown } }).fairWeather.sandbox() !== null,
      ),
    )
    .toBe(true);
  return scene;
}
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
    await expect.poll(() => speeds(page)).toBe(1);
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Keys' });
    await expect(help).toBeVisible();
    await expect(help.getByRole('heading', { name: 'Keys' })).toBeFocused();
    await expect(help.getByRole('row', { name: /Tab Move to the next creature/ })).toBeVisible();
    await expect(help.getByRole('row', { name: /J, B Journal, Book of Skies/ })).toBeVisible();
    await expect(help.getByRole('row', { name: /^P / })).toBeVisible();
    await expect(help.getByRole('row', { name: /^1 to 8 / })).toHaveCount(0);
    await expect.poll(() => speeds(page)).toBe(0);
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
    await expect(scene).toBeFocused();
    await expect.poll(() => speeds(page)).toBe(1);
  });

  test('Close gives focus back, and Tab stays inside the sheet', async ({ page }) => {
    const scene = await startGame(page);
    await page.keyboard.press('?');
    const help = page.getByRole('dialog', { name: 'Keys' });
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
    const help = page.getByRole('dialog', { name: 'Keys' });
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
