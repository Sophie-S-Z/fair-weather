// Helpers the e2e specs share. They read the screen in one page.evaluate where they can: locator
// actions wait on animation frames, which software rendering (CI with no GPU) draws two or three
// times a second, and at ?fast=10 a sky bid's 6 s reply window is only 0.6 s of real time.
import { expect, type Locator, type Page } from '@playwright/test';

export type Point = { x: number; y: number };
/** content/scenes/kith-meadow.json */
export const SCENE = { width: 1600, height: 900 };

/**
 * The middle of a button that may go away as the game moves on: the button under `scope` (a CSS
 * selector) whose text or name has `text`, or its last button; null when there is none.
 */
export function buttonAt(page: Page, scope: string, text?: string): Promise<Point | null> {
  return page.evaluate(
    ({ scope, text }) => {
      const buttons = [...(document.querySelector(scope)?.querySelectorAll('button') ?? [])];
      const named = (b: Element) =>
        b.textContent.includes(text ?? '') || (b.getAttribute('aria-label') ?? '').includes(text ?? '');
      const b = text === undefined ? buttons.at(-1) : buttons.find(named);
      const r = b?.getBoundingClientRect();
      return r && r.width > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
    },
    { scope, text },
  );
}

/** Clicks the middle of buttonAt at once, as a player would, and returns its text; null (and no click) when there is none. */
export async function tap(page: Page, scope: string, text?: string): Promise<string | null> {
  const at = await buttonAt(page, scope, text);
  if (!at) return null;
  const label = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent.trim() ?? '',
    at,
  );
  await page.mouse.click(at.x, at.y);
  return label;
}

/**
 * Canvas points on a grid where no HUD element is on top, nearest first to `near` (a scene point,
 * or the middle). `fit` keeps them inside the scene as the Meadow fits it (the wide shot shows the
 * whole scene); the Cosmos uses the whole canvas.
 */
export function canvasPoints(
  page: Page,
  step: number,
  near: Point | 'middle',
  fit: boolean,
): Promise<Point[]> {
  return page.evaluate(
    ({ step, near, fit, scene }) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return [];
      const r = canvas.getBoundingClientRect();
      const aspect = scene.width / scene.height;
      const w = fit ? Math.min(r.width, r.height * aspect) : r.width;
      const h = fit ? w / aspect : r.height;
      const left = r.left + (r.width - w) / 2;
      const top = r.top + (r.height - h) / 2;
      const out: { x: number; y: number }[] = [];
      for (let y = top + step / 2; y < top + h; y += step)
        for (let x = left + step / 2; x < left + w; x += step)
          if (document.elementFromPoint(x, y) === canvas) out.push({ x, y });
      const n =
        near === 'middle'
          ? { x: left + w / 2, y: top + h / 2 }
          : { x: left + (near.x / scene.width) * w, y: top + (near.y / scene.height) * h };
      return out.sort((a, b) => Math.hypot(a.x - n.x, a.y - n.y) - Math.hypot(b.x - n.x, b.y - n.y));
    },
    { step, near, fit, scene: SCENE },
  );
}

/** The creature a status line text names as picked, or null. */
export const pickedIn = (status: string): string | null => /^Picked: ([^,.]+)/.exec(status)?.[1] ?? null;

/** Presses Tab until the status line (a live region) names `name` as picked; ch0's Pim beats wait for the sim to wake Pim. */
export async function tabTo(page: Page, name: string): Promise<void> {
  const picked = async () =>
    pickedIn(await page.evaluate(() => document.querySelector('p.status')?.textContent.trim() ?? ''));
  for (let i = 0; i < 40 && (await picked()) !== name; i++) await page.keyboard.press('Tab');
  await expect.poll(picked).toBe(name);
}

