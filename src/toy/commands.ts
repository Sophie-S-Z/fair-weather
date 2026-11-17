import { clampToFloor, depthScale, dist, twinBoxes } from './geometry.ts';
import { bump, chirp, component, critter, hasTie, newProp, prop, say } from './table.ts';
import type { Prop, PropKind, Table } from './types.ts';

/** Two pokes this close (seconds) make a fast run: Kite's whisper. */
export const DOUBLE_POKE = 0.6;
/** Where each prop lands when it leaves the drawer. */
export const PROP_SPOTS: Record<PropKind, [number, number]> = {
  cookie: [800, 660],
  bush: [1270, 560],
  mirror: [300, 560],
  signpost: [560, 500],
  puddle: [1040, 780],
  twins: [1290, 790],
  track: [780, 520],
  lamp: [380, 760],
};

/** Lifts a creature. A busy creature cannot be lifted. Lifting frees a stuck one. */
export function pickUp(t: Table, id: string): boolean {
  const c = critter(t, id);
  if (!c || c.busy || c.held) return false;
  c.held = true;
  c.goal = null;
  c.stuck = false;
  c.hop = 0;
  bump(c, -3);
  chirp(t, c, 'surprised');
  return true;
}

export function moveHeld(t: Table, x: number, y: number): void {
  const c = t.critters.find((k) => k.held);
  if (!c) return;
  const [cx, cy] = clampToFloor(x, y);
  if (cx !== c.x) c.face = cx > c.x ? 1 : -1;
  c.x = cx;
  c.y = cy;
}

/** Puts the held creature down: on a creature (both complain), in the puddle, or in twin box A. */
export function drop(t: Table): void {
  const c = t.critters.find((k) => k.held);
  if (!c) return;
  c.held = false;
  bump(c, 4);
  const s = depthScale(c.y);
  const other = t.critters.find((k) => k !== c && dist(k.x, k.y, c.x, c.y) < 40 * s);
  if (other) {
    for (const k of [c, other]) {
      say(t, k, 'storm');
      k.mood.bristle = 0.8;
    }
    chirp(t, other, 'angry');
    c.x += c.x >= other.x ? 50 : -50;
    [c.x, c.y] = clampToFloor(c.x, c.y);
  }
  const puddle = prop(t, 'puddle');
  if (puddle && dist(puddle.x, puddle.y, c.x, c.y) < 75) {
    c.stuck = true;
    say(t, c, 'help');
    chirp(t, c, 'sad');
  }
  const twins = prop(t, 'twins');
  if (twins && !c.id.endsWith('+copy')) {
    const [ax, ay] = twinBoxes(twins).a;
    if (dist(ax, ay, c.x, c.y) < 45) {
      [c.x, c.y] = [ax, ay];
      t.boxed = c.id;
    }
  }
}

export function poke(t: Table, id: string): void {
  const c = critter(t, id);
  if (!c) return;
  c.pokes = t.time - c.pokedAt < DOUBLE_POKE ? c.pokes + 1 : 1;
  c.pokedAt = t.time;
  bump(c, 6);
  if (!t.calm) c.hop = 0.01;
  if (!c.busy) say(t, c, 'bang', 0.8);
  if (c.cast === 'bell') c.smudge = true;
  chirp(t, c, 'surprised');
}

/** Ties two creatures. Returns false for a tie that exists or a creature tied to itself. */
export function tie(t: Table, a: string, b: string): boolean {
  const ca = critter(t, a);
  const cb = critter(t, b);
  if (!ca || !cb || a === b || hasTie(t, a, b)) return false;
  t.ties.push({ a, b });
  for (const c of [ca, cb]) say(t, c, 'heart', 1);
  chirp(t, ca, 'happy');
  return true;
}

/** Snips a tie, and notes whether it was the only link between two groups. */
export function snip(t: Table, a: string, b: string): boolean {
  const i = t.ties.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  if (i < 0) return false;
  t.ties.splice(i, 1);
  const ga = component(t, a);
  if (!ga.has(b)) t.lastSnip = { a, b, sizes: [ga.size, component(t, b).size], time: t.time };
  for (const id of [a, b]) {
    const c = critter(t, id);
    if (c) {
      say(t, c, 'storm', 1);
      chirp(t, c, 'sad');
    }
  }
  return true;
}

/** Puts a prop on the table at its spot. Each prop exists once. */
export function placeProp(t: Table, kind: PropKind): Prop {
  const have = prop(t, kind);
  if (have) return have;
  const [x, y] = PROP_SPOTS[kind];
  const p = newProp(kind, x, y);
  t.props.push(p);
  t.events.push({ kind: 'pop' });
  return p;
}

export function removeProp(t: Table, kind: PropKind): void {
  t.props = t.props.filter((p) => p.kind !== kind);
  if (kind === 'twins') t.boxed = null;
  if (kind === 'puddle') for (const c of t.critters) c.stuck = false;
  t.events.push({ kind: 'pop' });
}

export function moveProp(t: Table, kind: PropKind, x: number, y: number): void {
  const p = prop(t, kind);
  if (p) [p.x, p.y] = clampToFloor(x, y);
}

/** Flips the track lever or the lamp. Other props do nothing. */
export function toggleProp(t: Table, kind: PropKind): void {
  const p = prop(t, kind);
  if (!p || (kind !== 'track' && kind !== 'lamp')) return;
  p.on = !p.on;
  t.events.push({ kind: 'pop' });
}
