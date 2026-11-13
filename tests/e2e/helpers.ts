// Helpers the e2e specs share. They read the screen in one page.evaluate where they can: locator
// actions wait on animation frames, which software rendering (CI with no GPU) draws two or three
// times a second, and at ?fast=10 a sky bid's 6 s reply window is only 0.6 s of real time.
import { expect, type Page } from '@playwright/test';

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
