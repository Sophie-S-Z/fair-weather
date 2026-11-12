// The worker message protocol (ADR 0009). Types only, so every module may import it.
import type {
  Command,
  CreatureState,
  Dials,
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
 */
export type ToWorker =
  | { t: 'init'; seed: number; tuning: unknown; scenario: Scenario; checkpoint?: World }
  | { t: 'commands'; list: Command[] }
  | { t: 'speed'; multiplier: number }
  | { t: 'hash' }
  | { t: 'checkpoint'; id?: number }
  | { t: 'advance'; ticks: number }
  | { t: 'rewind'; tick: number; id: number };

/**
 * Worker to main thread. `accepted.tick` and `events.tick` are the tick the step ran;
 * `snapshot`, `checkpoint`, and `hash` carry `world.tick` after it, the next tick to run.
 * `lastGoodTick` is `world.tick` before the step that failed. `rewound` answers the `rewind` with
 * the same `id`; its `tick` is the requested tick clamped to [the first world's tick, now].
 */
export type FromWorker =
  | { t: 'accepted'; tick: number; list: Command[] }
  | { t: 'snapshot'; tick: number; lite: WorldLite }
  | { t: 'events'; tick: number; list: SimEvent[] }
  | { t: 'checkpoint'; tick: number; world: World; id?: number }
  | { t: 'hash'; tick: number; value: string }
  | { t: 'error'; message: string; lastGoodTick: number }
  | { t: 'rewound'; id: number; tick: number; lite: WorldLite };

export interface SimPort {
  send(list: Command[]): void;
  onMessage(cb: (m: FromWorker) => void): () => void;
  requestHash(): Promise<{ tick: number; value: string }>;
  /** Sets the sim speed multiplier; 0 pauses (ADR 0011). */
  speed(multiplier: number): void;
}
