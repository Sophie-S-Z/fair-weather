// The one seeded PRNG for the sim: SplitMix32 (ADR 0001).
export interface Rng {
  /** Uniform in [0, 1). */
  readonly next: () => number;
  /** Integer in [0, n). */
  int(n: number): number;
  pick<T>(xs: readonly T[]): T;
  /** Current uint32 state; `createRng(r.state())` continues the same stream. */
  state(): number;
}

export function createRng(state: number): Rng {
  let s = state >>> 0;
  const next = (): number => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    z = z ^ (z >>> 16);
    return (z >>> 0) / 4294967296;
  };
  const int = (n: number): number => Math.floor(next() * n);
  const pick = <T>(xs: readonly T[]): T => {
    if (xs.length === 0) throw new Error('pick() on an empty list');
    return xs[int(xs.length)] as T;
  };
  return { next, int, pick, state: () => s };
}
