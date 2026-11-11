// The shared signature of every daily rule (ADR 0004 item 1).
import type { SimEvent, World } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';

/** One daily rule. Rules that take no draws ignore `rng`. */
export type DailyRule = (world: World, t: Tuning, rng: Rng) => SimEvent[];
