// The worker message protocol (ADR 0009). Types only, so every module may import it.
import type { Command, CreatureState, Scenario, Shell, SimEvent, Structure, World } from '../sim/types.ts';

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
  }[];
  /** The light lens. */
  light: { x: number; y: number } | null;
  fog: { w: number; h: number; cells: Float32Array };
  /** Whole-world numbers the story reads (ADR 0011 item 3). */
  metrics: { averageWarmth: number; friendPairs: number };
  structures: Structure[];
}

/**
 * Main thread to worker. `tuning` is raw tuning JSON, parsed in the worker. `checkpoint` is a
 * structured clone of a World from a `checkpoint` message. A new worker starts paused.
 * `advance` steps `ticks` ticks at once; only tests and dev pages send it.
 */
export type ToWorker =
  | { t: 'init'; seed: number; tuning: unknown; scenario: Scenario; checkpoint?: World }
  | { t: 'commands'; list: Command[] }
  | { t: 'speed'; multiplier: number }
  | { t: 'hash' }
  | { t: 'advance'; ticks: number };

/**
 * Worker to main thread. `accepted.tick` and `events.tick` are the tick the step ran;
 * `snapshot`, `checkpoint`, and `hash` carry `world.tick` after it, the next tick to run.
 * `lastGoodTick` is `world.tick` before the step that failed.
 */
export type FromWorker =
  | { t: 'accepted'; tick: number; list: Command[] }
  | { t: 'snapshot'; tick: number; lite: WorldLite }
  | { t: 'events'; tick: number; list: SimEvent[] }
  | { t: 'checkpoint'; tick: number; world: World }
  | { t: 'hash'; tick: number; value: string }
  | { t: 'error'; message: string; lastGoodTick: number };

export interface SimPort {
  send(list: Command[]): void;
  onMessage(cb: (m: FromWorker) => void): () => void;
  requestHash(): Promise<{ tick: number; value: string }>;
  /** Sets the sim speed multiplier; 0 pauses (ADR 0011). */
  speed(multiplier: number): void;
}
