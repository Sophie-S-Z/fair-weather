import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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
