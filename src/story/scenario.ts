// Builds a chapter's starting scenario (spec 10.1, P6): the year carry, the overrides, at most one
// variant, and the chapter's day length, so the runner and the sim count the same days.
import type { DialKey, HeroKind, Rect, Scenario, Shell } from '../sim/types.ts';
import type { WorldLite } from '../sim-host/protocol.ts';
import { applyCarry, carryFrom, restoreDials } from './carry.ts';
import type { Carry } from './carry.ts';
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
  for (const [id, dials] of Object.entries(o.dials ?? {})) {
    const c = creature(id);
    for (const [key, value] of Object.entries(dials))
      if (value !== undefined) c.dials[key as DialKey] = value;
  }
  const { '*': every, ...named } = o.state ?? {};
  // `'*'` leaves an away creature away (a carried leaver stays gone); a named id can still wake it.
  if (every) for (const c of s.creatures) if (c.state !== 'away' && !c.gone) c.state = every;
  for (const [id, state] of Object.entries(named)) creature(id).state = state;
  for (const id of o.gone ?? []) {
    const c = creature(id);
    c.gone = true;
    c.state = 'away';
  }
  for (const [id, p] of Object.entries(o.positions ?? {})) {
    const c = creature(id);
    // After the states, so a named state can wake a creature: one still away or gone is not in the
    // valley to place (the homecoming's gate variant).
    if (c.state === 'away' || c.gone) continue;
    c.x = p.x;
    c.y = p.y;
  }
  for (const [id, n] of Object.entries(o.danceThreshold ?? {})) creature(id).danceThreshold = n;
  for (const g of o.grudges ?? []) {
    creature(g.holder); // throws on an unknown id
    creature(g.against);
    s.ties ??= [];
    let tie = s.ties.find(
      (t) => (t.a === g.holder && t.b === g.against) || (t.a === g.against && t.b === g.holder),
    );
    if (!tie) {
      tie = { a: g.holder, b: g.against, ab: { warmth: 0, slights: 0 }, ba: { warmth: 0, slights: 0 } };
      s.ties.push(tie);
    }
    (tie.a === g.holder ? tie.ab : tie.ba).slights = g.slights;
  }
  if (o.weather?.light !== undefined)
    throw new Error('A weather.light override is not supported: Scenario has no light');
  if (o.weather?.season) s.season = o.weather.season;
  if (o.structures) s.structures.push(...o.structures.map((x) => ({ ...x })));
  if (o.bushes) s.bushes = o.bushes.map((b) => ({ ...b }));
  if (o.water) s.water = o.water.map((r) => ({ ...r }));
  if (o.ridgeX !== undefined) s.ridgeX = o.ridgeX;
  if (o.mushroom) s.mushroom = { ...o.mushroom };
  if (o.ambientSkyBids) s.ambientSkyBids = true;
  if (o.rumorFirst) s.rumorFirst = true;
  if (o.friendsForgive) s.friendsForgive = true;
}

/**
 * Throws when a creature still in the valley, a bush, a bench, or the gate is in water or at or
 * past the ridge, or a bridge is outside every water rectangle (ADR 0012 item 3).
 */
function checkLand(s: Scenario): void {
  const wet = (r: Rect, x: number, y: number): boolean =>
    x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  const { gateX, gateY } = tuning.scene;
  const things = [
    ...s.creatures.filter((c) => !c.gone),
    ...s.bushes,
    ...s.structures.filter((x) => x.kind === 'bench'),
    { id: 'the gate', x: gateX, y: gateY },
  ];
  for (const b of s.structures.filter((x) => x.kind === 'bridge')) {
    if (!s.water?.some((r) => wet(r, b.x, b.y))) throw new Error(`${b.id} stands on dry land`);
  }
  for (const t of things) {
    if (s.water?.some((r) => wet(r, t.x, t.y))) throw new Error(`${t.id} stands in water`);
    if (s.ridgeX !== undefined && t.x >= s.ridgeX) throw new Error(`${t.id} stands at or past the ridge`);
  }
}

/** The chapter's overrides, then the first variant in array order whose every `when` condition matches `flags`. */
export function chosenOverrides(chapter: Chapter, flags: Flags): Overrides[] {
  const variant = chapter.variants.find((v) => [v.when].flat().every((c) => matches(c, flags)));
  return variant ? [chapter.overrides, variant.overrides] : [chapter.overrides];
}

