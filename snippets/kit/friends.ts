// The new friends: six creatures that live only in the snippets, outside the toybox cast.
// Each one has a body drawing in content/creatures, a look, and a short temper.
import drift from '../../content/rigs/drift.rig.json';
import dollop from '../../content/rigs/dollop.rig.json';
import hush from '../../content/rigs/hush.rig.json';
import nib from '../../content/rigs/nib.rig.json';
import sprig from '../../content/rigs/sprig.rig.json';
import tuck from '../../content/rigs/tuck.rig.json';
import { creature, type Look } from './draw.ts';

const calm = { tightness: 0, bristle: 0, color: 0.2, softness: 0.3 };

export const drawDrift = creature(drift, {
  tint: 0xf7f5ff,
  scale: 1,
  rest: { ...calm, softness: 0.9 },
} satisfies Look);
export const drawDollop = creature(dollop, { tint: 0xf6c4d2, scale: 1, rest: { ...calm, softness: 0.8 } });
export const drawNib = creature(nib, { tint: 0xd7d0c8, scale: 1, rest: { ...calm, softness: 0.5 } });
export const drawHush = creature(hush, { tint: 0xe3dcf5, scale: 1, rest: { ...calm, softness: 0.6 } });
export const drawSprig = creature(sprig, { tint: 0xf6e7a1, scale: 1, rest: { ...calm, softness: 0.5 } });
export const drawTuck = creature(tuck, { tint: 0xd9a982, scale: 1, rest: { ...calm, bristle: 0.15 } });
