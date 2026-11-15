// What the Meadow dev pages share: the art loaded from content/ and the commands that set up the
// brook (two bridges, a lantern, the mushroom) and the sandbox's two paths.
import { CastSchema, type Cast } from '../src/render/cast.ts';
import { RigSchema, type Rig } from '../src/render/line/rig.ts';
import { PaletteSchema, type Palette } from '../src/render/palette.ts';
import type { Command } from '../src/sim/types.ts';

const rigFiles = import.meta.glob<unknown>('../content/rigs/*.rig.json', { eager: true, import: 'default' });
export const rigs = new Map<string, Rig>(
  Object.values(rigFiles).map((json) => {
    const rig = RigSchema.parse(json);
    return [rig.id, rig];
  }),
);
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