/** What a chapter starts from (ADR 0012 item 1): its carry, and its dial overrides, which the next chapter's carry puts back. */
export interface ChapterStart {
  carry: Carry | undefined;
  overrides: Overrides[];
}

/**
 * The start of `chapter` with `flags`. On Continue (`saved`), the carry is the save's. Otherwise a
 * `carry: true` chapter takes the carry from the last snapshot and its runner's diaries, with the
 * dials that the last chapter's overrides set put back (restoreDials); any other chapter starts
 * fresh.
 */
export function chapterStart(
  chapter: Chapter,
  flags: Flags,
  base: Scenario,
  from:
    | { saved: Carry | null }
    | { lite: WorldLite | null; diaries: ReadonlyMap<string, readonly string[]>; last: ChapterStart | null },
): ChapterStart {
  let carry: Carry | undefined;
  if ('saved' in from) carry = from.saved ?? undefined;
  else {
    carry = chapter.carry && from.lite ? carryFrom(from.lite, from.diaries) : undefined;
    if (carry && from.last) restoreDials(carry, from.last.carry, base, from.last.overrides);
  }
  return { carry, overrides: chosenOverrides(chapter, flags) };
}

/**
 * What a valley takes from the journey (ADR 0013 item 9): the hero, its keepsakes and rumor, its
 * shell from the last valley (null before the first), who came home with it from Halcyon (Wisp,
 * or Wisp's seed), and Kith's average warmth so far.
 */
export interface JourneyStart {
  kind: HeroKind;
  name: string;
  keepsakes: string[];
  rumor: { value: number; strength: number } | null;
  shell: Shell | null;
  companion: 'wisp' | 'seed' | null;
  kithWarmth: number;
}

/**
 * The hero at the gate with 3 berries and its shell, the valley's pack with the base scenario's pack fields
 * (Halcyon's kithWarmth from the journey), and the companion (ADR 0013 item 12): Wisp back beside
 * the gate, or the `wisp-seed` bush 40 units right of the first bench.
 */
function startValley(s: Scenario, valley: NonNullable<Chapter['valley']>, journey: JourneyStart): void {
  const { gateX, gateY } = tuning.scene;
  const { kind, name, keepsakes, rumor, shell } = journey;
  s.hero = { kind, name, x: gateX, y: gateY, berries: 3, keepsakes: [...keepsakes], rumor };
  if (shell) s.hero.shell = { ...shell };
  const pack = valley.pack;
  if (pack === null) delete s.pack;
  else if (pack === 'hollow' && !s.pack) s.pack = { id: 'hollow' };
  else if (s.pack?.id !== pack)
    throw new Error(`The valley's ${pack} pack does not match the base scenario's`);
  else if (s.pack.id === 'halcyon') s.pack.kithWarmth = journey.kithWarmth;
  if (journey.companion === 'wisp') {
    const wisp = s.creatures.find((c) => c.id === 'wisp');
    if (!wisp) throw new Error('The base scenario has no Wisp to come home');
    delete wisp.gone;
    wisp.state = 'wander';
    wisp.x = gateX + 40;
    wisp.y = gateY;
  } else if (journey.companion === 'seed') {
    const bench = s.structures.find((x) => x.kind === 'bench');
    if (!bench) throw new Error("Wisp's seed needs a bench to grow by");
    s.bushes.push({ id: 'wisp-seed', x: bench.x + 40, y: bench.y, berries: 3 });
  }
}

/**
 * A deep copy of `base` (never mutated) for this chapter: season from the chapter, then `carry`
 * when given (ADR 0012 item 1), then `chapter.overrides`, then the first variant in array order
 * whose every `when` condition matches `flags`, applied last so it wins on conflicts; for a valley,
 * then the journey's start (startValley); `ticksPerDay` from chapterTicksPerDay. Throws on an
 * override id that is not in `base.creatures`, on a `weather.light` override, on a valley with no
 * journey, and on land that checkLand refuses.
 */
export function buildScenario(
  chapter: Chapter,
  flags: Flags,
  base: Scenario,
  carry?: Carry,
  journey?: JourneyStart,
): Scenario {
  const s = structuredClone(base);
  s.season = chapter.season;
  if (carry) applyCarry(s, carry);
  for (const o of chosenOverrides(chapter, flags)) apply(s, o);
  if (chapter.valley) {
    if (!journey) throw new Error(`Valley ${chapter.id} needs a journey`);
    startValley(s, chapter.valley, journey);
  }
  s.ticksPerDay = chapterTicksPerDay(chapter);
  checkLand(s);
  return s;
}
