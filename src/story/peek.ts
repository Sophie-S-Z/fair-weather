// Peek under the hood (spec 8): the payoff table and the rule a creature plays by, from spec 9.3.
import type { Dials, Season } from '../sim/types.ts';
import { tuning } from './tuning.ts';

/** A number with at most one decimal, so 15.5 stays 15.5 and 30 stays 30. */
const short = (n: number): string => String(Math.round(n * 10) / 10);

/**
 * The gift payoff this season, and three lines with the creature's own numbers: how often it gives
 * at a first meeting (its Opener), how many remembered slights it forgives before it keeps
 * (`round(3 × Forgiveness)`), and how long a slight takes to fade by half (`1 + 29 × Memory` days).
 */
export function peekRule(
  dials: Dials,
  season: Season,
): { payoff: { cost: number; value: number }; lines: string[] } {
  const { cost, value, valueWinter, maxSlightsPerForgiveness } = tuning.gift;
  const forgives = Math.round(maxSlightsPerForgiveness * dials.forgiveness);
  const halfLife = tuning.memory.halfLifeMinDays + tuning.memory.halfLifeSpanDays * dials.memory;
  return {
    payoff: { cost, value: season === 'winter' ? valueWinter : value },
    lines: [
      `At a first meeting, it gives with a chance of ${String(Math.round(dials.opener * 100))}%.`,
      `Later, it forgives ${String(forgives)} ${forgives === 1 ? 'slight' : 'slights'} from a partner, then keeps.`,
      `A slight fades by half in ${short(halfLife)} days.`,
    ],
  };
}
