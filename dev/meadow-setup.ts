// What the Meadow dev pages share: the art loaded from content/, the commands that set up the
// brook (two bridges, a lantern, the mushroom) and the sandbox's two paths, and a draw-call count.
import type { Application } from 'pixi.js';
import { CastSchema, type Cast } from '../src/render/cast.ts';
import { PaletteSchema, type Palette } from '../src/render/palette.ts';
import type { Command } from '../src/sim/types.ts';

export { rigs } from '../src/rigs.ts';
const castFiles = import.meta.glob<unknown>('../content/cast/*.json', { eager: true, import: 'default' });
export const cast = new Map<string, Cast>(
  Object.values(castFiles).map((json) => {
    const c = CastSchema.parse(json);
    return [c.id, c];
  }),
);
const paletteFiles = import.meta.glob<unknown>('../content/palettes/*.json', {
  eager: true,
  import: 'default',
});
export const paletteFor = (id: string): Palette =>
  PaletteSchema.parse(Object.values(paletteFiles).find((json) => (json as { id: string }).id === id));

/** The brook, as chapter 9 lays it (content/chapters/ch9.json). */
export const BROOK_WATER = [{ x: 780, y: 0, w: 60, h: 900 }];
export const BROOK_MUSHROOM = { x: 1120, y: 560 };
export const BROOK_PLACEMENTS: Command[] = [
  { t: 'place', kind: 'bridge', x: 810, y: 260 },
  { t: 'place', kind: 'bridge', x: 810, y: 640 },
  { t: 'place', kind: 'lantern', x: 960, y: 820 },
];
export const SANDBOX_SETUP: Command[] = [
  { t: 'path', x: 90, y: 480, x2: 520, y2: 610 },
  { t: 'path', x: 900, y: 640, x2: 1380, y2: 380 },
  { t: 'welcome', on: false },
];

/**
 * Counts `app`'s WebGL2 draw calls, instanced ones included (Pixi 8 has no draw-call counter).
 * `calls()` gives the count since the last `reset()`.
 */
export function countDrawCalls(app: Application): { calls(): number; reset(): void } {
  const gl = (app.renderer as unknown as { gl: WebGL2RenderingContext }).gl;
  let calls = 0;
  for (const name of [
    'drawElements',
    'drawArrays',
    'drawElementsInstanced',
    'drawArraysInstanced',
  ] as const) {
    const original = gl[name].bind(gl) as (...a: unknown[]) => void;
    (gl as unknown as Record<string, unknown>)[name] = (...a: unknown[]): void => {
      calls += 1;
      original(...a);
    };
  }
  return {
    calls: () => calls,
    reset: () => {
      calls = 0;
    },
  };
}
