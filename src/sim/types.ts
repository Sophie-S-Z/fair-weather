// Core sim types (spec 9, ADRs 0002 to 0005). Types, plus the fixed dial order.
export type { Tuning } from './tuning.ts';
export const SEASONS = ['spring', 'summer', 'lateSummer', 'autumn', 'winter', 'thaw'] as const;
export type Season = (typeof SEASONS)[number];
export type CreatureState = 'wander' | 'meet' | 'sleep' | 'leave' | 'away';
export type BidReply = 'toward' | 'away' | 'against';
export type GiftMove = 'give' | 'keep';
export type Behavior = 'toward' | 'against' | 'give' | 'keep';
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
export interface Structure {
  id: string;
  kind: 'bench';
  x: number;
  y: number;
}
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
}
export type Command =
  | { t: 'shine'; x: number; y: number }
  | { t: 'paintFog'; x: number; y: number; r: number; amount: number }
  | { t: 'blow'; x: number; y: number; dx: number; dy: number }
  | { t: 'place'; kind: 'bench' | 'bush'; x: number; y: number }
  | { t: 'thread'; a: string; b: string; on: boolean }
  | { t: 'whisper'; target: string; about: string; sign: 1 | -1 }
  | { t: 'respond'; to: string; reply: BidReply }
  | { t: 'arrangeMeeting'; a: string; b: string }
  | { t: 'setSeason'; season: Season }
  | { t: 'wake'; who: string }
  | { t: 'promptSkyBid'; who: string }
  | { t: 'overPoke' };
export type SimEvent =
  | { t: 'bid'; from: string; to: string; reply: BidReply; seenAs: BidReply }
  | { t: 'gift'; from: string; to: string; move: GiftMove; seenAs: GiftMove }
  | { t: 'opinion'; holder: string; about: string; value: number }
  | { t: 'imitate'; who: string; from: string; dial: DialKey }
  | { t: 'arrive' | 'leave' | 'return'; who: string }
  | { t: 'art'; who: string; kind: 'stack' | 'spiral' | 'chime' }
  | { t: 'skyBid'; who: string }
  | { t: 'wake'; who: string };
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
  }[];
  /** Ties that start already met (ADR 0012 item 1). */
  ties?: { a: string; b: string; ab: Side; ba: Side }[];
  bushes: { id: string; x: number; y: number; berries: number }[];
  structures: Structure[];
}
