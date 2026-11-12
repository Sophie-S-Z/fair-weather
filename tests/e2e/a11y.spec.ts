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

test('the whisper card has no serious axe issues, takes focus, Escape cancels it, and Kind sends it', async ({
  page,
}) => {
  // ch5 (index 7) teaches whisper; Tab picks a creature once the first snapshot is in (the first line).
  await page.goto('/?chapter=7');
  await page.getByRole('button', { name: 'Begin' }).click();
  const scene = page.getByRole('application', { name: 'The meadow' });
  await expect(scene).toBeFocused();
  await expect(page.locator('[aria-live="polite"]')).toContainText('Late summer');
  const picked = page.getByRole('status').filter({ hasText: /^Picked: / });
  for (let i = 0; i < 40 && !(await picked.isVisible()); i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const card = page.getByRole('dialog', { name: 'Whisper about whom?' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('button').first()).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);
  await card.getByRole('button').first().click();
  await expect(card.getByRole('button', { name: 'Unkind' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Kind', exact: true })).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
  await expect(scene).toBeFocused();
  // Again, and this time whisper: Kind sends it, and the card closes with focus back on the scene.
  await page.keyboard.press('Enter');
  await card.getByRole('button').first().click();
  await card.getByRole('button', { name: 'Kind', exact: true }).click();
  await expect(card).toBeHidden();
  await expect(scene).toBeFocused();
});

test('the game screen in high contrast has no serious axe issues', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('High contrast').check();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 0' })).toBeVisible();
  await page.getByRole('button', { name: 'Diary and notes' }).click();
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

test('the Cosmos view with its panel has no serious axe issues', async ({ page }) => {
  // ch6 (index 9) has zoom, peek, and rewind.
  await page.goto('/?chapter=9');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
  await page.keyboard.press('z');
  const panel = page.getByRole('region', { name: 'Who is friends with whom' });
  await expect(panel.getByRole('listitem').first()).toContainText(/: \d+ friends?, \d+ scars?/);
  await expect(panel).toContainText(/This chapter: population \d+/);
  await expect(panel.getByLabel('Rewind')).toBeVisible();
  // The timeline strip has a visible label in the band above the valley.
  await expect(page.getByText('Village size and trust this chapter')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('on a phone the Cosmos band has a row of its own, clear of the title, the drawer, and the panel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?chapter=9');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
  await page.keyboard.press('z');
  const label = page.getByText('Village size and trust this chapter');
  await expect(label).toBeVisible();
  const box = async (l: ReturnType<Page['locator']>) => {
    const b = await l.boundingBox();
    if (!b) throw new Error('not laid out');
    return b;
  };
  const band = await box(label.locator('..'));
  const meets = (a: typeof band, b: typeof band): boolean =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  expect(meets(band, await box(page.getByRole('heading', { level: 1 })))).toBe(false);
  expect(meets(band, await box(page.getByRole('button', { name: 'Diary and notes' })))).toBe(false);
  expect(meets(band, await box(page.getByRole('region', { name: 'Who is friends with whom' })))).toBe(false);
});

test('the Soul view opens the drawer at the diary; P opens it at Under the hood; no serious axe issues', async ({
  page,
}) => {
  await page.goto('/?chapter=9');
  await page.getByRole('button', { name: 'Begin' }).click();
  // ch6 opens its bet at tick 1; answer it, and the scene has focus again.
  await page.getByRole('dialog', { name: 'A bet' }).getByRole('button').first().click();
  await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
  // Respond, so the status line names the pick (the fog tool names the spot).
  await page.keyboard.press('1');
  const picked = page.getByRole('status').filter({ hasText: /^Picked: / });
  for (let i = 0; i < 40 && !(await picked.isVisible()); i++) await page.keyboard.press('Tab');
  await page.keyboard.press('x');
  const diary = page.getByRole('region', { name: /^Diary: / });
  await expect(diary).toBeVisible();
  await expect(diary).toContainText('Friends:');
  await expect(diary).toContainText('Scars:');
  // The drawer opened without taking focus from the scene.
  await expect(page.getByRole('application', { name: 'The Soul view' })).toBeFocused();
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press('p');
  const hood = page.getByRole('region', { name: 'Under the hood' });
  await expect(hood).toBeFocused();
  await expect(hood).toContainText(/forgives \d+ slights?/);
  expect(await seriousViolations(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(hood).toBeHidden();
  await expect(page.getByRole('application', { name: 'The Soul view' })).toBeFocused();
});
