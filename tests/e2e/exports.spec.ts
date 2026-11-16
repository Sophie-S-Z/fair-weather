// The postcard GIF (plan task M4.13, ADR 0014 item 8): the sandbox keeps the frames of the last 5
// seconds, and Save the postcard encodes them under a caption band, with the sim paused, as a
// download. The browser's own ImageDecoder reads the GIF back.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { captures, frames, lastSpeed, openNew, speeds } from './helpers.ts';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Make a postcard' });
const caption = (page: Page) => dialog(page).getByLabel('Caption (at most 60 characters)');
const EXPORT_LINE = 'The image shows the words that you wrote. It stays on this device until you share it.';

/** Opens a new Kith valley at 2x and waits until the scene drew some frames, which the ring keeps. */
async function openAtTwo(page: Page): Promise<void> {
  await openNew(page);
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
  await openAtTwo(page);
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
  await openAtTwo(page);
  await page.getByRole('button', { name: 'Make a postcard' }).click();
  const kept = `${'a'.repeat(59)}👍🏽`;
  await caption(page).fill(`${kept}${'b'.repeat(10)}`);
  await expect(caption(page)).toHaveValue(kept);
});

test('the caption is cut only when an input method ends its composition', async ({ page }) => {
  await openAtTwo(page);
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
  await openAtTwo(page);
  await expect.poll(() => captures(page)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Back to title' }).click();
  await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
  const kept = await captures(page);
  await page.waitForTimeout(500);
  expect(await captures(page)).toBe(kept);
});

test('a postcard that cannot be made says so once, and the game goes on', async ({ page }) => {
  await openAtTwo(page);
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

test('a face that does not load leaves the fallback font, and the postcard still downloads', async ({
  page,
}) => {
  await page.addInitScript(() => {
    FontFaceSet.prototype.load = () => Promise.reject(new DOMException('No face', 'NetworkError'));
  });
  await openAtTwo(page);
  await page.getByRole('button', { name: 'Make a postcard' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog(page).getByRole('button', { name: 'Save the postcard' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('fair-weather-postcard.gif');
  await expect(dialog(page).getByRole('status')).toHaveText('');
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
    const gif = (
      window as unknown as {
        fairWeather: {
          encodeGif(
            frames: { width: number; height: number; data: Uint8ClampedArray; delayMs: number }[],
          ): Uint8Array;
        };
      }
    ).fairWeather.encodeGif(want);
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

// Pages as PNG (plan task M4.14, ADR 0014 item 8): a journal page and a Book of Skies year page,
// drawn on the device into a 1080-pixel canvas and saved as a download.

/** The PNG's width and height from its IHDR chunk, after the 8-byte signature. */
function pngSize(path: string): { signature: string; width: number; height: number } {
  const png = readFileSync(path);
  return {
    signature: png.subarray(0, 8).toString('hex'),
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}
const PNG_SIGNATURE = '89504e470d0a1a0a';

/** Starts the Fen, writes its journal page with the dev journey hook, and opens the journal at it. */
async function openFenPage(page: Page) {
  await page.goto('/?chapter=16');
  await page.getByRole('button', { name: 'Begin' }).click();
  await page.getByRole('button', { name: /^Wake as / }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Murmuration Fen' })).toBeVisible();
  await expect(page.getByRole('application', { name: 'The meadow' })).toBeFocused();
  // The dev journey hook writes the Fen's page without playing the valley.
  await page.evaluate(() => {
    const j = (
      window as unknown as {
        fairWeather: { journey: () => { pages: unknown[]; keepsakes: unknown[] } | null };
      }
    ).fairWeather.journey();
    if (!j) throw new Error('no journey');
    j.pages = [
      {
        valley: 'fen',
        stamp: 'welcomed',
        said: { value: 0.8, strength: 0.9 },
        keepsake: 'starling-feather',
        postcard: null,
        caption: '',
      },
    ];
    j.keepsakes = [{ id: 'starling-feather', given: false }];
  });
  await page.keyboard.press('j');
  return page
    .getByRole('dialog', { name: 'Travel journal' })
    .getByRole('article', { name: 'Murmuration Fen' });
}

/** Saves the Fen's page and checks that the download is a 1080-wide PNG with that name. */
async function saveFenPage(page: Page, fen: Locator): Promise<void> {
  const save = fen.getByRole('button', { name: 'Save this page as an image' });
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
  expect(download.suggestedFilename()).toBe('fair-weather-journal-fen.png');
  const size = pngSize(await download.path());
  expect(size.signature).toBe(PNG_SIGNATURE);
  expect(size.width).toBe(1080);
  expect(size.height).toBeGreaterThan(1080);
  await expect(save).toBeEnabled();
  await expect(fen.getByRole('status')).toHaveText('');
}

test('Save this page as an image downloads a 1080-wide PNG of a journal page', async ({ page }) => {
  const fen = await openFenPage(page);
  const save = fen.getByRole('button', { name: 'Save this page as an image' });
  await expect(save).toHaveAccessibleDescription(EXPORT_LINE);
  await fen.getByRole('textbox', { name: 'Your line' }).fill('Rain on the reeds');
  await saveFenPage(page, fen);
});

test('a drawing that does not load is tried three times, then its scene still once, then left out, and the page still downloads', async ({
  page,
}) => {
  // The waits run on the page clock, so the test names them without waiting for them.
  await page.clock.install();
  // Every try fails where the export reads it, as a broken or missing file does.
  await page.addInitScript(() => {
    const w = window as unknown as { tried: string[] };
    w.tried = [];
    HTMLImageElement.prototype.decode = function (this: HTMLImageElement) {
      w.tried.push(this.getAttribute('src') ?? '');
      return Promise.reject(new DOMException('No image', 'EncodingError'));
    };
  });
  const fen = await openFenPage(page);
  const tried = () => page.evaluate(() => (window as unknown as { tried: string[] }).tried);
  const advance = expect
    .poll(async () => {
      await page.clock.runFor(500);
      return (await tried()).length;
    })
    .toBe(4);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    fen.getByRole('button', { name: 'Save this page as an image' }).click(),
    advance,
  ]);
  const order = await tried();
  // The drawing and its two retries, then the Fen's still image, once; nothing after.
  expect(order).toHaveLength(4);
  expect(order[1]).toBe(`${order[0] ?? ''}${order[0]?.includes('?') ? '&' : '?'}retry=1`);
  expect(order[2]).toBe(`${order[0] ?? ''}${order[0]?.includes('?') ? '&' : '?'}retry=2`);
  expect(order[0]).toMatch(/journal\/fen\.svg/);
  expect(order[3]).toMatch(/stills\/fen\.svg$/);
  const size = pngSize(await download.path());
  expect(size.signature).toBe(PNG_SIGNATURE);
  expect(size.width).toBe(1080);
  await expect(fen.getByRole('button', { name: 'Save this page as an image' })).toBeEnabled();
});

test('a face that does not load leaves the fallback font, and the page still downloads', async ({ page }) => {
  // As FontFaceSet.load does when a declared face fails to fetch.
  await page.addInitScript(() => {
    FontFaceSet.prototype.load = () => Promise.reject(new DOMException('No face', 'NetworkError'));
  });
  const fen = await openFenPage(page);
  await saveFenPage(page, fen);
});

test('Save this page as an image downloads a 1080-wide PNG of a Book of Skies year, in the game and on the title', async ({
  page,
}) => {
  // The sky story at the fire writes year 1's page.
  await page.goto('/?chapter=15');
  await page.getByRole('button', { name: 'Begin' }).click();
  const scroll = page.getByRole('region', { name: /^The Sky Story, told by \S/ });
  await expect(scroll.getByRole('button', { name: 'Listen' })).toBeFocused();
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'The Bridge' })).toBeVisible();
  await page.getByRole('button', { name: 'Diary and notes' }).click();
  await page.getByRole('button', { name: 'Book of Skies' }).click();
  const year = page.getByRole('dialog', { name: 'Book of Skies' }).getByRole('article', { name: 'Year 1' });
  for (const where of [year, page.getByRole('article', { name: 'Year 1' })]) {
    const save = where.getByRole('button', { name: 'Save this page as an image' });
    await expect(save).toHaveAccessibleDescription(EXPORT_LINE);
    const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
    expect(download.suggestedFilename()).toBe('fair-weather-year-1.png');
    const size = pngSize(await download.path());
    expect(size.signature).toBe(PNG_SIGNATURE);
    expect(size.width).toBe(1080);
    // On the title next.
    if (where === year) {
      await page.goto('/');
      await page.getByRole('button', { name: 'Book of Skies' }).click();
    }
  }
});
