import { expect, test, type Page } from '@playwright/test';

// Partial slice checks (M1.8). ?chapter=N starts at chapter N in dev builds only.

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
  await page.getByRole('button', { name: '2×' }).click();
  await scene(page).focus();
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
  await page.waitForTimeout(500); // the autosave is written a moment after the chapter starts
  await page.reload();
  const cont = page.getByRole('button', { name: 'Continue' });
  await expect(cont).toBeEnabled();
  await cont.click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await expect(live(page)).toContainText('press Enter to wake it');
});