/** Writes a profile with one kept year, as a finished Part 1 leaves it, and the finished `valleys`. */
export async function keepProfile(page: Page, valleys: string[]): Promise<void> {
  await page.evaluate(
    (valleys) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('fair-weather', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('saves');
        req.onerror = () => {
          reject(req.error ?? new Error('open failed'));
        };
        req.onsuccess = () => {
          const tx = req.result.transaction('saves', 'readwrite');
          const verses = [{ title: 'The Asking', text: 'A test verse.', note: null }];
          tx.objectStore('saves').put(
            { pages: [{ narrator: 'Pim', verses, year: 1, seed: 1 }], feathers: 0, valleys },
            'profile',
          );
          tx.oncomplete = () => {
            resolve();
          };
          tx.onerror = () => {
            reject(tx.error ?? new Error('put failed'));
          };
        };
      }),
    valleys,
  );
}

/**
 * The pairs of visible controls that overlap, by name. Each box is cut to the scroll boxes around it,
 * so a control scrolled out of its box counts only where it shows. While a modal dialog is open the
 * screen behind it is inert, so only the dialog's own controls count.
 */
export const controlClashes = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const things = 'button, input, select, summary, [tabindex="0"]:not([role="application"])';
    const shown = (el: Element) => {
      let r = el.getBoundingClientRect();
      let { left, top, right, bottom } = r;
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (getComputedStyle(p).overflowY === 'visible') continue;
        r = p.getBoundingClientRect();
        left = Math.max(left, r.left);
        top = Math.max(top, r.top);
        right = Math.min(right, r.right);
        bottom = Math.min(bottom, r.bottom);
      }
      return { left, top, right, bottom };
    };
    const modal = document.querySelector('[aria-modal="true"]');
    const boxes = [...document.querySelectorAll(things)]
      .filter((el) => !modal || modal.contains(el))
      .filter((el) => el.checkVisibility({ visibilityProperty: true }))
      .map((el) => ({ el, r: shown(el) }))
      .filter(({ r }) => r.right - r.left > 1 && r.bottom - r.top > 1);
    const name = (el: Element) =>
      `${el.tagName} ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}`;
    const hit: string[] = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = (boxes[i] as (typeof boxes)[number]).r;
        const b = (boxes[j] as (typeof boxes)[number]).r;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 0.5 && h > 0.5)
          hit.push(
            `${name((boxes[i] as (typeof boxes)[number]).el)} / ${name((boxes[j] as (typeof boxes)[number]).el)}`,
          );
      }
    return hit;
  });

/** Two shots of the paused scene, half a second apart; pauses it first unless it is paused already. */
export async function pausedFrames(page: Page): Promise<[Buffer, Buffer]> {
  const pause = page.getByRole('button', { name: 'Pause' });
  if ((await pause.getAttribute('aria-pressed')) !== 'true') {
    // Wait until the scene is being drawn from snapshots, so the pause holds a drawn world.
    const frames = () =>
      page.evaluate(() => (window as unknown as { fairWeather: { frames: number } }).fairWeather.frames);
    const before = await frames();
    await expect.poll(frames).toBeGreaterThan(before);
    await pause.click();
    await expect(pause).toHaveAttribute('aria-pressed', 'true');
  }
  await page.waitForTimeout(500); // the last snapshot's tween and any camera move settle
  const canvas = page.locator('canvas');
  // The scene's pixels only: the HTML over the canvas is hidden in the shot. Its tool tray shows the
  // ghost hand after 10 s of idle (spec 12.6), and on software rendering one shot takes seconds.
  const style = '* { visibility: hidden !important; } canvas { visibility: visible !important; }';
  const a = await canvas.screenshot({ style });
  await page.waitForTimeout(500);
  return [a, await canvas.screenshot({ style })];
}

/**
 * Clicks the middle of `button` once it is enabled. A locator click also waits for the element to
 * hold still across two animation frames, and software rendering (CI with no GPU) keeps the page
 * so busy that this costs about half a second; a mouse click at the box costs a third of that, and
 * still goes to whatever is on top there, so a covered button is missed, as it would be for a player.
 */
export async function press(page: Page, button: Locator): Promise<void> {
  await expect(button).toBeEnabled();
  const box = await button.boundingBox();
  if (!box) throw new Error('The button has no box to click');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
