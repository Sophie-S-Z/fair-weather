import { describe, expect, test } from 'vitest';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import type { SimEvent } from '../../../src/sim/types.ts';
import { checkTwist } from '../../../src/story/twists.ts';

const lite = (averageWarmth: number, friendPairs: number): WorldLite => ({
  creatures: [],
  light: null,
  fog: { w: 0, h: 0, cells: new Float32Array(0) },
  metrics: { averageWarmth, friendPairs },
  structures: [],
});
const gift = (from: string, to: string, move: 'give' | 'keep'): SimEvent => ({
  t: 'gift',
  from,
  to,
  move,
  seenAs: move,
});

describe('kritExploitsPim', () => {
  const w = lite(0, 0);
  test('true when Pim gives to Krit and Krit keeps', () => {
    expect(
      checkTwist('kritExploitsPim', w, w, [gift('pim', 'krit', 'give'), gift('krit', 'pim', 'keep')]),
    ).toBe(true);
  });
  test('false when Krit gives back', () => {
    expect(
      checkTwist('kritExploitsPim', w, w, [gift('pim', 'krit', 'give'), gift('krit', 'pim', 'give')]),
    ).toBe(false);
  });
  test('false when Pim keeps, or the pair differs, or no events', () => {
    expect(
      checkTwist('kritExploitsPim', w, w, [gift('pim', 'krit', 'keep'), gift('krit', 'pim', 'keep')]),
    ).toBe(false);
    expect(
      checkTwist('kritExploitsPim', w, w, [gift('pim', 'echo', 'give'), gift('krit', 'echo', 'keep')]),
    ).toBe(false);
    expect(checkTwist('kritExploitsPim', w, w, [])).toBe(false);
  });
});

describe('benchWarmsVillage', () => {
  test('true at the exact thresholds', () => {
    expect(checkTwist('benchWarmsVillage', lite(0.2, 1), lite(0.4, 4), [])).toBe(true);
  });
  test('false when friend pairs rise by only 2', () => {
    expect(checkTwist('benchWarmsVillage', lite(0.2, 1), lite(0.5, 3), [])).toBe(false);
  });
  test('false when warmth rises by under 0.1', () => {
    expect(checkTwist('benchWarmsVillage', lite(0.2, 1), lite(0.29, 5), [])).toBe(false);
  });
});
