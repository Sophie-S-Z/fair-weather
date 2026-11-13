// The worker message protocol (ADR 0009). Types only, so every module may import it.
import type {
  BidReply,
  Command,
  CreatureState,
  Dials,
  GiftMove,
  HeroKind,
  Rect,
  Scenario,
  Shell,
  SimEvent,
  Structure,
  World,
} from '../sim/types.ts';
import type { Deck } from '../sim/land.ts';

/** What render, audio, and ui read from a step (ADR 0009 item 4). */
export interface WorldLite {
  creatures: {
    id: string;
    speciesId: string;
    x: number;
    y: number;
    state: CreatureState;
    shell: Shell;
    berries: number;
    skyWarmth: number;
    dials: Dials;
    dancing: boolean;
    /** Left over the ridge for good (ADR 0012 item 3). */
    gone: boolean;
  }[];
  /** Every tie's two warmths, in tie-key order (ADR 0012 item 2). */
  ties: { a: string; b: string; ab: number; ba: number }[];
  /**
   * The latest rumor. `holders` are the creatures, not away and not `about`, whose opinion of
   * `about` has its sign and is at least opinion.holdAt in size, in id order.
   */
  rumor: { about: string; sign: 1 | -1; holders: string[] } | null;
  /**
   * The player's hero (ADR 0013 items 1 and 2), or null without one. `opinions` holds each other
   * creature's opinion of the hero, only where it has one.
   */
  hero: {
    kind: HeroKind;
    name: string;
    reply: BidReply;
    gift: GiftMove;
    keepsakes: string[];
    opinions: Record<string, number>;
  } | null;
  /**
   * The valley's rule pack (ADR 0013 items 4 to 6), or null without one. Murmuration Fen: the
   * creatures in flight, the hero among them while it has joined, in creature order, and each
   * starling's perceived share (the reflection, ADR 0007). Hearsay Hollow: each creature's fame,
   * from 0 to at most hollow.fameStep × knack.bellPrints / hollow.fameFade (not capped at 1), and
   * `front`, the last print's subject, or null. Halcyon: Wisp's choice, or null (item 7).
   */
  pack:
    | { id: 'fen'; flying: string[]; perceived: Record<string, number> }
    | { id: 'hollow'; fame: Record<string, number>; front: string | null }
    | { id: 'halcyon'; chose: 'home' | 'stay' | null }
    | null;
  /** The light lens. */
  light: { x: number; y: number } | null;
  /** The fog the sim uses in each cell: the cell's fog, lessened at a cell center near a lantern. */
  fog: { w: number; h: number; cells: Float32Array };
  /** Whole-world numbers the story reads (ADR 0011 item 3). */
  metrics: { averageWarmth: number; friendPairs: number };
  structures: Structure[];
  bushes: { id: string; x: number; y: number; berries: number }[];
  /** The water rectangles; [] with none. */
  water: Rect[];
  /** water[i] grown by its bank (sim/land.ts withBank), where feet off a deck may not stand; [] with none. */
  banks: Rect[];
  /** Each bridge's deck (sim/land.ts bridgeDeck), in structure order; [] with none. */
  decks: Deck[];
  /** Ground the water closes in (sim/land.ts islets); [] with none. */
  islets: Rect[];
  /** The dew mushroom, with the drops left today; null with none. */
  mushroom: { x: number; y: number; drops: number; witherDays: number } | null;
}

/**
 * Main thread to worker. `tuning` is raw tuning JSON, parsed in the worker. `checkpoint` is a
 * structured clone of a World from a `checkpoint` message. A new worker starts paused.
 * `checkpoint` asks for a `checkpoint` message with the world now, between steps; the answer
 * carries the request's `id`, and a daily checkpoint (at dusk) carries none.
 * `advance` steps `ticks` ticks at once; only tests and dev pages send it.
 * `rewind` asks for the world at an earlier tick without changing the run (ADR 0012 item 10).
 * `fastForward` steps `ticks` ticks silently, keeping the dusk copies for rewind, and answers
 * with one `forwarded` (Kith's run while the player is away, ADR 0013 item 10).
 */
export type ToWorker =
  | { t: 'init'; seed: number; tuning: unknown; scenario: Scenario; checkpoint?: World }
  | { t: 'commands'; list: Command[] }
  | { t: 'speed'; multiplier: number }
  | { t: 'hash' }
  | { t: 'checkpoint'; id?: number }
  | { t: 'advance'; ticks: number }
  | { t: 'rewind'; tick: number; id: number }
  | { t: 'fastForward'; ticks: number; id: number };

/**
 * Worker to main thread. `accepted.tick` and `events.tick` are the tick the step ran;
 * `snapshot`, `checkpoint`, and `hash` carry `world.tick` after it, the next tick to run.
 * `lastGoodTick` is `world.tick` before the step that failed. `rewound` answers the `rewind` with
 * the same `id`; its `tick` is the requested tick clamped to [the first world's tick, now].
 * `forwarded` answers the `fastForward` with the same `id`, with the world after it; no events,
 * snapshot, or checkpoint come for the ticks it ran.
 */
export type FromWorker =
  | { t: 'accepted'; tick: number; list: Command[] }
  | { t: 'snapshot'; tick: number; lite: WorldLite }
  | { t: 'events'; tick: number; list: SimEvent[] }
  | { t: 'checkpoint'; tick: number; world: World; id?: number }
  | { t: 'hash'; tick: number; value: string }
  | { t: 'error'; message: string; lastGoodTick: number }
  | { t: 'rewound'; id: number; tick: number; lite: WorldLite }
  | { t: 'forwarded'; id: number; tick: number; lite: WorldLite };

export interface SimPort {
  send(list: Command[]): void;
  onMessage(cb: (m: FromWorker) => void): () => void;
  requestHash(): Promise<{ tick: number; value: string }>;
  /** Sets the sim speed multiplier; 0 pauses (ADR 0011). */
  speed(multiplier: number): void;
}
