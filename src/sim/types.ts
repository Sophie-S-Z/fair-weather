// Core sim types (spec 9, ADRs 0002 to 0005). Types, plus the fixed dial order.
export type { Tuning } from './tuning.ts';
export const SEASONS = ['spring', 'summer', 'lateSummer', 'autumn', 'winter', 'thaw'] as const;
export type Season = (typeof SEASONS)[number];
export type CreatureState = 'wander' | 'meet' | 'sleep' | 'leave' | 'away';
export type BidReply = 'toward' | 'away' | 'against';
export type GiftMove = 'give' | 'keep';
export type Behavior = 'toward' | 'against' | 'give' | 'keep';
/** The six heroes the player may walk as (ADR 0013 item 1). */
export const HERO_KINDS = ['lantern', 'kite', 'mosscoat', 'glassling', 'seedcarrier', 'bellchime'] as const;
export type HeroKind = (typeof HERO_KINDS)[number];
/** The hero's creature id (ADR 0013 item 1). */
export const HERO = 'hero';
export type DialKey = 'opener' | 'forgiveness' | 'memory' | 'ear' | 'wanderlust';
/** The fixed dial order for every PRNG pick over dials. */
export const DIAL_KEYS = [
  'opener',
  'forgiveness',
  'memory',
  'ear',
  'wanderlust',
] as const satisfies readonly DialKey[];
export type Dials = Record<DialKey, number>; // each 0..1
export interface Shell {
  tightness: number;
  bristle: number;
  color: number;
  softness: number;
} // each 0..1
export interface DiaryEntry {
  tick: number;
  kind: SimEvent['t'];
  with: string;
  value: number;
}
export interface Creature {
  id: string;
  speciesId: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  goalX: number;
  goalY: number;
  berries: number;
  state: CreatureState;
  stateUntilTick: number;
  forageReadyTick: number;
  dials: Dials;
  shell: Shell;
  restShell: Shell;
  skyWarmth: number; // -1..1
  skyLightToday: number; // 0..sky.lightDailyCap
  opinions: Record<string, number>; // -1..1 (ADR 0002)
  hungryDusks: number;
  visits: number[]; // 32 cells, ADR 0005
  benchMemory: { benchId: string; day: number } | null;
  diary: DiaryEntry[]; // last 20
  /** Set by overPoke: the creature gets no sky warmth from the lens through this day. */
  lensAvoidUntilDay?: number;
  /** Left over the east ridge for good (ADR 0012 item 3): never returns. */
  gone?: true;
  /** Dancing at the festival (ADR 0012 item 6). */
  dancing?: true;
  /** Dancing friends needed to start; festival.threshold when unset. */
  danceThreshold?: number;
  /** The last day it took a dew drop (ADR 0012 item 5). */
  mushroomDay?: number;
}
export interface Side {
  warmth: number;
  slights: number;
}
export interface Tie {
  a: string;
  b: string;
  ab: Side;
  ba: Side;
  meetings: number;
  lastDay: number;
}
export interface Bush {
  id: string;
  x: number;
  y: number;
  berries: number;
}
/** An axis-aligned rectangle, edges included. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Structure {
  id: string;
  kind: 'bench' | 'bridge' | 'lantern';
  x: number;
  y: number;
}
/**
 * The latest whisper. Only `about` and `sign` are read (lite.ts lastRumor). `strength`, `origin`,
 * and `tick` are written but never read; they stay because they are hashed, and removing them would
 * move the M0 golden hash. Remove them at the next planned hash change.
 */
