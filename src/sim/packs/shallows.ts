// Lily Shallows (ADR 0015 item 5): a frog hops to another pad when too few of its pad-mates share a
// song with it, and, once enough frogs know two songs, also when too many do. The hero learns a
// song from a frog and sings it to others. Each hop takes one draw.
import type { Creature, ShallowsState, SimEvent, World } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { Tuning } from '../tuning.ts';
import { dist2 } from '../math.ts';
import { isHero } from './hero-tie.ts';
import type { RulePack } from './index.ts';

/** The frogs' species. */
export const FROG = 'frog';

/**
 * A pad's eight slots, as unit offsets from its center: x in slot units, y squashed to the pad's
 * oval on the ground. A frog takes the lowest free one.
 */
const SLOTS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -0.5],
  [0, 0.5],
  [-0.7, -0.35],
  [0.7, -0.35],
  [-0.7, 0.35],
  [0.7, 0.35],
];

function shallowsOf(world: World): ShallowsState | undefined {
  return world.pack?.id === 'shallows' ? world.pack : undefined;
}

/** The frogs, not away, in creature order: the creatures with a pad. */
function frogs(world: World, s: ShallowsState): Creature[] {
  return world.creatures.filter((c) => c.state !== 'away' && s.padOf[c.id] !== undefined);
}

/** The lowest slot no frog on `pad` holds, or -1 when the pad is full. */
function freeSlot(world: World, s: ShallowsState, pad: string, t: Tuning): number {
  const taken = new Set(
    frogs(world, s)
      .filter((c) => s.padOf[c.id] === pad)
      .map((c) => s.slotOf[c.id]),
  );
  for (let i = 0; i < Math.min(t.shallows.padCap, SLOTS.length); i++) if (!taken.has(i)) return i;
  return -1;
}

/**
 * A frog away gives up its slot; a frog back from away takes the lowest free slot of its pad, or of
 * the first pad with room in pad order, and waits at its pad's center while every pad is full.
 */
function seat(world: World, s: ShallowsState, c: Creature, t: Tuning): void {
  if (c.state === 'away') {
    if (s.slotOf[c.id] !== undefined)
      s.slotOf = Object.fromEntries(Object.entries(s.slotOf).filter(([id]) => id !== c.id));
    return;
  }
  if (s.slotOf[c.id] !== undefined) return;
  const own = s.pads.find((p) => p.id === s.padOf[c.id]);
  for (const pad of own ? [own, ...s.pads.filter((p) => p !== own)] : s.pads) {
    const slot = freeSlot(world, s, pad.id, t);
    if (slot < 0) continue;
    s.padOf[c.id] = pad.id;
    s.slotOf[c.id] = slot;
    break;
  }
  aim(c, s, t);
}

/** Sends `c` to its slot on its pad, or to the pad's center without one. */
function aim(c: Creature, s: ShallowsState, t: Tuning): void {
  const pad = s.pads.find((p) => p.id === s.padOf[c.id]);
  const slot = s.slotOf[c.id];
  const [dx, dy] = slot === undefined ? [0, 0] : (SLOTS[slot] ?? [0, 0]);
  if (!pad) return;
  c.goalX = pad.x + dx * t.shallows.slot;
  c.goalY = pad.y + dy * t.shallows.slot;
}

const shares = (s: ShallowsState, a: string, b: string): boolean =>
  (s.songs[a] ?? []).some((song) => (s.songs[b] ?? []).includes(song));

/** `c`'s pad-mates: the other frogs on its pad, not away. */
function mates(world: World, s: ShallowsState, c: Creature): Creature[] {
  return frogs(world, s).filter((o) => o !== c && s.padOf[o.id] === s.padOf[c.id]);
}

/**
 * True when `c` would hop: it has pad-mates and its match share (the mates who share any song with
 * it, over its mates) is below shallows.minShare, or, with the variety rule on, above maxShare.
 */
function unhappy(world: World, s: ShallowsState, c: Creature, t: Tuning): boolean {
  const near = mates(world, s, c);
  if (near.length === 0) return false;
  const share = near.filter((o) => shares(s, c.id, o.id)).length / near.length;
  return share < t.shallows.minShare || (s.variety && share > t.shallows.maxShare);
}

/**
 * The pond's sorting (ADR 0015 item 5): the mean, over frogs that know one song and have
 * pad-mates, of the share of their mates who know it; 0 with none.
 */
export function sorting(world: World): number {
  const s = shallowsOf(world);
  if (!s) return 0;
  let sum = 0;
  let n = 0;
  for (const c of frogs(world, s)) {
    const [song, second] = s.songs[c.id] ?? [];
    const near = mates(world, s, c);
    if (song === undefined || second !== undefined || near.length === 0) continue;
    sum += near.filter((o) => (s.songs[o.id] ?? []).includes(song)).length / near.length;
    n += 1;
  }
  return n === 0 ? 0 : sum / n;
}

