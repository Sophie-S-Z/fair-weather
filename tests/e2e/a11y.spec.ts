import AxeBuilder from '@axe-core/playwright';
import { devices, expect, test, type Page } from '@playwright/test';

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test('title and settings screens have no serious axe issues', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('high contrast has no serious axe issues', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('High contrast').check();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('Tab reaches every enabled button in order; Enter works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Book of Skies' })).toBeDisabled();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Begin' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Settings' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  const order = [
    page.getByLabel('Text size'),
    page.getByLabel('High contrast'),
    page.getByLabel('Reduced motion'),
    page.getByLabel('Sound'),
    page.getByRole('button', { name: 'Back' }),
  ];
  for (const el of order) {
    await page.keyboard.press('Tab');
    await expect(el).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Fair Weather' })).toBeVisible();
});

test('the game screen with a bet open has no serious axe issues', async ({ page }) => {
  await page.goto('/?chapter=2');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 2' })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  // The bet opens at chapter time 0 (ch2 open_bet).
  await expect(page.getByRole('dialog', { name: 'A bet' })).toBeVisible({ timeout: 20_000 });
  expect(await seriousViolations(page)).toEqual([]);
});

test('the game screen in high contrast has no serious axe issues', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('High contrast').check();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await page.getByRole('button', { name: 'Notes' }).click();
  expect(await seriousViolations(page)).toEqual([]);
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

  test('the game screen has no serious axe issues and no Pixi accessibility hook', async ({ page }) => {
    await page.goto('/');
    expect(await seriousViolations(page)).toEqual([]);
    await page.getByRole('button', { name: 'Begin' }).tap();
    await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
    await expect(page.locator('[aria-live="polite"]')).toContainText('The dawn');
    expect(await seriousViolations(page)).toEqual([]);
    await expect(page.getByRole('button', { name: /enable accessibility/ })).toHaveCount(0);
  });
});
