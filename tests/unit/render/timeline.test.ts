import { expect, test } from 'vitest';
import { TIMELINE_HEIGHT } from '../../../src/render/cosmos-view.ts';
import {
  friendshipBreaks,
  sampleTimeline,
  seriesRange,
  type TimelinePoint,
} from '../../../src/render/timeline.ts';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import { lite } from './lite-fixture.ts';

test('sampleTimeline adds one point per `every` ticks, with the population and the trust', () => {
  const w = lite([['pim'], ['krit'], ['wisp', 'away']], [], 0.25);
  const points: TimelinePoint[] = [];
  for (let tick = 0; tick < 50; tick++) sampleTimeline(points, tick, w, 10);
  expect(points).toEqual([0, 10, 20, 30, 40].map((tick) => ({ tick, population: 2, trust: 0.25 })));
});

test('sampleTimeline adds a point after a gap longer than `every`', () => {
  const w = lite([['pim']], []);
  const points: TimelinePoint[] = [];
  for (const tick of [0, 4, 23, 30, 33]) sampleTimeline(points, tick, w, 10);
  expect(points.map((p) => p.tick)).toEqual([0, 23, 33]);
});

test('friendshipBreaks names a pair whose friendship falls from 0.5 to 0.2', () => {
  const creatures: [string][] = [['echo'], ['krit'], ['pim']];
  const prev: WorldLite = lite(creatures, [
    ['echo', 'krit', 0.5, 0.5],
    ['echo', 'pim', 0.5, 0.5],
    ['krit', 'pim', 0.1, 0.1],
  ]);
  const next: WorldLite = lite(creatures, [
    ['echo', 'krit', 0.2, 0.5],
    ['echo', 'pim', 0.45, 0.6],
    ['krit', 'pim', 0.1, -0.5],
  ]);
  expect(friendshipBreaks(prev, next, 0.3)).toEqual([{ a: 'echo', b: 'krit' }]);
  expect(friendshipBreaks(next, prev, 0.3)).toEqual([]);
});

test('a trust change of 0.05 moves the trust line, in its half of the strip, at least 2 pixels', () => {
  const [lo, hi] = seriesRange([0.1, 0.12, 0.15], 0.2);
  expect((0.05 / (hi - lo)) * (TIMELINE_HEIGHT / 2)).toBeGreaterThanOrEqual(2);
});

test('seriesRange spans the values, padded, and widens a flat series about its middle', () => {
  const [lo, hi] = seriesRange([-0.5, 0.5], 0.2);
  expect(lo).toBeLessThan(-0.5);
  expect(hi).toBeGreaterThan(0.5);
  const [flatLo, flatHi] = seriesRange([30, 30, 30], 2);
  expect((flatLo + flatHi) / 2).toBeCloseTo(30);
  expect(flatHi - flatLo).toBeGreaterThanOrEqual(2);
});
