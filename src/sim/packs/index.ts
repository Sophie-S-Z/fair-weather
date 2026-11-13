// Rule packs (ADR 0013 item 4): one per valley, on only with the scenario's `pack`. A pack's state
// lives in `World.pack`, so hashing, checkpoints, and rewind keep it. A pack changes the meeting
// rules only through canMeet, giftCost, and giftWarmth; for a world without a pack each gives the
// plain rule, and nothing here draws.
import type { Creature, LocalVerb, PackId, PackState, SimEvent, World } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';
import { fen, flies } from './fen.ts';

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

export const PACKS: Record<PackId, RulePack> = { fen };

/** Whether `a` and `b` may meet: in Murmuration Fen a flying creature meets no one (ADR 0013 item 5). */
export function canMeet(world: World, a: Creature, b: Creature): boolean {
  return !flies(world, a) && !flies(world, b);
}

/** What a gift costs the giver: gift.cost in the Fen and without a pack. */
export function giftCost(world: World, t: Tuning): number {
  return t.gift.cost;
}

/** The warmth a received gift is worth: warmth.giftReceived in the Fen and without a pack. */
export function giftWarmth(world: World, t: Tuning): number {
  return t.warmth.giftReceived;
}
