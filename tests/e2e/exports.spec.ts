// The postcard GIF (plan task M4.13, ADR 0014 item 8): the sandbox keeps the frames of the last 5
// seconds, and Save the postcard encodes them under a caption band, with the sim paused, as a
// download. The browser's own ImageDecoder reads the GIF back.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type Dev = {
  sandbox(): unknown;
  frames: number;
  captures: number;
  speeds: number[];
  encodeGif(
    frames: { width: number; height: number; data: Uint8ClampedArray; delayMs: number }[],
  ): Uint8Array;
};
const running = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: Dev }).fairWeather.sandbox() !== null);
const speeds = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: Dev }).fairWeather.speeds);
const frames = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: Dev }).fairWeather.frames);
const captures = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: Dev }).fairWeather.captures);
const lastSpeed = (page: Page) =>
  page.evaluate(() => (window as unknown as { fairWeather: Dev }).fairWeather.speeds.at(-1));
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Make a postcard' });
const caption = (page: Page) => dialog(page).getByLabel('Caption (at most 60 characters)');
const EXPORT_LINE = 'The image shows the words that you wrote. It stays on this device until you share it.';

/** Opens a new Kith valley at 2x and waits until the scene drew some frames, which the ring keeps. */
async function openNew(page: Page): Promise<void> {
  await page.goto('/?sandbox=new&seed=7');
  await expect(page.getByRole('heading', { name: 'Sandbox: A new valley' })).toBeVisible();
  await expect.poll(() => running(page)).toBe(true);
  await page.getByRole('group', { name: 'Time' }).getByRole('button', { name: '2×' }).click();
  await expect.poll(() => lastSpeed(page)).toBe(2);
  const drawn = await frames(page);
  await expect.poll(() => frames(page)).toBeGreaterThan(drawn + 3);
}

/**
 * The GIF in `base64` as the page's ImageDecoder reads it: its size, its frame count, how many
 * colors the scene above the band has in the last frame, the band's first pixel, and how many of
 * the band's pixels are dark like the ink #1f2a33.
 */
const readGif = (page: Page, base64: string) =>
  page.evaluate(async (b64) => {
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const decoder = new ImageDecoder({ data, type: 'image/gif' });
    await decoder.tracks.ready;
    await decoder.completed;
    const count = decoder.tracks.selectedTrack?.frameCount ?? 0;
    // The newest frame: the oldest can be from before the valley's first snapshot.
    const { image } = await decoder.decode({ frameIndex: Math.max(0, count - 1) });
    const width = image.displayWidth;
    const height = image.displayHeight;
    const ctx = new OffscreenCanvas(width, height).getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    ctx.drawImage(image, 0, 0);
    image.close();
    const px = ctx.getImageData(0, 0, width, height).data;
    const colors = new Set<number>();
    for (let o = 0; o < width * (height - 48) * 4; o += 4)
      colors.add(((px[o] ?? 0) << 16) | ((px[o + 1] ?? 0) << 8) | (px[o + 2] ?? 0));
    const band = (height - 48) * width * 4 + 4 * 2;
    let ink = 0;
    for (let o = (height - 48) * width * 4; o < px.length; o += 4)
      if ((px[o] ?? 0) + (px[o + 1] ?? 0) + (px[o + 2] ?? 0) < 300) ink += 1;
    return {
      width,
      height,
      count,
      sceneColors: colors.size,
      band: [px[band], px[band + 1], px[band + 2]],
      ink,
    };
  }, base64);

