// Rule packs (ADR 0013 item 4): one per valley, on only with the scenario's `pack`. A pack's state
// lives in `World.pack`, so hashing, checkpoints, and rewind keep it. A pack changes the meeting
// rules only through canMeet, giftCost, and giftWarmth; for a world without a pack each gives the
// plain rule, and nothing here draws.
import type { Creature, LocalVerb, PackId, PackState, SimEvent, World } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';
import { fen, flies } from './fen.ts';
import { halcyon } from './halcyon.ts';
import { hollow, keepsDistance } from './hollow.ts';

export type { LocalVerb } from '../types.ts';

/**
 * A valley's rules (ADR 0013 item 4). `setup` runs once in createWorld, `step` after the dance
 * spread and before light sky warmth with the tick's events so far, `onVerb` for each `local`
 * command, and `metrics` gives the numbers the story reads.
 */
export interface RulePack<S extends PackState = PackState> {
  id: S['id'];
  setup(world: World, t: Tuning, rng: Rng): void;
  step(world: World, events: readonly SimEvent[], t: Tuning, rng: Rng): SimEvent[];
  onVerb(world: World, verb: LocalVerb, t: Tuning, rng: Rng): SimEvent[];
  metrics(world: World, t: Tuning): Record<string, number>;
}

export const PACKS: Record<PackId, RulePack> = { fen, hollow, halcyon };

/**
 * Whether `a` and `b` may meet: in Murmuration Fen a flying creature meets no one (ADR 0013 item 5),
 * and in Hearsay Hollow a creature with fame above hollow.fearAt meets no local (item 6).
 */
export function canMeet(world: World, a: Creature, b: Creature, t: Tuning): boolean {
  return !flies(world, a) && !flies(world, b) && !keepsDistance(world, a, b, t);
}

/** What a gift costs the giver: 0 in Halcyon (ADR 0013 item 7), else gift.cost. */
export function giftCost(world: World, t: Tuning): number {
  return world.pack?.id === 'halcyon' ? 0 : t.gift.cost;
}

/**
 * The warmth a received gift is worth: warmth.giftReceived, × halcyon.giftWarmthMultiplier in
 * Halcyon (ADR 0013 item 7).
 */
export function giftWarmth(world: World, t: Tuning): number {
  const k = world.pack?.id === 'halcyon' ? t.halcyon.giftWarmthMultiplier : 1;
  return t.warmth.giftReceived * k;
}
