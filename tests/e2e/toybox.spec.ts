import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const creature = (page: Page, name: string): Locator =>
  page.getByRole('button', { name: new RegExp(`^${name},`) });

async function centerOf(l: Locator): Promise<[number, number]> {
  const box = await l.boundingBox();
  if (!box) throw new Error('not visible');
  return [box.x + box.width / 2, box.y + box.height / 2];
}

/** Drags a creature by its button so its foot lands at a screen point. */
async function drag(page: Page, who: Locator, to: [number, number]): Promise<void> {
  const box = await who.boundingBox();
  if (!box) throw new Error('not visible');
  const [x, y] = [box.x + box.width / 2, box.y + box.height - 4];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 10, { steps: 2 });
  await page.mouse.move(to[0], to[1], { steps: 8 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(creature(page, 'Krit')).toBeVisible();
});

test('a creature stuck in the puddle with a crowd near earns a sticker that stays after a reload', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Puddle' }).click();
  const puddle = page.locator('.overlay').getByRole('button', { name: 'Puddle' });
  await drag(page, creature(page, 'Pim'), await centerOf(puddle));
  await expect(creature(page, 'Pim')).toHaveAccessibleName(/stuck/);
  await expect(page.getByRole('status').getByText('Somebody should')).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: 'test-results/sticker.png' });
  await expect(page.getByRole('button', { name: /Sticker book 1 of 12/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /Sticker book 1 of 12/ })).toBeVisible();
});

test('the book shows twelve riddles, and a found page plays its loops', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('fair-weather.stickers', '["standoff"]');
  });
  await page.reload();
  await page.getByRole('button', { name: /Sticker book/ }).click();
  const book = page.getByRole('dialog');
  await expect(book.getByText(/^Riddle:|Not found yet/)).toHaveCount(11);
  await book.getByRole('button', { name: 'The cookie standoff' }).click();
  await expect(book.getByRole('heading', { name: 'The cookie standoff' })).toBeVisible();
  await expect(book.locator('canvas')).toHaveCount(3);
  await book.getByRole('radio', { name: 'Pim' }).check();
  await expect(book.locator('canvas')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(book).toBeHidden();
});

test('keyboard play: lift, carry, drop, and poke', async ({ page }) => {
  const pim = creature(page, 'Pim');
  await pim.focus();
  await page.keyboard.press('Enter');
  await expect(creature(page, 'Pim')).toHaveAccessibleName(/held/);
  const before = await centerOf(pim);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(creature(page, 'Pim')).not.toHaveAccessibleName(/held/);
  const after = await centerOf(pim);
  expect(after[0]).toBeGreaterThan(before[0]);
  await page.keyboard.press(' ');
});

test('the yarn ties two creatures and the scissors cut them', async ({ page }) => {
  await page.getByRole('radio', { name: 'Yarn' }).click();
  await creature(page, 'Pim').click();
  await expect(page.getByText(/Now pick a second creature/)).toBeVisible();
  await creature(page, 'Krit').click();
  await expect(creature(page, 'Pim')).toHaveAccessibleName(/tied to Krit/);
  await page.getByRole('radio', { name: 'Scissors' }).click();
  await creature(page, 'Krit').click();
  await creature(page, 'Pim').click();
  await expect(creature(page, 'Pim')).not.toHaveAccessibleName(/tied/);
});

test('has no axe violations on the table or in the book', async ({ page }) => {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: /Sticker book/ }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
