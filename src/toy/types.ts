import type { Mood } from '../audio/engine.ts';
import type { Shell } from '../render/line/shell.ts';
import type { Rng } from './rng.ts';

export const CAST_IDS = [
  'pim',
  'krit',
  'echo',
  'moss',
  'bell',
  'quill',
  'tove',
  'frog',
  'snail',
  'toadstool',
  'kite',
  'glassling',
] as const;
export type CastId = (typeof CAST_IDS)[number];

export const PROP_KINDS = [
  'cookie',
  'bush',
  'mirror',
  'signpost',
  'puddle',
  'twins',
  'track',
  'lamp',
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/** The pictures a creature can show in its speech bubble. */
export type Icon =
  | 'cookie'
  | 'crumbs'
  | 'berry'
  | 'heart'
  | 'question'
  | 'storm'
  | 'bang'
  | 'eye'
  | 'help'
  | 'zzz'
  | 'crown'
  | 'star'
  | 'monster'
  | 'count';

export const STICKER_IDS = [
  'standoff',
  'copycat',
  'commons',
  'lookup',
  'bystander',
  'spotlight',
  'identity',
  'lever',
  'shadows',
  'telephone',
  'bridge',
  'paradox',
] as const;
export type StickerId = (typeof STICKER_IDS)[number];

export type Move = 'share' | 'grab';

export interface Bubble {
  icon: Icon;
  /** The number on a `count` bubble. */
  n: number;
  until: number;
}

/** One creature on the table. Positions are in table units; `y` is the creature's foot. */
export interface Critter {
  /** The cast id, or `<cast>+copy` for the twin box copy. */
  id: string;
  cast: CastId;
  x: number;
  y: number;
  face: 1 | -1;
  mood: Shell;
  goal: { x: number; y: number } | null;
  held: boolean;
  /** In a scene: it ignores idle life, and the player cannot pick it up. */
  busy: boolean;
  /** Stuck in the puddle until the player lifts it. */
  stuck: boolean;
  /** Bell's ink smudge, from any poke. */
  smudge: boolean;
  lookUp: boolean;
  bubble: Bubble | null;
  /** Phase of the current hop, 0 to 1; 0 is on the ground. */
  hop: number;
  /** Squash spring: + is wide and flat, - is tall and thin. */
  squash: number;
  squashV: number;
  nextIdle: number;
  pokedAt: number;
  /** Pokes in a fast run (each within `DOUBLE_POKE` seconds of the last). */
  pokes: number;
}

export interface Tie {
  a: string;
  b: string;
}

/**
 * A prop on the table. `count`: cookie halves (1 whole, 2 split, 0 crumbs, -1 carried off) or berries on the bush.
 * `on`: the bush is alive, the track lever points down, the lamp is lit. `since`: when the bush
 * wilted, or when the cart left; -1 when idle.
 */
export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  count: number;
  on: boolean;
  since: number;
}

export type ToyEvent =
  | { kind: 'chirp'; who: CastId; mood: Mood }
  | { kind: 'pop' }
  | { kind: 'line'; text: string }
  | { kind: 'found'; id: StickerId };

export type Action =
  | { do: 'walk'; who: string; x: number; y: number }
  | { do: 'face'; who: string; to: string | number }
  | { do: 'say'; who: string; icon: Icon; n?: number; for?: number }
  | { do: 'feel'; who: string; mood: Partial<Shell>; chirp?: Mood }
  | { do: 'hop'; who: string }
  | { do: 'look'; who: string; up: boolean }
  | { do: 'free'; who: string }
  | { do: 'clean'; who: string }
  | { do: 'prop'; kind: PropKind; patch: Partial<Omit<Prop, 'kind'>> }
  | { do: 'take'; kind: PropKind }
  | { do: 'spawn'; critter: Critter }
  | { do: 'remove'; who: string }
  | { do: 'line'; text: string }
  /** Runs at its time and may add beats: for choices made mid scene (a poke, the lever). */
  | { do: 'run'; fn: (t: Table, s: RunningScene) => void };

export type Beat = Action & { at: number };

export interface Scene {
  id: StickerId;
  /** The creatures the scene directs. */
  actors: string[];
  beats: Beat[];
  /** Seconds. */
  length: number;
  unlock: StickerId[];
  /** The scene ends early if this prop leaves the table. */
  needs: PropKind | null;
}

export interface RunningScene extends Scene {
  start: number;
  /** Index of the next beat to apply. */
  next: number;
}

export interface Discovery {
  /** Also the key of its cooldown. */
  id: StickerId;
  detect(t: Table): Scene | null;
}

export interface Table {
  time: number;
  rng: Rng;
  critters: Critter[];
  ties: Tie[];
  props: Prop[];
  /** Idle life on (the main table) or off (lesson loops). */
  wander: boolean;
  /** Reduced motion: moves jump to their goal, no hops or wobble. */
  calm: boolean;
  scene: RunningScene | null;
  cool: Partial<Record<StickerId, number>>;
  /** The last cookie move of `a` toward `b`, under `a>b`. */
  memory: Record<string, Move>;
  /** Snail's grudges, as `snail>other`. */
  grudges: string[];
  /** Cookie rounds per pair, under the two ids sorted and joined by `+`. */
  rounds: Record<string, number>;
  /** The creature dropped in twin box A, not yet copied. */
  boxed: string | null;
  lastSnip: { a: string; b: string; sizes: [number, number]; time: number } | null;
  events: ToyEvent[];
}
