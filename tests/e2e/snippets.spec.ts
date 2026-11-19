import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

const share = join(import.meta.dirname, '../../snippets/share');
const files = readdirSync(share).filter((f) => f.endsWith('.html'));

for (const file of files) {
  test(`snippet ${file} plays from the file with no errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${pathToFileURL(join(share, file)).href}?t=1`);
    const canvas = page.getByRole('img');
    await expect(canvas).toHaveAccessibleName(/\w+/);
    await expect(page.getByRole('button', { name: 'Save GIF' })).toBeVisible();
    // The canvas holds a drawing, not one flat color.
    const colors = await canvas.evaluate((c: HTMLCanvasElement) => {
      const data = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data ?? [];
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4 * 97)
        seen.add(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0));
      return seen.size;
    });
    expect(colors).toBeGreaterThan(5);
    expect(errors).toEqual([]);
  });
}

test('Save GIF downloads a GIF that the browser can decode to the end', async ({ page }) => {
  await page.goto(pathToFileURL(join(share, 'cookie-standoff.html')).href);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save GIF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('cookie-standoff.gif');
  const path = await download.path();
  const { readFileSync } = await import('node:fs');
  const base64 = readFileSync(path).toString('base64');
  // The caption band is paper. A broken LZW stream would garble these bottom rows.
  const pixel = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = `data:image/gif;base64,${src}`;
    await img.decode();
    const c = document.createElement('canvas');
    [c.width, c.height] = [img.naturalWidth, img.naturalHeight];
    const ctx = c.getContext('2d');
    ctx?.drawImage(img, 0, 0);
    return {
      w: img.naturalWidth,
      h: img.naturalHeight,
      px: [...(ctx?.getImageData(5, 355, 1, 1).data ?? [])],
    };
  }, base64);
  expect(pixel.w).toBe(480);
  expect(pixel.h).toBe(360);
  expect(pixel.px.slice(0, 3)).toEqual([255, 253, 248]);
  await expect(page.getByRole('status')).toHaveText('GIF saved.');
});

test('a carousel steps one slide per tap, Next, or arrow key', async ({ page }) => {
  await page.goto(pathToFileURL(join(share, 'somebody-should.html')).href);
  const status = page.getByRole('status');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(status).toHaveText('Slide 2 of 9');
  await page.getByRole('img').click();
  await expect(status).toHaveText('Slide 3 of 9');
  await page.getByRole('img').press('ArrowLeft');
  await expect(status).toHaveText('Slide 2 of 9');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(status).toHaveText('Slide 9 of 9');
});

test('a clip turns its sound on and off', async ({ page }) => {
  await page.goto(pathToFileURL(join(share, 'inch-deadline.html')).href);
  const sound = page.getByRole('button', { name: 'Sound on' });
  await sound.click();
  await expect(page.getByRole('button', { name: 'Sound off' })).toBeVisible();
});
