import { expect, test } from 'vitest';
import pimJson from '../../../content/rigs/PLACEHOLDER-pim.rig.json';
import { bodyColor, crossing, fillOutline } from '../../../src/render/line/fill.ts';
import { RigSchema } from '../../../src/render/line/rig.ts';

/** True when any two non-adjacent segments of the open outline cross. */
function selfCrosses(p: number[]): boolean {
  const v = (i: number): number => p[i] ?? 0;
  for (let a = 0; a + 3 < p.length; a += 2) {
    for (let b = a + 4; b + 3 < p.length; b += 2) {
      if (crossing(v(a), v(a + 1), v(a + 2), v(a + 3), v(b), v(b + 1), v(b + 2), v(b + 3))) return true;
    }
  }
  return false;
}

test('fillOutline cuts a curl out of a line and keeps the crossing point', () => {
  // A line that runs right, loops up and back down across itself, then runs on to (4, -1).
  const line = [0, 0, 3, 0, 3, 1, 1, 1, 1, -1, 4, -1];
  // Segment (1,1)-(1,-1) crosses (0,0)-(3,0) at (1,0): the loop between is dropped.
  expect(fillOutline(line)).toEqual([0, 0, 1, 0, 1, -1, 4, -1]);
});

test('fillOutline leaves a line that never crosses itself unchanged', () => {
  const line = [0, 0, 1, 0, 2, 1, 3, 3];
  expect(fillOutline(line)).toEqual(line);
});

test("Pim's curl crosses itself, and the fill outline does not", () => {
  const pim = RigSchema.parse(pimJson).points;
  expect(selfCrosses(pim)).toBe(true);
  expect(selfCrosses(fillOutline(pim))).toBe(false);
});

test('bodyColor blends paper toward the accent per channel', () => {
  expect(bodyColor(0xffffff, 0x000000, 0)).toBe(0xffffff);
  expect(bodyColor(0xffffff, 0x000000, 1)).toBe(0x000000);
  expect(bodyColor(0x000000, 0xff8040, 0.5)).toBe(0x804020);
});
