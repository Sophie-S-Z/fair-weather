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

test.describe('the interludes, each played by keyboard alone', () => {
  /** Starts the chapter at play-order `index`; focus moves into the activity when it opens. */
  async function open(page: Page, index: number, region: string) {
    await page.goto(`/?chapter=${String(index)}`);
    await page.getByRole('button', { name: 'Begin' }).click();
    // The activity shows once the interlude's first snapshot is in.
    const activity = page.getByRole('region', { name: region });
    await expect(activity).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    return activity;
  }
  const heading = (page: Page, name: string) => page.getByRole('heading', { name: new RegExp(`^${name}:`) });

  test('The Door for Two: tap rhythms until both sides know one', async ({ page }) => {
    const activity = await open(page, 4, 'Rhythms at the door');
    // Each pattern is in the button's name as words, not only as dots.
    const first = activity.getByRole('button', { name: 'Tap rhythm 1: tap, rest, tap, rest' });
    await expect(first).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(activity.getByRole('status')).toContainText('taps it back');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(activity.getByRole('button', { name: 'Tap rhythm 3: tap, rest, tap, tap' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(heading(page, 'Chapter 4')).toBeVisible();
  });

  test('The Telephone Sketch: pass it on six times', async ({ page }) => {
    const activity = await open(page, 6, 'The sketch');
    await expect(activity.getByRole('img')).toHaveAccessibleName("Pim's first sketch");
    await expect(activity.getByRole('button', { name: 'Pass it on' })).toBeFocused();
    for (let i = 1; i <= 5; i++) {
      await page.keyboard.press('Enter');
      await expect(activity.getByRole('img')).toHaveAccessibleName(new RegExp(`copy ${String(i)} of 6$`));
    }
    expect(await seriousViolations(page)).toEqual([]);
    await page.keyboard.press('Enter');
    await expect(heading(page, 'Chapter 5')).toBeVisible();
  });

  test('Dream Bubbles from a fresh start: no grudge floats, so the player lets them sleep', async ({
    page,
  }) => {
    const activity = await open(page, 8, 'Dream bubbles');
    // A fresh start carries no ties, so no sleeper has a scar.
    await expect(activity.getByRole('button', { name: /bubble$/ })).toHaveCount(0);
    await expect(activity.getByRole('button', { name: 'Let them sleep' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(heading(page, 'Chapter 6')).toBeVisible();
  });

  test("Dream Bubbles after chapter 5: at most six bubbles; each pops but Moss's, and focus stays on them", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // Chapter 5 (index 7) runs, its bet answered, until the Cosmos panel shows Moss with a scar; its
    // skip carries the scars into the interlude.
    await page.goto('/?chapter=7&fast=8');
    await page.getByRole('button', { name: 'Begin' }).click();
    await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
    await page.getByRole('dialog', { name: 'A bet' }).getByRole('button').first().click({ timeout: 30_000 });
    await page.keyboard.press('z');
    const panel = page.getByRole('region', { name: 'Who is friends with whom' });
    await expect(panel.getByRole('listitem').filter({ hasText: /^Moss: .*, [1-9]\d* scars?/ })).toBeVisible({
      timeout: 40_000,
    });
    // Chapter 5 ends on its own when its twist fires, so the skip checks the heading in the same task.
    await page.evaluate(() => {
      if (!document.querySelector('h1')?.textContent.startsWith('Chapter 5')) return;
      const skip = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Skip chapter');
      skip?.click();
    });
    const activity = page.getByRole('region', { name: 'Dream bubbles' });
    const bubbles = activity.getByRole('button', { name: /bubble$/ });
    const moss = activity.getByRole('button', { name: "Pop Moss's bubble" });
    await expect(moss).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    // The coldest grudges float, six at most, and Moss's is one of them.
    const names = await bubbles.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
    expect(names.length).toBeLessThanOrEqual(6);
    // Focus starts on the first bubble. Each pop moves it to the bubble now in its place; Moss's
    // wobbles and stays, and Tab moves past it.
    const left = [...names];
    let at = 0;
    while (left.some((n) => n !== "Pop Moss's bubble")) {
      const name = left[at] ?? '';
      await expect(activity.getByRole('button', { name, exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      if (name === "Pop Moss's bubble") {
        await expect(activity.getByRole('status')).toHaveText(/Moss's bubble wobbles and stays/);
        await page.keyboard.press('Tab');
        at += 1;
      } else {
        left.splice(at, 1);
        at = Math.min(at, left.length - 1);
      }
    }
    // Only Moss's is left, so the interlude ends, and focus goes back to the scene.
    await expect(heading(page, 'Chapter 6')).toBeVisible();
    await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
  });

  test("Wisp's Postcard: one Enter per part traces the path", async ({ page }) => {
    const activity = await open(page, 11, "Wisp's path");
    await expect(activity).toContainText('Wisp writes:');
    await expect(activity.getByRole('button', { name: 'Trace the next part' })).toBeFocused();
    await page.keyboard.press('Enter');
    // The status speaks in quarter steps only.
    await expect(activity.getByRole('status')).toHaveText(/^(0|25|50|75)% of the path traced$/);
    expect(await seriousViolations(page)).toEqual([]);
    const next = heading(page, 'Chapter 8');
    for (let i = 0; i < 10 && !(await next.isVisible()); i++) await page.keyboard.press('Enter');
    await expect(next).toBeVisible();
  });

  test('The Long Night: five still seconds end it; the meter has a label and a value', async ({ page }) => {
    const activity = await open(page, 13, 'Hold still');
    await expect(activity.getByLabel('Stillness')).toBeVisible();
    await expect(activity).toContainText(/[0-5] of 5 seconds/);
    await expect(heading(page, 'Chapter 9')).toBeVisible({ timeout: 15_000 });
  });

  test('The Long Night waits while the game is paused', async ({ page }) => {
    const activity = await open(page, 13, 'Hold still');
    // The pause button, by pointer, so no key press resets the count.
    await page.getByRole('button', { name: 'Pause' }).click();
    const count = activity.getByText(/of 5 seconds$/);
    const before = await count.textContent();
    await page.waitForTimeout(6_000);
    await expect(activity).toBeVisible();
    await expect(count).toHaveText(before ?? '');
  });
});

test('the fire: Listen five times tells five verses and ends Part 1; no serious axe issues', async ({
  page,
}) => {
  // Chapter 10 is index 15 in play order.
  await page.goto('/?chapter=15');
  await page.getByRole('button', { name: 'Begin' }).click();
  const scroll = page.getByRole('region', { name: /^The Sky Story, told by \S/ });
  await expect(scroll).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  // Focus moves to Listen when the story opens.
  await expect(scroll.getByRole('button', { name: 'Listen' })).toBeFocused();
  const verse = scroll.locator('[aria-live="polite"]');
  const titles = ['The Waking', "The Sky's Eye", "The Sky's Moods", 'The Long Winter'];
  for (const title of titles) {
    await page.keyboard.press('Enter');
    await expect(verse.getByRole('heading', { name: title })).toBeVisible();
  }
  await page.keyboard.press('Enter');
  const end = page.getByRole('heading', { name: 'End of the year so far' });
  await expect(end).toBeFocused();
  // The end page keeps the whole story, the last verse too.
  const told = page.getByRole('region', { name: /^The Sky Story, told by \S/ });
  for (const title of [...titles, 'The Asking'])
    await expect(told.getByRole('heading', { name: title })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('the myth tells only this year: five gusts show behind a toggle, and the next year does not count them', async ({
  page,
}) => {
  test.setTimeout(90_000);
  /** Skips from chapter 7 to the fire. */
  const skipToFire = async () => {
    for (const name of [
      "Interlude: Wisp's Postcard",
      'Chapter 8',
      'Interlude: The Long Night',
      'Chapter 9',
      'Chapter 10',
    ]) {
      await page.getByRole('button', { name: 'Skip chapter' }).click();
      await expect(page.getByRole('heading', { name: new RegExp(`^${name}`) })).toBeVisible();
    }
  };
  const scroll = page.getByRole('region', { name: /^The Sky Story, told by \S/ });
  const listen = scroll.getByRole('button', { name: 'Listen' });
  const moods = scroll.locator('[aria-live="polite"]');

  // Year one: chapter 7 (index 10) teaches the wind; its tool is picked, and the arrows aim the gust.
  await page.goto('/?chapter=10');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
  await expect(
    page.getByRole('group', { name: 'Tools' }).getByRole('button', { name: /Wind/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.beat-line')).toContainText('The autumn wind'); // the runner takes verbs after a snapshot
  await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Enter');
  await skipToFire();
  for (let i = 0; i < 3; i++) await listen.click();
  await expect(moods).toContainText('The sky huffed at us 5 times');
  const toggle = scroll.getByRole('button', { name: 'What the sky did' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(scroll.getByText(/You blew 5 gusts/)).toBeHidden();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(scroll.getByText(/You blew 5 gusts/)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  // Year two in the same visit, with no gusts: its myth does not tell year one's.
  await listen.click();
  await listen.click();
  await page.getByRole('button', { name: 'Back to title' }).click();
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(page.getByRole('heading', { name: /^Chapter 7/ })).toBeVisible();
  await skipToFire();
  for (let i = 0; i < 3; i++) await listen.click();
  await expect(moods.getByRole('heading', { name: "The Sky's Moods" })).toBeVisible();
  await expect(moods).not.toContainText('huffed');
});
