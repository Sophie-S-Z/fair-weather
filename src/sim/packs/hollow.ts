// Hearsay Hollow (ADR 0013 item 6, with the Hollow parts of the Lantern-bearer, Glassling, and
// Bellchime knacks of item 3): meetings score drama (ADR 0007), the drama sky is the lens and moves
// toward the top score, and the gazette prints at dusk. Nothing here draws.
import type { Creature, HollowState, SimEvent, World } from '../types.ts';
import { HERO } from '../types.ts';
import type { Tuning } from '../tuning.ts';
import { byCodeUnit, dist2 } from '../math.ts';
import type { RulePack } from './index.ts';

// Drama scores (ADR 0007, ADR 0013 item 6); a Glassling hero's away scores as an against (item 3).
const AGAINST = 3;
const KEEP_AFTER_GIFT = 2;
const AWAY = 1;
const POSE = 3;
/** A Lantern-bearer's sky speed factor toward a drama with the hero (ADR 0013 item 3). */
const LANTERN_SKY = 2;
/** How many times a print about a Bellchime hero adds hollow.fameStep (ADR 0013 item 3). */
const BELL_PRINTS = 2;

function hollowOf(world: World): HollowState | undefined {
  return world.pack?.id === 'hollow' ? world.pack : undefined;
}

/**
 * True when `id` is the hero of a world that has one: hero.ts isHero, written out, since hero.ts
 * imports packs/index.ts and importing it here would make an import cycle.
 */
function heroId(world: World, id: string): boolean {
  return world.hero !== undefined && id === HERO;
}

/**
 * True in the Hollow when `a` or `b` has fame above hollow.fearAt and the other is a local (not the
 * hero): the town keeps its distance (ADR 0013 item 6). False without a Hollow.
 */
export function keepsDistance(world: World, a: Creature, b: Creature, t: Tuning): boolean {
  const h = hollowOf(world);
  if (!h) return false;
  const feared = (x: Creature, other: Creature) =>
    (h.fame[x.id] ?? 0) > t.hollow.fearAt && !heroId(world, other.id);
  return feared(a, b) || feared(b, a);
}

/** Adds a drama to its subject's entry, moving the entry to this spot and today; a 0 adds none. */
function addDrama(
  world: World,
  h: HollowState,
  subject: string,
  x: number,
  y: number,
  score: number,
  hero: boolean,
) {
  if (score === 0) return;
  const e = h.drama.find((d) => d.subject === subject);
  if (!e) {
    h.drama.push({ subject, x, y, score, day: world.day, hero });
    return;
  }
  e.score += score;
  e.x = x;
  e.y = y;
  e.day = world.day;
  e.hero = hero;
}

/**
 * The drama `e` scores, its subject, and the two who met (ADR 0013 item 6): a bid's replier for an
 * against or an away reply, and a gift's keeper when the other side gave; undefined for any other
 * event.
 */
function dramaOf(
  world: World,
  e: SimEvent,
  events: readonly SimEvent[],
): { subject: string; score: number; from: string; to: string } | undefined {
  if (e.t === 'bid') {
    const glassAway = heroId(world, e.to) && world.hero?.kind === 'glassling';
    const score = e.reply === 'against' ? AGAINST : e.reply === 'away' ? (glassAway ? AGAINST : AWAY) : 0;
    return { subject: e.to, score, from: e.from, to: e.to };
  }
  if (e.t !== 'gift' || e.move !== 'keep') return undefined;
  const gave = events.some((o) => o.t === 'gift' && o.from === e.to && o.to === e.from && o.move === 'give');
  return { subject: e.from, score: gave ? KEEP_AFTER_GIFT : 0, from: e.from, to: e.to };
}

/**
 * Scores the meetings in `events` (dramaOf). The spot is the midpoint of the two; `hero` is set
 * when one of them is the hero.
 */
function scoreMeetings(world: World, h: HollowState, events: readonly SimEvent[]): void {
  for (const e of events) {
    const drama = dramaOf(world, e, events);
    if (!drama) continue;
    const { subject, score } = drama;
    const a = world.creatures.find((c) => c.id === drama.from);
    const b = world.creatures.find((c) => c.id === drama.to);
    if (!a || !b) continue;
    const hero = heroId(world, a.id) || heroId(world, b.id);
    addDrama(world, h, subject, (a.x + b.x) / 2, (a.y + b.y) / 2, score, hero);
  }
}

