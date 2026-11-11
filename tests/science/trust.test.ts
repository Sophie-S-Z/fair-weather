import { describe, expect, test } from 'vitest';
import { createRng } from '../../src/sim/rng.ts';
import { playMatch, runTournament, type Strategy } from '../../src/sim/trust-mode.ts';

const MIX: Record<Strategy, number> = {
  copycat: 3,
  copykitten: 3,
  alwaysGive: 3,
  alwaysKeep: 4,
  grudger: 3,
  detective: 3,
  simpleton: 3,
  random: 3,
};
const population = (Object.keys(MIX) as Strategy[]).flatMap((s) => Array<Strategy>(MIX[s]).fill(s));

/** Fraction of seeds 1..50 whose winner is `who`. */
function share(cfg: { noise: number; rounds: number }, who: Strategy): number {
  let wins = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const r = runTournament({ population, generations: 50, cut: 5, seed, ...cfg });
    if (r.winner === who) wins++;
  }
  return wins / 50;
}

// ADR 0006 option A: the cut points move with the starting population (MIX above).
describe('T4 trust mode', () => {
  test.each([1, 3, 5, 7, 9])('copykitten wins at %s% noise in at least 70% of seeds', (n) => {
    expect(share({ noise: n / 100, rounds: 10 }, 'copykitten')).toBeGreaterThanOrEqual(0.7);
  });
  test.each([30, 40])('always-keep wins at %s% noise in at least 90% of seeds', (n) => {
    expect(share({ noise: n / 100, rounds: 10 }, 'alwaysKeep')).toBeGreaterThanOrEqual(0.9);
  });
  test.each([1, 2])('always-keep wins with %i rounds in at least 90% of seeds', (r) => {
    expect(share({ noise: 0.05, rounds: r }, 'alwaysKeep')).toBeGreaterThanOrEqual(0.9);
  });
  test('always-keep wins in 0 of 50 seeds at 0% noise', () => {
    expect(share({ noise: 0, rounds: 10 }, 'alwaysKeep')).toBe(0);
  });
  test('the same seed gives the same result', () => {
    const cfg = { population, rounds: 10, noise: 0.05, generations: 50, cut: 5, seed: 7 };
    expect(runTournament(cfg)).toEqual(runTournament(cfg));
  });
});

describe('trust strategies', () => {
  const play = (sa: Strategy, sb: Strategy) => {
    const a = new Uint8Array(5);
    const b = new Uint8Array(5);
    const scores = playMatch(sa, sb, 5, 0, createRng(1).next, a, b);
    return { a: a.join(''), b: b.join(''), scores };
  };
  // 1 = give, 0 = keep; [against alwaysGive, against alwaysKeep].
  const MOVES: [Strategy, string, string][] = [
    ['copycat', '11111', '10000'],
    ['copykitten', '11111', '11000'],
    ['alwaysGive', '11111', '11111'],
    ['alwaysKeep', '00000', '00000'],
    ['grudger', '11111', '10000'],
    ['detective', '10110', '10110'],
    ['simpleton', '11111', '10101'],
  ];
  test.each(MOVES)('%s plays as expected against always-give and always-keep', (s, vsGive, vsKeep) => {
    expect(play(s, 'alwaysGive').a).toBe(vsGive);
    expect(play(s, 'alwaysKeep').a).toBe(vsKeep);
  });
  test('give costs 1 and the receiver gets 3', () => {
    expect(play('alwaysGive', 'alwaysGive').scores).toEqual([10, 10]);
    expect(play('alwaysGive', 'alwaysKeep').scores).toEqual([-5, 15]);
  });
  test('counts sum to the population size', () => {
    const r = runTournament({ population, rounds: 10, noise: 0.05, generations: 50, cut: 5, seed: 3 });
    expect(Object.values(r.counts).reduce((x, y) => x + y, 0)).toBe(population.length);
  });
});