export interface Rumor {
  about: string;
  sign: 1 | -1;
  strength: number;
  origin: string;
  tick: number;
}
export interface BehaviorBoost {
  behavior: Behavior;
  x: number;
  y: number;
  untilDay: number;
}
/** A gust in flight. The sim only adds and expires gusts in M0; they are kept for M1 render and sim use. */
export interface Gust {
  x: number;
  y: number;
  dx: number;
  dy: number;
  untilTick: number;
}
export interface WeatherFields {
  light: { x: number; y: number } | null;
  fog: Float32Array;
  fogW: number;
  fogH: number;
  gusts: Gust[];
}
export interface World {
  seed: number;
  rngState: number;
  tick: number;
  day: number;
  ticksPerDay: number;
  season: Season;
  valleyId: string;
  nextId: number;
  artStreak: number;
  creatures: Creature[];
  ties: Map<string, Tie>;
  fields: WeatherFields;
  bushes: Bush[];
  structures: Structure[];
  rumors: Rumor[];
  boosts: BehaviorBoost[];
  /** Water rectangles (ADR 0012 item 3), set only when the scenario has them. */
  water?: Rect[];
  /** The east ridge: a wandering creature at or past it leaves for good. Set only with the scenario's. */
  ridgeX?: number;
  /**
   * The dew mushroom (ADR 0012 item 5), set only with the scenario's: today's `drops`, how many
   * were `taken` today, and the withered dawns left, counting today's (0 when not withered).
   */
  mushroom?: { x: number; y: number; drops: number; taken: number; witherDays: number };
  /** Set only with the scenario's: a creature may bid to the sky at dusk (ADR 0012 item 4). */
  ambientSkyBids?: true;
  /** Set only with the scenario's: a holder of the latest rumor shares it first at dusk (ADR 0012 item 15). */
  rumorFirst?: true;
  /** Set only with the scenario's: a giver with mutual friends forgives as they do, when they forgive more (ADR 0012 item 16). */
  friendsForgive?: true;
  /**
   * The player's hero (ADR 0013 items 1 and 2), set only with the scenario's: its kind, its standing
   * manner, the creature it waved at (`walk` with `to`), and its keepsakes. `waveTo` clears when the
   * two meet, when water stops the hero, when that creature goes away, and on a `walk` to a point.
   */
  hero?: { kind: HeroKind; reply: BidReply; gift: GiftMove; waveTo: string | null; keepsakes: string[] };
}
export type Command =
  | { t: 'shine'; x: number; y: number }
  | { t: 'paintFog'; x: number; y: number; r: number; amount: number }
  | { t: 'blow'; x: number; y: number; dx: number; dy: number }
  | { t: 'place'; kind: 'bench' | 'bush' | 'bridge' | 'lantern'; x: number; y: number }
  | { t: 'thread'; a: string; b: string; on: boolean }
  | { t: 'whisper'; target: string; about: string; sign: 1 | -1 }
  | { t: 'respond'; to: string; reply: BidReply }
  | { t: 'arrangeMeeting'; a: string; b: string }
  | { t: 'setSeason'; season: Season }
  | { t: 'wake'; who: string }
  | { t: 'promptSkyBid'; who: string }
  | { t: 'overPoke' }
  | { t: 'dance'; who: string }
  | { t: 'walk'; x: number; y: number }
  | { t: 'walk'; to: string }
  | { t: 'manner'; reply: BidReply; gift: GiftMove };
export type SimEvent =
  | { t: 'bid'; from: string; to: string; reply: BidReply; seenAs: BidReply }
  | { t: 'gift'; from: string; to: string; move: GiftMove; seenAs: GiftMove }
  | { t: 'opinion'; holder: string; about: string; value: number }
  | { t: 'imitate'; who: string; from: string; dial: DialKey }
  | { t: 'arrive' | 'leave' | 'return'; who: string }
  | { t: 'art'; who: string; kind: 'stack' | 'spiral' | 'chime' }
  | { t: 'skyBid'; who: string; ambient?: true } // ambient: a dusk bid of its own (ADR 0012 item 4)
  | { t: 'wake'; who: string }
  | { t: 'lit'; a: string; b: string; behaviors: Behavior[] }
  | { t: 'dance'; who: string }
  | { t: 'mushroom'; taken: number; drops: number };
export interface Scenario {
  valleyId: string;
  season: Season;
  ticksPerDay?: number;
  creatures: {
    id: string;
    speciesId: string;
    name: string;
    x: number;
    y: number;
    berries: number;
    dials: Dials;
    shell?: Shell;
    state?: CreatureState;
    skyWarmth?: number;
    gone?: true;
    danceThreshold?: number;
  }[];
  /** Ties that start already met (ADR 0012 item 1). A pair listed twice keeps the later entry. */
  ties?: { a: string; b: string; ab: Side; ba: Side }[];
  bushes: { id: string; x: number; y: number; berries: number }[];
  structures: Structure[];
  water?: Rect[];
  ridgeX?: number;
  mushroom?: { x: number; y: number };
  ambientSkyBids?: true;
  rumorFirst?: true;
  friendsForgive?: true;
  /**
   * The player's hero, added as the last creature (ADR 0013 item 1). `rumor` is the reputation it
   * brings from the last valley (ADR 0013 item 8), or null.
   */
  hero?: {
    kind: HeroKind;
    name: string;
    x: number;
    y: number;
    berries: number;
    keepsakes: string[];
    rumor: { value: number; strength: number } | null;
  };
}
