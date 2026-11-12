// The year carry (ADR 0012 item 1): what a `carry: true` chapter keeps from the chapter before it.
// All of it lives here, so buildScenario has one call to drop if the carry goes.
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Dials, Scenario, Shell } from '../sim/types.ts';

export interface Carry {
  creatures: { id: string; dials: Dials; shell: Shell; skyWarmth: number; away: boolean }[];
  ties: { a: string; b: string; ab: number; ba: number }[];
}

/** The carry from a chapter's last snapshot. Slights, berries, positions, and structures stay behind. */
export function carryFrom(lite: WorldLite): Carry {
  return {
    creatures: lite.creatures.map((c) => ({
      id: c.id,
      dials: { ...c.dials },
      shell: { ...c.shell },
      skyWarmth: c.skyWarmth,
      away: c.state === 'away',
    })),
    ties: lite.ties.map((t) => ({ ...t })),
  };
}

/**
 * Applies `carry` to the base creatures of `s` (a newcomer in the carry is dropped): dials, shell
 * (the sim makes it the resting shell too), sky warmth, and `away`; then every tie between two
 * base creatures, with 0 slights on both sides.
 */
export function applyCarry(s: Scenario, carry: Carry): void {
  const kept = new Map(carry.creatures.map((c) => [c.id, c]));
  for (const c of s.creatures) {
    const k = kept.get(c.id);
    if (!k) continue;
    c.dials = { ...k.dials };
    c.shell = { ...k.shell };
    c.skyWarmth = k.skyWarmth;
    if (k.away) c.state = 'away';
  }
  const ids = new Set(s.creatures.map((c) => c.id));
  s.ties = [
    ...(s.ties ?? []),
    ...carry.ties
      .filter((t) => ids.has(t.a) && ids.has(t.b))
      .map((t) => ({ a: t.a, b: t.b, ab: { warmth: t.ab, slights: 0 }, ba: { warmth: t.ba, slights: 0 } })),
  ];
}
