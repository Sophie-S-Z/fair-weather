// Builds a chapter's starting scenario (spec 10.1, P6): the overrides, at most one variant, and the
// chapter's day length, so the runner and the sim count the same days.
import type { DialKey, Scenario } from '../sim/types.ts';
import type { Flags } from './flags.ts';
import type { Chapter, FlagCondition, Overrides } from './schema.ts';
import { tuning } from './tuning.ts';

/** Ticks in one chapter day. Throws unless it is a positive integer (the sim's dusk test needs one). */
export function chapterTicksPerDay(chapter: Pick<Chapter, 'dayLengthSeconds'>): number {
  const n = tuning.sim.stepsPerSecond * chapter.dayLengthSeconds;
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`dayLengthSeconds ${String(chapter.dayLengthSeconds)} gives ${String(n)} ticks per day`);
  }
  return n;
}

/** `eq` compares any flag; `gte` and `lte` need a numeric flag and value, and throw otherwise. */
export function matches(cond: FlagCondition, flags: Flags): boolean {
  const v = flags[cond.flag];
  if (cond.op === 'eq') return v === cond.value;
  if (typeof v !== 'number' || typeof cond.value !== 'number') {
    throw new Error(`'${cond.op}' needs a numeric flag and value: ${cond.flag}`);
  }
  return cond.op === 'gte' ? v >= cond.value : v <= cond.value;
}

function apply(s: Scenario, o: Overrides): void {
  const creature = (id: string): Scenario['creatures'][number] => {
    const c = s.creatures.find((x) => x.id === id);
    if (!c) throw new Error(`Override names unknown creature "${id}"`);
    return c;
  };
  for (const [id, p] of Object.entries(o.positions ?? {})) {
    const c = creature(id);
    c.x = p.x;
    c.y = p.y;
  }
  for (const [id, dials] of Object.entries(o.dials ?? {})) {
    const c = creature(id);
    for (const [key, value] of Object.entries(dials))
      if (value !== undefined) c.dials[key as DialKey] = value;
  }
  for (const [id, state] of Object.entries(o.state ?? {})) creature(id).state = state;
  if (o.weather?.light !== undefined)
    throw new Error('A weather.light override is not supported: Scenario has no light');
  if (o.weather?.season) s.season = o.weather.season;
}

/**
 * A deep copy of `base` (never mutated) for this chapter: season from the chapter, then
 * `chapter.overrides`, then the first variant in array order whose `when` matches `flags`, applied
 * last so it wins on conflicts; `ticksPerDay` from chapterTicksPerDay. Throws on an override id
 * that is not in `base.creatures` and on a `weather.light` override.
 */
export function buildScenario(chapter: Chapter, flags: Flags, base: Scenario): Scenario {
  const s = structuredClone(base);
  s.season = chapter.season;
  apply(s, chapter.overrides);
  const variant = chapter.variants.find((v) => matches(v.when, flags));
  if (variant) apply(s, variant.overrides);
  s.ticksPerDay = chapterTicksPerDay(chapter);
  return s;
}
