import { expect, test } from '@playwright/test';

// Partial slice checks (M1.8). ?chapter=N starts at chapter N in dev builds only.

test('Begin starts chapter 0 and its first line is in the beat line', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await expect(page.locator('[aria-live="polite"]')).toContainText('The dawn touches the meadow');
  await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
});

test('the bet card takes focus, keeps it, ignores Escape, and gives it back', async ({ page }) => {
  await page.goto('/?chapter=2');
  await page.getByRole('button', { name: 'Begin' }).click();
  const scene = page.getByRole('application', { name: 'The meadow' });
  await expect(scene).toBeFocused();
  await page.getByRole('button', { name: '2×' }).click();
  await scene.focus();
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
  await expect(scene).toBeFocused();
});

test('a hidden tab sets speed 0 and a visible one restores it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  const speeds = () =>
    page.evaluate(() => (window as unknown as { fairWeather: { speeds: number[] } }).fairWeather.speeds);
  await expect.poll(speeds).toEqual([1]);
  const setVisibility = (state: string) =>
    page.evaluate((s) => {
      Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, state);
  await setVisibility('hidden');
  expect(await speeds()).toEqual([1, 0]);
  await setVisibility('visible');
  expect(await speeds()).toEqual([1, 0, 1]);
});
