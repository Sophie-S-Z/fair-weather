import { expect, test } from 'vitest';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import {
  copySketch,
  dreamers,
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

type Dreamer = { id: string; state: WorldLite['creatures'][number]['state']; gone?: boolean };
/** A world of `creatures` (asleep unless said) and ties given as [a, b, ab, ba]. */
function world(creatures: Dreamer[], ties: [string, string, number, number][]) {
  return {
    creatures: creatures.map((c) => ({ id: c.id, state: c.state, gone: c.gone ?? false })),
    ties: ties.map(([a, b, ab, ba]) => ({ a, b, ab, ba })),
  };
}
const asleep = (...ids: string[]): Dreamer[] => ids.map((id) => ({ id, state: 'sleep' }));

test('dreamers: sleepers with a scar, coldest tie first, cast order on a tie', () => {
  const w = world(asleep('pim', 'krit', 'echo', 'bell'), [
    ['pim', 'krit', 0.5, -0.2],
    ['echo', 'bell', -0.6, 0.1],
    ['pim', 'bell', 0.3, 0.4],
  ]);
  // Echo and Bell share their coldest tie (-0.6), so cast order decides; Pim and Krit share -0.2.
  expect(dreamers(w)).toEqual(['echo', 'bell', 'pim', 'krit']);
});

test('dreamers: no scar, awake, or gone means no bubble; an empty valley has none', () => {
  const w = world(
    [
      { id: 'pim', state: 'sleep' },
      { id: 'krit', state: 'wander' },
      { id: 'echo', state: 'sleep', gone: true },
      ...asleep('bell'),
    ],
    [
      ['pim', 'krit', -0.5, 0.2],
      ['echo', 'bell', -0.4, 0.1],
      ['pim', 'bell', 0.3, 0.4],
    ],
  );
  expect(dreamers(w)).toEqual(['pim', 'bell']);
  expect(dreamers(world([], []))).toEqual([]);
});

test('dreamers: at most six, and Moss with a scar is always one of them, asleep or not', () => {
  const ids = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8'];
  const ties: [string, string, number, number][] = ids.map((id, i) => [id, 'x', -0.9 + i * 0.1, 0.5]);
  const w = world([...asleep(...ids), { id: 'x', state: 'wander' }], ties);
  expect(dreamers(w)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5', 'v6']);
  // Moss is awake and only a little cold, yet it takes the last place.
  const withMoss = world(
    [...asleep(...ids), { id: 'x', state: 'wander' }, { id: 'moss', state: 'wander' }],
    [...ties, ['moss', 'x', 0.2, -0.05]],
  );
  expect(dreamers(withMoss)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5', 'moss']);
  // Without a scar, Moss has no bubble.
  const warmMoss = world(
    [...asleep(...ids, 'moss'), { id: 'x', state: 'wander' }],
    [...ties, ['moss', 'x', 0.2, 0.1]],
  );
  expect(dreamers(warmMoss)).not.toContain('moss');
});
