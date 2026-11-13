// The sim's bank (tuning `bank`, ADR 0012 item 3) holds every drawn body and its shadow: off a
// deck, feet stay `bank.side` from water to the left, right and above, and `bank.below` from water
// under them, so a body never reaches the water.
import { expect, test } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import { HIGH_CONTRAST_WIDTH } from '../../../src/render/ink.ts';
import { BOIL_AMPLITUDE, BRISTLE_AMPLITUDE } from '../../../src/render/line/deform.ts';
import { INK_WIDTH } from '../../../src/render/line/line-view.ts';
import {
  bodyHeight,
  HOP_HEIGHT,
  rigArea,
  SHADOW_HEIGHT,
  SHADOW_WIDTH,
  SWAY_ANGLE,
  VILLAGER_RIG,
} from '../../../src/render/meadow-view.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import { HERO_KINDS } from '../../../src/sim/types.ts';
import { cast, rigs } from './content-fixture.ts';

const tuning = parseTuning(tuningJson);

/**
 * How far a body drawn with its feet at the origin reaches, in scene units, at its widest: no
 * tightness or softness (both pull points in), full bristle, the largest boil, the high-contrast
 * ink line, swayed to either side about the feet, and, for `up`, hopping. With its shadow.
 */
function reach(id: string): { side: number; up: number; down: number } {
  const rig = rigs.get(id) ?? rigs.get(VILLAGER_RIG);
  const villager = rigs.get(VILLAGER_RIG);
  if (!rig || !villager) throw new Error(`no rig for ${id}`);
  const h = bodyHeight(rig, rigArea(villager), cast.get(id)?.scale ?? 1);
  // Each point may move this far on each axis, in rig units.
  const pad = BRISTLE_AMPLITUDE + BOIL_AMPLITUDE + (INK_WIDTH * HIGH_CONTRAST_WIDTH) / 2;
  const [cos, sin] = [Math.cos(SWAY_ANGLE), Math.sin(SWAY_ANGLE)];
  let side = 0;
  let up = 0;
  let down = 0;
  for (let i = 0; i + 1 < rig.points.length; i += 2) {
    const [x, y] = [Math.abs(rig.points[i] ?? 0) + pad, rig.points[i + 1] ?? 0];
    const [top, bottom] = [y + pad, y - pad];
    side = Math.max(side, x * cos + Math.max(Math.abs(top), Math.abs(bottom)) * sin);
    up = Math.max(up, top * cos + x * sin);
    down = Math.max(down, -bottom * cos + x * sin);
  }
  return {
    side: Math.max(side * h, (SHADOW_WIDTH * h) / 2),
    up: up * h + HOP_HEIGHT,
    down: Math.max(down * h, (SHADOW_HEIGHT * h) / 2),
  };
}

// The Quiet Visitor walks by the same bank (meadow-view.ts overWater), so its rig is checked too,
// and so is each hero's, which walks by Halcyon's mirror sea (ADR 0013 item 18), and the frogs' of
// Hearsay Hollow, which a valley with water may hold.
const ids = [...new Set([VILLAGER_RIG, 'visitor', ...cast.keys(), ...HERO_KINDS, 'frog'])];

test.each(ids)('%s, drawn at its widest, stays inside the bank', (id) => {
  const r = reach(id);
  expect(r.side).toBeLessThanOrEqual(tuning.bank.side);
  // Below the feet the body meets water that lies under them, whose bank above the water is
  // `bank.side` wide (`bank.below` is the bank under the water, which the body's top meets).
  expect(r.down).toBeLessThanOrEqual(tuning.bank.side);
  expect(r.up).toBeLessThanOrEqual(tuning.bank.below);
});

test('the bank is no wider than the widest body needs, to the unit', () => {
  const need = ids.map(reach);
  expect(tuning.bank.side).toBe(Math.ceil(Math.max(...need.map((r) => Math.max(r.side, r.down)))));
  expect(tuning.bank.below).toBe(Math.ceil(Math.max(...need.map((r) => r.up))));
});
