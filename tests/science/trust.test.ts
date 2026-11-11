import { describe, expect, test } from 'vitest';
import { runTournament, type Strategy } from '../../src/sim/trust-mode.ts';

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
  test.each([0.01, 0.03, 0.05, 0.07, 0.09])('copykitten wins at %f noise in at least 70% of seeds', (n) => {
    expect(share({ noise: n, rounds: 10 }, 'copykitten')).toBeGreaterThanOrEqual(0.7);
  });
  test.each([0.3, 0.4])('always-keep wins at %f noise in at least 90% of seeds', (n) => {
    expect(share({ noise: n, rounds: 10 }, 'alwaysKeep')).toBeGreaterThanOrEqual(0.9);
  });
  test.each([1, 2])('always-keep wins with %i rounds in at least 90% of seeds', (r) => {
    expect(share({ noise: 0.05, rounds: r }, 'alwaysKeep')).toBeGreaterThanOrEqual(0.9);
  });
  test('the same seed gives the same result', () => {
    const cfg = { population, rounds: 10, noise: 0.05, generations: 50, cut: 5, seed: 7 };
    expect(runTournament(cfg)).toEqual(runTournament(cfg));
  });
});
