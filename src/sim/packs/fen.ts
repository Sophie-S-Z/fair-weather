// Murmuration Fen (ADR 0013 item 5): a starling flies when enough of its nearest neighbors fly, and
// the water shows each starling a share weighted toward well-connected birds (ADR 0007).
import type { Creature, FenState, World } from '../types.ts';
import { HERO } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';
import { byCodeUnit, dist2 } from '../math.ts';
import type { RulePack } from './index.ts';

/** Tove, the Fen's guide (ADR 0013 item 5); `tovePerceived` reads its perceived share. */
export const TOVE = 'tove';

/**
 * True when `c` is in flight in the Fen: a flying starling, or the hero while it has joined. The
 * hero test is hero.ts isHero, written out, since hero.ts imports packs/index.ts and importing it
 * here would make an import cycle that breaks when this file loads first.
 */
export function flies(world: World, c: Creature): boolean {
  const fen = world.pack;
  if (fen?.id !== 'fen') return false;
  if (world.hero !== undefined && c.id === HERO) return fen.heroFlying;
  // A creature with no threshold (a late arrival) never flies, though it still counts as a neighbor.
  return fen.thresholds[c.id] !== undefined && fen.flying.includes(c.id);
}

/** The starlings, not away, in creature order: the creatures with a threshold. */
function starlings(world: World, fen: FenState): Creature[] {
  return world.creatures.filter((c) => c.state !== 'away' && fen.thresholds[c.id] !== undefined);
}

/** The fen.neighbors nearest other creatures not away, by distance and then id. */
function neighbors(world: World, c: Creature, t: Tuning): Creature[] {
  return world.creatures
    .filter((o) => o !== c && o.state !== 'away')
    .map((o) => ({ o, d: dist2(c.x, c.y, o.x, o.y) }))
    .sort((p, q) => p.d - q.d || byCodeUnit(p.o.id, q.o.id))
    .slice(0, t.fen.neighbors)
    .map(({ o }) => o);
}

/** The share of `near` in flight; 0 with no one near. */
function flyingShare(world: World, near: Creature[]): number {
  return near.length === 0 ? 0 : near.filter((o) => flies(world, o)).length / near.length;
}

/**
 * Each starling's perceived share (ADR 0007): the sum of `degree` over its flying neighbors over
 * the sum over all its neighbors, where a creature's degree is the number of starlings that list
 * it among their nearest. 0 with no neighbors. Empty without a Fen.
 */
export function perceivedShares(world: World, t: Tuning): Record<string, number> {
  const fen = world.pack;
  if (fen?.id !== 'fen') return {};
  const lists = starlings(world, fen).map((c) => ({ c, near: neighbors(world, c, t) }));
  const degree = new Map<string, number>();
  for (const { near } of lists) for (const o of near) degree.set(o.id, (degree.get(o.id) ?? 0) + 1);
  const out: Record<string, number> = {};
  for (const { c, near } of lists) {
    let all = 0;
    let up = 0;
    for (const o of near) {
      const d = degree.get(o.id) ?? 0;
      all += d;
      if (flies(world, o)) up += d;
    }
    out[c.id] = all === 0 ? 0 : up / all;
  }
  return out;
}

export const fen: RulePack = {
  id: 'fen',

  /**
   * Each starling without a fixed threshold draws one, fen.thresholdMin + fen.thresholdSpan × the
   * draw (0.3 to 0.8, ADR 0013 item 16), one draw each in creature
   * order; the restless starlings fly. Thresholds and restless ids name starlings only.
   */
  setup(world: World, t: Tuning, rng: Rng): void {
    const state = world.pack;
    if (state?.id !== 'fen') return;
    const thresholds: Record<string, number> = {};
    for (const c of world.creatures) {
      if (c.speciesId !== 'starling') continue;
      thresholds[c.id] = state.thresholds[c.id] ?? t.fen.thresholdMin + t.fen.thresholdSpan * rng.next();
    }
    state.thresholds = thresholds;
    state.restless = world.creatures
      .filter((c) => thresholds[c.id] !== undefined && state.restless.includes(c.id))
      .map((c) => c.id);
    state.flying = [...state.restless];
  },

  /**
   * At dawn every starling but the restless lands. Then, every fen.everyTicks ticks, each grounded
   * starling flies when the share of its neighbors in flight, counted before this call, reaches its
   * threshold, less fen.duskLift from fen.duskAt of the day. No draws, no events.
   */
  step(world: World, events, t: Tuning) {
    const state = world.pack;
    if (state?.id !== 'fen') return [];
    const dayTick = world.tick % world.ticksPerDay;
    if (dayTick === 0) state.flying = state.flying.filter((id) => state.restless.includes(id));
    if (world.tick % t.fen.everyTicks !== 0) return [];
    const lift = dayTick >= t.fen.duskAt * world.ticksPerDay ? t.fen.duskLift : 0;
    const rising = starlings(world, state).filter(
      (c) =>
        !state.flying.includes(c.id) &&
        flyingShare(world, neighbors(world, c, t)) >= (state.thresholds[c.id] ?? 1) - lift,
    );
    const up = new Set([...state.flying, ...rising.map((c) => c.id)]);
    state.flying = world.creatures.filter((c) => up.has(c.id)).map((c) => c.id);
    return [];
  },

  /** `join` sets the hero flying or grounded; `pose` and `keepsake` do nothing here. No draws. */
  onVerb(world: World, verb) {
    if (verb.verb === 'join' && world.pack?.id === 'fen' && world.hero && typeof verb.on === 'boolean') {
      world.pack.heroFlying = verb.on;
    }
    return [];
  },

  /** The share of starlings in flight, and Tove's perceived share; 0 for each when there is none. */
  metrics(world: World, t: Tuning) {
    const state = world.pack;
    const birds = state?.id === 'fen' ? starlings(world, state) : [];
    return {
      flyingShare: flyingShare(world, birds),
      tovePerceived: perceivedShares(world, t)[TOVE] ?? 0,
    };
  },
};
