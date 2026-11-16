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
/** The valleys' rule packs (ADR 0013 item 4, ADR 0015 items 3 to 5). */
export type PackId = 'fen' | 'hollow' | 'halcyon' | 'foglight' | 'council' | 'shallows';
/** Toadstool Council's voting rules (ADR 0015 item 4), plurality first. */
export const VOTING_RULES = ['plurality', 'approval', 'runoff', 'score'] as const;
export type VotingRule = (typeof VOTING_RULES)[number];
/** Lily Shallows' songs (ADR 0015 item 5). */
export const SONGS = ['reed', 'rain', 'old'] as const;
export type Song = (typeof SONGS)[number];
/** The player's local verb, passed to the world's rule pack (ADR 0013 item 4, ADR 0015 item 6). */
export type LocalVerb =
  | { verb: 'join'; on: boolean }
  | { verb: 'pose' }
  | { verb: 'keepsake'; to: string; item: string }
  | { verb: 'stepDown'; on: boolean }
  | { verb: 'vote'; spot: string }
  | { verb: 'propose'; rule: Exclude<VotingRule, 'plurality'> }
  | { verb: 'learn'; from: string }
  | { verb: 'sing'; to: string };
/**
 * Murmuration Fen's flock (ADR 0013 item 5): each starling's threshold, the starlings in flight in
 * creature order, the restless ones that never land, and whether the hero has joined.
 */
export interface FenState {
  id: 'fen';
  thresholds: Record<string, number>;
  flying: string[];
  restless: string[];
  heroFlying: boolean;
}
/**
 * Hearsay Hollow's town (ADR 0013 item 6): the drama sky, one drama entry per subject (its total
 * score, the spot and day of its newest drama, and whether that drama came from a meeting with the
 * hero or a `pose`), each creature's fame, and the subject of the last print, or null. Fame runs
 * from 0 to at most hollow.fameStep × knack.bellPrints / hollow.fameFade (4 by default); it is not
 * capped at 1.
 */
export interface HollowState {
  id: 'hollow';
  sky: { x: number; y: number };
  drama: { subject: string; x: number; y: number; score: number; day: number; hero: boolean }[];
  fame: Record<string, number>;
  front: string | null;
}
/**
 * Halcyon (ADR 0013 item 7): Kith's average warmth the scenario gives, the creature that chooses
 * (Wisp), whether it has been given a keepsake, and its choice, made once at a dusk, or null.
 */
export interface HalcyonState {
  id: 'halcyon';
  kithWarmth: number;
  seeker: string;
  given: boolean;
  chose: 'home' | 'stay' | null;
}
/**
 * Foglight Heights (ADR 0015 item 3): the height map, one integer from 0 to 9 per foglight.cell
 * square in row-major order with `cols` cells a row, the least height of the high meadow, the
 * guide (Brume), whether it follows the hero, and whether the hero may step down.
 */
export interface FoglightState {
  id: 'foglight';
  cols: number;
  heights: number[];
  meadow: number;
  guide: string;
  following: boolean;
  stepDown: boolean;
}
/** A council spot (ADR 0015 item 4): a scene point and a point on the preference map. */
export interface CouncilSpot {
  id: string;
  x: number;
  y: number;
  wet: number;
  far: number;
}
/**
 * Toadstool Council (ADR 0015 item 4): the four spots, each voter's preference point, the rule the
 * next tally uses, the rule the hero proposed (null before), whether the council has heard it,
 * the spot the hero voted for (null before), and the last winner (null before the first tally).
 */
export interface CouncilState {
  id: 'council';
  spots: CouncilSpot[];
  prefs: Record<string, { wet: number; far: number }>;
  rule: VotingRule;
  proposed: VotingRule | null;
  heard: boolean;
  heroVote: string | null;
  winner: string | null;
}
/**
 * Lily Shallows (ADR 0015 item 5): the pads, each frog's pad and slot, each frog's songs, the
 * hero's song (null before it learns one), whether the variety rule is on, and whether the pond
 * has settled once.
 */