/** True in the Shallows for a frog with a pad: the pack sets its goal (ADR 0015 item 2). */
export function steersFrog(world: World, c: Creature): boolean {
  const s = shallowsOf(world);
  return s !== undefined && s.padOf[c.id] !== undefined;
}

/** The frog within shallows.reachRadii meeting radii of the hero with id `id`, if any. */
function inReach(world: World, id: string, t: Tuning): Creature | undefined {
  const hero = world.creatures.find((c) => isHero(world, c));
  const to = world.creatures.find((c) => c.id === id && c !== hero && c.state !== 'away');
  const reach = t.shallows.reachRadii * t.meet.radius;
  return hero && to && dist2(to.x, to.y, hero.x, hero.y) <= reach * reach ? to : undefined;
}

export const shallows: RulePack = {
  id: 'shallows',

  /**
   * Each frog, in creature order, takes the lowest free slot of its pad and stands there. Throws on
   * a pad that is not in the pond or holds more than shallows.padCap frogs. No draws.
   */
  setup(world: World, t: Tuning): void {
    const s = shallowsOf(world);
    if (!s) return;
    for (const c of world.creatures) {
      const pad = s.padOf[c.id];
      if (pad === undefined) continue;
      if (!s.pads.some((p) => p.id === pad)) throw new Error(`${c.id} sits on no pad ${pad}`);
      const slot = freeSlot(world, s, pad, t);
      if (slot < 0) throw new Error(`Pad ${pad} holds more than ${String(t.shallows.padCap)} frogs`);
      s.slotOf[c.id] = slot;
      aim(c, s, t);
      c.x = c.goalX;
      c.y = c.goalY;
    }
  },

  /**
   * Every shallows.everyTicks ticks: frogs away give up their slots and frogs back take one (seat);
   * then the unhappy frogs, found before any hop, hop in creature order;
   * each draws once for one of the other pads with room, in pad order, and stays with none. The
   * first check with no unhappy frog gives `settled`, once.
   */
  step(world: World, events, t: Tuning, rng: Rng) {
    const s = shallowsOf(world);
    if (!s || world.tick % t.shallows.everyTicks !== 0) return [];
    const out: SimEvent[] = [];
    for (const c of world.creatures) if (s.padOf[c.id] !== undefined) seat(world, s, c, t);
    const hopping = frogs(world, s).filter((c) => unhappy(world, s, c, t));
    if (hopping.length === 0 && !s.settled) {
      s.settled = true;
      out.push({ t: 'settled' });
    }
    for (const c of hopping) {
      const room = s.pads.filter((p) => p.id !== s.padOf[c.id] && freeSlot(world, s, p.id, t) >= 0);
      if (room.length === 0) continue;
      const pad = room[Math.floor(rng.next() * room.length)] ?? room[0];
      if (!pad) continue;
      s.slotOf[c.id] = freeSlot(world, s, pad.id, t);
      s.padOf[c.id] = pad.id;
      aim(c, s, t);
    }
    return out;
  },

  /**
   * `learn` takes the first song of a frog in reach as the hero's; `sing` teaches the hero's song to
   * a frog in reach that knows one song, not that one (event `song`), at most once a day, and at
   * shallows.varietyAt frogs who know two the variety rule turns on (event `variety`). Other verbs do
   * nothing here. No draws.
   */
  onVerb(world: World, verb, t: Tuning) {
    const s = shallowsOf(world);
    if (!s || !world.hero) return [];
    if (verb.verb === 'learn') {
      const from = inReach(world, verb.from, t);
      const song = from && s.songs[from.id]?.[0];
      if (song) s.heroSong = song;
      return [];
    }
    if (verb.verb !== 'sing' || s.heroSong === null || s.sangOn === world.day) return [];
    const to = inReach(world, verb.to, t);
    const known = to && s.songs[to.id];
    if (!to || known?.length !== 1 || known.includes(s.heroSong)) return [];
    known.push(s.heroSong);
    s.sangOn = world.day;
    const out: SimEvent[] = [{ t: 'song', who: to.id, song: s.heroSong }];
    const bilingual = Object.values(s.songs).filter((x) => x.length > 1).length;
    if (!s.variety && bilingual >= t.shallows.varietyAt) {
      s.variety = true;
      out.push({ t: 'variety' });
    }
    return out;
  },

  /** The pond's sorting. */
  metrics(world: World) {
    return { sorting: sorting(world) };
  },
};