/** The highest-scored entry, ties to the lower subject id; undefined when there is none. */
function top(drama: HollowState['drama']): HollowState['drama'][number] | undefined {
  let best: HollowState['drama'][number] | undefined;
  for (const d of drama) {
    if (
      !best ||
      d.score > best.score ||
      (d.score === best.score && byCodeUnit(d.subject, best.subject) < 0)
    ) {
      best = d;
    }
  }
  return best;
}

/**
 * The sky moves hollow.skySpeed a second toward the top drama, stopping on it, × LANTERN_SKY when
 * the hero is a Lantern-bearer and that drama is the hero's (ADR 0013 items 3 and 6).
 */
function moveSky(world: World, h: HollowState, t: Tuning): void {
  const to = top(h.drama);
  if (!to) return;
  const fast = to.hero && world.hero?.kind === 'lantern' ? LANTERN_SKY : 1;
  const reach = (t.hollow.skySpeed / t.sim.stepsPerSecond) * fast;
  const dx = to.x - h.sky.x;
  const dy = to.y - h.sky.y;
  const d2 = dx * dx + dy * dy;
  if (d2 <= reach * reach) {
    h.sky = { x: to.x, y: to.y };
    return;
  }
  const k = reach / Math.sqrt(d2);
  h.sky = { x: h.sky.x + dx * k, y: h.sky.y + dy * k };
}

/**
 * The gazette (ADR 0013 item 6): the top drama of today within the lens is printed, and its
 * subject's fame rises by hollow.fameStep (BELL_PRINTS times for a Bellchime hero, item 3). Then
 * every fame falls by hollow.fameFade of itself and every score halves. Returns the print, if any.
 */
function gazette(world: World, h: HollowState, t: Tuning): SimEvent[] {
  const r2 = t.light.lensRadius * t.light.lensRadius;
  const front = top(h.drama.filter((d) => d.day === world.day && dist2(d.x, d.y, h.sky.x, h.sky.y) <= r2));
  if (front) {
    const times = heroId(world, front.subject) && world.hero?.kind === 'bellchime' ? BELL_PRINTS : 1;
    let fame = h.fame[front.subject] ?? 0;
    for (let i = 0; i < times; i++) fame += t.hollow.fameStep;
    h.fame[front.subject] = fame;
    h.front = front.subject;
  }
  for (const [id, fame] of Object.entries(h.fame)) h.fame[id] = fame - t.hollow.fameFade * fame;
  for (const d of h.drama) d.score /= 2;
  return front ? [{ t: 'print', subject: front.subject, fame: h.fame[front.subject] ?? 0 }] : [];
}

export const hollow: RulePack = {
  id: 'hollow',

  /** The lens starts at the sky. No draws. */
  setup(world: World): void {
    const h = hollowOf(world);
    if (h) world.fields.light = { ...h.sky };
  },

  /**
   * Scores this tick's meetings, moves the sky, and keeps the lens (`fields.light`) at it, so the
   * spec 9.4 lens rules give its boost; on the last tick of the day, the gazette. No draws.
   */
  step(world: World, events, t: Tuning) {
    const h = hollowOf(world);
    if (!h) return [];
    scoreMeetings(world, h, events);
    moveSky(world, h, t);
    world.fields.light = { ...h.sky };
    return world.tick % world.ticksPerDay === world.ticksPerDay - 1 ? gazette(world, h, t) : [];
  },

  /** `pose` scores POSE at the hero's spot with the hero as subject; other verbs do nothing. No draws. */
  onVerb(world: World, verb) {
    const h = hollowOf(world);
    const hero = world.hero && world.creatures.find((c) => c.id === HERO);
    if (verb.verb === 'pose' && h && hero) addDrama(world, h, HERO, hero.x, hero.y, POSE, true);
    return [];
  },

  /** The hero's fame; 0 when it has none. */
  metrics(world: World) {
    return { heroFame: hollowOf(world)?.fame[HERO] ?? 0 };
  },
};