test('Save the postcard downloads a 480 x 318 GIF of the scene, with the sim paused, and the speed back after', async ({
  page,
}) => {
  await openNew(page);
  await page.getByRole('button', { name: 'Make a postcard' }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(caption(page)).toBeFocused();
  await expect(dialog(page)).toContainText(EXPORT_LINE);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

  await caption(page).fill('Pim and Bell at the bench');
  const before = (await speeds(page)).length;
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog(page).getByRole('button', { name: 'Save the postcard' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('fair-weather-postcard.gif');
  // Paused while it encoded, then back at 2x.
  await expect.poll(async () => (await speeds(page)).slice(before)).toEqual([0, 2]);

  const gif = readFileSync(await download.path());
  expect(gif.subarray(0, 6).toString('latin1')).toBe('GIF89a');
  const read = await readGif(page, gif.toString('base64'));
  expect(read).toMatchObject({ width: 480, height: 318 });
  expect(read.count).toBeGreaterThanOrEqual(1);
  // The WebGL frame was captured, not a blank buffer: the scene has many colors.
  expect(read.sceneColors).toBeGreaterThan(8);
  // The band is the paper #f6f1e7 as its 15-bit color.
  expect(read.band).toEqual([247, 247, 231]);
  // The caption is drawn in the band, in ink.
  expect(read.ink).toBeGreaterThan(50);

  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Make a postcard' })).toBeFocused();
});

test('a 70-character caption keeps 60 characters; an emoji counts as one', async ({ page }) => {
  await openNew(page);
  await page.getByRole('button', { name: 'Make a postcard' }).click();
  const kept = `${'a'.repeat(59)}👍🏽`;
  await caption(page).fill(`${kept}${'b'.repeat(10)}`);
  await expect(caption(page)).toHaveValue(kept);
});

test('the caption is cut only when an input method ends its composition', async ({ page }) => {
  await openNew(page);
  await page.getByRole('button', { name: 'Make a postcard' }).click();
  const long = 'c'.repeat(70);
  // An input method types: while it composes, the text it has so far stays as it is.
  await caption(page).evaluate((el: HTMLInputElement, text) => {
    el.dispatchEvent(new CompositionEvent('compositionstart'));
    el.value = text;
    el.dispatchEvent(new InputEvent('input', { isComposing: true, bubbles: true }));
  }, long);
  await expect(caption(page)).toHaveValue(long);
  await caption(page).evaluate((el: HTMLInputElement) => {
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
  });
  await expect(caption(page)).toHaveValue('c'.repeat(60));
});

test('only the sandbox captures frames', async ({ page }) => {
  await page.goto('/?seed=7');
  await page.getByRole('button', { name: 'Begin' }).click();
  const drawn = await frames(page);
  await expect.poll(() => frames(page)).toBeGreaterThan(drawn + 10);
  // The story screen draws, but records nothing.
  expect(await captures(page)).toBe(0);
  await openNew(page);
  await expect.poll(() => captures(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  const kept = await captures(page);
  await page.waitForTimeout(500);
  expect(await captures(page)).toBe(kept);
});

test('a postcard that cannot be made says so once, and the game goes on', async ({ page }) => {
  await openNew(page);
  await page.getByRole('button', { name: 'Make a postcard' }).click();
  // A frame cannot be drawn under its band, so the postcard cannot be made.
  await page.evaluate(() => {
    CanvasRenderingContext2D.prototype.putImageData = () => {
      throw new Error('No pixels');
    };
  });
  await dialog(page).getByRole('button', { name: 'Save the postcard' }).click();
  await expect(dialog(page).getByRole('status')).toHaveText('The game could not make the postcard.');
  await expect.poll(() => lastSpeed(page)).toBe(2);
  await expect(dialog(page).getByRole('button', { name: 'Save the postcard' })).toBeEnabled();
  await dialog(page).getByRole('button', { name: 'Close' }).click();
  const drawn = await frames(page);
  await expect.poll(() => frames(page)).toBeGreaterThan(drawn);
});

test('the encoder output of a fixed 3-color frame set decodes to the same pixels', async ({ page }) => {
  await page.goto('/');
  const same = await page.evaluate(async () => {
    const colors = [
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
    ];
    const width = 6;
    const height = 4;
    const make = (shift: number) => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < width * height; i += 1) data.set([...(colors[(i + shift) % 3] ?? []), 255], i * 4);
      return { width, height, data, delayMs: 100 };
    };
    const want = [make(0), make(1), make(2)];
    const gif = (window as unknown as { fairWeather: Dev }).fairWeather.encodeGif(want);
    const decoder = new ImageDecoder({ data: gif, type: 'image/gif' });
    await decoder.completed;
    const got: number[][] = [];
    for (let i = 0; i < want.length; i += 1) {
      const { image } = await decoder.decode({ frameIndex: i });
      const ctx = new OffscreenCanvas(width, height).getContext('2d');
      if (!ctx) throw new Error('No 2D context');
      ctx.drawImage(image, 0, 0);
      image.close();
      got.push([...ctx.getImageData(0, 0, width, height).data]);
    }
    return {
      count: decoder.tracks.selectedTrack?.frameCount,
      same: got.every((px, i) => px.join() === [...(want[i]?.data ?? [])].join()),
    };
  });
  expect(same).toEqual({ count: 3, same: true });
});
