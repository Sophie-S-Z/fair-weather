import type { Mood } from '../audio/engine.ts';
import { CAST } from './cast.ts';
import { clampToFloor } from './geometry.ts';
import { createRng } from './rng.ts';
import type { CastId, Critter, Icon, Move, Prop, PropKind, Table } from './types.ts';

export interface TableSetup {
  seed: number;
  cast: readonly (readonly [CastId, number, number])[];
  props?: readonly (readonly [PropKind, number, number])[];
  ties?: readonly (readonly [CastId, CastId])[];
  memory?: Record<string, Move>;
  wander?: boolean;
}

/** How long a bubble shows, in seconds, unless a beat says otherwise. */
export const BUBBLE_SECONDS = 1.6;

export function newCritter(cast: CastId, x: number, y: number, id: string = cast): Critter {
  const [cx, cy] = clampToFloor(x, y);
  return {
    id,
    cast,
    x: cx,
    y: cy,
    face: 1,
    mood: { ...CAST[cast].rest },
    goal: null,
    held: false,
    busy: false,
    stuck: false,
    smudge: false,
    lookUp: false,
    bubble: null,
    hop: 0,
    squash: 0,
    squashV: 0,
    nextIdle: 0,
    pokedAt: -Infinity,
    pokes: 0,
  };
}

export function newProp(kind: PropKind, x: number, y: number): Prop {
  return {
    kind,
    x,
    y,
    count: kind === 'bush' ? 6 : 1,
    on: kind === 'bush',
    since: -1,
  };
}

export function createTable(setup: TableSetup): Table {
  const rng = createRng(setup.seed);
  const critters = setup.cast.map(([id, x, y]) => {
    const c = newCritter(id, x, y);
    c.face = rng.next() < 0.5 ? 1 : -1;
    c.nextIdle = rng.next() * 3;
    return c;
  });
  return {
    time: 0,
    rng,
    critters,
    ties: (setup.ties ?? []).map(([a, b]) => ({ a, b })),
    props: (setup.props ?? []).map(([kind, x, y]) => newProp(kind, x, y)),
    wander: setup.wander ?? true,
    calm: false,
    scene: null,
    cool: {},
    memory: { ...setup.memory },
    grudges: [],
    rounds: {},
    boxed: null,
    lastSnip: null,
    events: [],
  };
}

export const critter = (t: Table, id: string): Critter | undefined => t.critters.find((c) => c.id === id);
export const prop = (t: Table, kind: PropKind): Prop | undefined => t.props.find((p) => p.kind === kind);

/** Not held, not in a scene, and not stuck: free to join a scene. */
export const isFree = (c: Critter): boolean => !c.held && !c.busy && !c.stuck;

/** Free creatures within `r` of (x, y), nearest first. */
export function near(
  t: Table,
  x: number,
  y: number,
  r: number,
  test: (c: Critter) => boolean = isFree,
): Critter[] {
  return t.critters
    .map((c) => ({ c, d: Math.hypot(c.x - x, c.y - y) }))
    .filter(({ c, d }) => d < r && test(c))
    .sort((p, q) => p.d - q.d)
    .map(({ c }) => c);
}

export const neighbors = (t: Table, id: string): string[] =>
  t.ties.flatMap((e) => (e.a === id ? [e.b] : e.b === id ? [e.a] : []));

export const hasTie = (t: Table, a: string, b: string): boolean =>
  t.ties.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));

/** Everyone linked to `id` by ties, `id` too. */
export function component(t: Table, id: string): Set<string> {
  const seen = new Set([id]);
  const queue = [id];
  for (let k = 0; k < queue.length; k++) {
    for (const n of neighbors(t, queue[k] as string)) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen;
}

/** The longest chain of ties from `id` that visits no one twice, up to `max` creatures. */
export function longestPathFrom(t: Table, id: string, max: number): string[] {
  let best = [id];
  const walk = (path: string[]): void => {
    if (path.length > best.length) best = path;
    if (path.length >= max) return;
    for (const n of neighbors(t, path[path.length - 1] as string)) {
      if (!path.includes(n)) walk([...path, n]);
    }
  };
  walk([id]);
  return best;
}

export const pairKey = (a: string, b: string): string => (a < b ? `${a}+${b}` : `${b}+${a}`);

export function say(t: Table, c: Critter, icon: Icon, seconds = BUBBLE_SECONDS, n = 0): void {
  c.bubble = { icon, n, until: t.time + seconds };
}

export function chirp(t: Table, c: Critter, mood: Mood): void {
  t.events.push({ kind: 'chirp', who: c.cast, mood });
}

/** A quick squash, as on a landing or a poke. */
export const bump = (c: Critter, amount: number): void => {
  c.squashV += amount;
};
