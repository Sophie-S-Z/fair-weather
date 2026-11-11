// Test helpers for sim unit tests.
import type { Rng } from '../../../src/sim/rng.ts';

/** An Rng that returns the given draws in order and throws when they run out. */
export function scriptedRng(draws: readonly number[]): Rng & { used: () => number } {
  let i = 0;
  const next = (): number => {
    if (i >= draws.length) throw new Error(`scriptedRng ran out after ${String(draws.length)} draws`);
    return draws[i++] as number;
  };
  const int = (n: number): number => Math.floor(next() * n);
  return {
    next,
    int,
    pick: <T>(xs: readonly T[]): T => xs[int(xs.length)] as T,
    state: () => i,
    used: () => i,
  };
}
