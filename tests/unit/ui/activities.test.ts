import { expect, test } from 'vitest';
import {
  copySketch,
  poppable,
  RHYTHMS,
  sharedRhythm,
  traceProgress,
} from '../../../src/ui/interludes/activities.ts';

/** The summed distance, coordinate by coordinate, between two sketches. */
const apart = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((sum, v, i) => sum + Math.abs(v - (b[i] ?? 0)), 0);

test('there are four 4-beat rhythms', () => {
  expect(RHYTHMS).toHaveLength(4);
  for (const r of RHYTHMS) expect(r).toHaveLength(4);
});

test('sharedRhythm finds the one index both sides accept', () => {
  expect(sharedRhythm([0, 2], [2, 3])).toBe(2);
  expect(sharedRhythm([3, 1], [0, 1])).toBe(1);
  expect(sharedRhythm([0], [1])).toBe(-1);
});

test('copySketch drifts a little each copy, and the drift adds up', () => {
  const sketch = [10, 10, 50, 10, 50, 50, 10, 50, 30, 30, 70, 70];
  expect(copySketch(sketch, 0)).toEqual(sketch);
  expect(copySketch(sketch, 3)).toEqual(copySketch(sketch, 3));
  for (let g = 1; g <= 6; g++) {
    const before = copySketch(sketch, g - 1);
    const after = copySketch(sketch, g);
    for (let i = 0; i < sketch.length; i++)
      expect(Math.abs((after[i] ?? 0) - (before[i] ?? 0))).toBeLessThanOrEqual(3);
  }
  expect(apart(copySketch(sketch, 6), sketch)).toBeGreaterThan(apart(copySketch(sketch, 1), sketch));
});

test('traceProgress is 1 for the path itself, 0 far away, and the share in between', () => {
  const path = [0, 0, 10, 0, 20, 0, 30, 0];
  expect(traceProgress(path, path, 2)).toBe(1);
  expect(traceProgress(path, [500, 500], 2)).toBe(0);
  expect(traceProgress(path, [1, 1, 11, -1], 2)).toBe(0.5);
});

test("Moss's bubble does not pop; the others do", () => {
  expect(poppable('moss')).toBe(false);
  expect(poppable('pim')).toBe(true);
  expect(poppable('villager-3')).toBe(true);
});