export interface ShallowsState {
  id: 'shallows';
  pads: { id: string; x: number; y: number }[];
  padOf: Record<string, string>;
  slotOf: Record<string, number>;
  songs: Record<string, Song[]>;
  heroSong: Song | null;
  variety: boolean;
  settled: boolean;
}
export type PackState = FenState | HollowState | HalcyonState | FoglightState | CouncilState | ShallowsState;
/** A rule card's state (ADR 0015 item 8): what a creature is now, never who it is. */
export const CARD_WHENS = ['hungry', 'full', 'lonely', 'liked'] as const;
export type CardWhen = (typeof CARD_WHENS)[number];
/** A rule card's meeting move (ADR 0015 item 8): a reply, or a gift move. */
export const CARD_THENS = ['toward', 'away', 'against', 'give', 'keep'] as const;
export type CardThen = (typeof CARD_THENS)[number];
export interface RuleCard {
  when: CardWhen;
  then: CardThen;
}
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
  /**
   * A Seedcarrier's gift (ADR 0013 item 3): planted by `from`, it fills at the dusk of `readyDay`
   * and never regrows; `found` lists the creatures that have taken a berry from it, in order.
   */
  gift?: { from: string; readyDay: number; found: string[] };
}
/** An axis-aligned rectangle, edges included. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A placed structure; a path runs from (x, y) to (x2, y2) (ADR 0014 item 5). */
export type Structure =
  | { id: string; kind: 'bench' | 'bridge' | 'lantern'; x: number; y: number }
  | { id: string; kind: 'path'; x: number; y: number; x2: number; y2: number };
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
  /** The valley's rule-pack state (ADR 0013 item 4), set only with the scenario's `pack`. */
  pack?: PackState;
  /** Set only with the scenario's: the sandbox's verbs and population cap apply (ADR 0014 items 1 and 5). */
  sandbox?: true;
  /** Set only with the scenario's: the season turns every this many days (ADR 0014 item 4). */
  seasonDays?: number;
  /** Set while the gate is dark: no newcomer arrives (ADR 0014 item 5). */
  gateDark?: true;
  /** The sandbox's network switches, set only with the scenario's (ADR 0014 item 3). */
  network?: NetworkSwitches;
  /** The sandbox's rule cards, set only with the scenario's (ADR 0015 item 8). */
  cards?: RuleCard[];
}
/**
 * The advanced network switches (ADR 0014 item 3): `mutual`, a friend needs warmth above
 * friend.threshold on both sides; `weighted`, complex contagion weighs summed warmths; `drift`, an
 * adopted rumor's value drifts by up to gossip.drift.
 */
export interface NetworkSwitches {
  mutual?: true;
  weighted?: true;
  drift?: true;
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
  | { t: 'manner'; reply: BidReply; gift: GiftMove }
  | { t: 'plant' }
  | { t: 'local'; verb: LocalVerb }
  | { t: 'nudge'; dial: DialKey; amount: number }
  | { t: 'rain'; x: number; y: number }
  | { t: 'welcome'; on: boolean }
  | { t: 'path'; x: number; y: number; x2: number; y2: number };
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
  | { t: 'mushroom'; taken: number; drops: number }
  | { t: 'print'; subject: string; fame: number } // the Hollow's gazette, with the fame after the dusk fade
  | { t: 'keepsake'; to: string; item: string }
  | { t: 'goHome' | 'stay'; who: string } // Wisp's choice in Halcyon (ADR 0013 item 7)
  | { t: 'follow'; who: string } // Brume comes along in Foglight Heights (ADR 0015 item 3)
  | { t: 'tally'; rule: VotingRule; winner: string; glad: number } // the council's vote (ADR 0015 item 4)
  | { t: 'heard'; rule: VotingRule; change: number } // the council remembers who asked
  | { t: 'song'; who: string; song: Song } // a frog learns the hero's song (ADR 0015 item 5)
  | { t: 'variety' | 'settled' }; // the variety rule turns on; the pond settles once
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
    /** The shell it brings from the last valley (ADR 0013 item 1); none starts it with no shell. */
    shell?: Shell;
  };
  /**
   * The valley's rule pack (ADR 0013 items 4 to 6). Murmuration Fen: the `restless` starlings fly
   * from the start and never land, and `fixed` holds the thresholds that take no draw (Tove's 0.5).
   * Hearsay Hollow takes nothing more. Halcyon (item 7): Kith's average warmth after the postcards
   * so far (item 10), and the `seeker` who chooses, Wisp. Foglight Heights, Toadstool Council, and
   * Lily Shallows (ADR 0015 items 3 to 5): the height map and Brume; the spots, the voters'
   * preferences, and a sandbox's rule (plurality without it); the pads, each frog's pad and songs,
   * and the variety rule on from the start (sandbox and T5 only).
   */
  pack?:
    | { id: 'fen'; restless: string[]; fixed: Record<string, number> }
    | { id: 'hollow' }
    | { id: 'halcyon'; kithWarmth: number; seeker: string }
    | { id: 'foglight'; heights: number[]; meadow: number; guide: string }
    | { id: 'council'; spots: CouncilSpot[]; prefs: CouncilState['prefs']; rule?: VotingRule }
    | {
        id: 'shallows';
        pads: ShallowsState['pads'];
        padOf: Record<string, string>;
        songs: Record<string, Song[]>;
        variety?: true;
      };
  /** A sandbox world (ADR 0014 items 1 and 5). */
  sandbox?: true;
  /** The days in each season, a positive integer; without it the season never turns (ADR 0014 item 4). */
  seasonDays?: number;
  /** The fog every cell starts at, 0 to 1 (ADR 0014 item 2). */
  baseFog?: number;
  /** The network switches (ADR 0014 item 3). */
  network?: NetworkSwitches;
  /** The rule cards, at most three (ADR 0015 item 8). */
  cards?: RuleCard[];
}
