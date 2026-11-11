// Test helpers for sim unit tests.
import type { Rng } from '../../../src/sim/rng.ts';
import tuningJson from '../../../content/tuning.json';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { Tuning } from '../../../src/sim/tuning.ts';
import type { Creature, Dials, Scenario, World } from '../../../src/sim/types.ts';
import { byId, createWorld, ensureTie, side } from '../../../src/sim/world.ts';

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

export const tuning: Tuning = parseTuning(tuningJson);

export type CreatureSpec = { id: string; x?: number; y?: number; berries?: number } & Partial<Dials>;

/** A world with the given creatures (dials 0.5 unless set), no bushes, and no structures. */
export function makeWorld(specs: CreatureSpec[], over: Partial<Scenario> = {}): World {
  return createWorld(1, tuning, {
    valleyId: 'kith',
    season: 'spring',
    creatures: specs.map(({ id, x, y, berries, ...dials }) => ({
      id,
      speciesId: 'kith',
      name: id,
      x: x ?? 800,
      y: y ?? 450,
      berries: berries ?? 3,
      dials: { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5, ...dials },
    })),
    bushes: [],
    structures: [],
    ...over,
  });
}

/** The creature with `id`; throws when it is missing. */
export function get(world: World, id: string): Creature {
  const c = byId(world, id);
  if (!c) throw new Error(`no creature ${id}`);
  return c;
}

/** Sets how `from` feels about `to`, creating the tie (other side 0) when needed. */
export function setWarmth(world: World, from: string, to: string, warmth: number): void {
  const tie = ensureTie(world, get(world, from), get(world, to), tuning);
  side(tie, from).warmth = warmth;
}

/** Makes `a` and `b` friends of each other at `warmth` (default 0.5). */
export function befriend(world: World, a: string, b: string, warmth = 0.5): void {
  setWarmth(world, a, b, warmth);
  setWarmth(world, b, a, warmth);
}

/** True when any number reachable from `x` is NaN or infinite. */
export function hasBadNumber(x: unknown): boolean {
  if (typeof x === 'number') return !Number.isFinite(x);
  if (x instanceof Map) return [...x.values()].some(hasBadNumber);
  if (ArrayBuffer.isView(x)) return Array.from(x as Float32Array).some((v) => !Number.isFinite(v));
  if (Array.isArray(x)) return x.some(hasBadNumber);
  if (x !== null && typeof x === 'object') return Object.values(x).some(hasBadNumber);
  return false;
}
