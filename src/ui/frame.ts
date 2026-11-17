import type { Ticker } from 'pixi.js';
import type { Look, TableView } from '../render/table-view.ts';
import { DISCOVERIES } from '../toy/discoveries/index.ts';
import { DT, step } from '../toy/step.ts';
import type { Table, ToyEvent } from '../toy/types.ts';

/** The longest real time one frame may catch up, so a hidden tab does not run the table fast. */
const MAX_CATCH_UP = 0.25;

export interface Frame {
  /** The table to step; read each frame, so a loop can swap in a fresh one. */
  table(): Table;
  look(): Look;
  /** Runs before each fixed step: timed cues in lesson loops. */
  beforeStep?(t: Table): void;
  events?(events: ToyEvent[]): void;
  pending?(): { from: string; x: number; y: number } | null;
  /** Runs after each drawn frame: the HTML overlay follows the creatures. */
  drawn?(): void;
}

/** Steps a table at the fixed rate and draws it once per Pixi tick. Returns a stop function. */
export function runFrames(ticker: Ticker, view: TableView, frame: Frame): () => void {
  let carry = 0;
  const tick = (tk: Ticker): void => {
    carry = Math.min(MAX_CATCH_UP, carry + tk.deltaMS / 1000);
    const t = frame.table();
    while (carry >= DT) {
      frame.beforeStep?.(t);
      step(t, DISCOVERIES);
      carry -= DT;
      if (t.events.length > 0) frame.events?.(t.events.splice(0));
    }
    view.update(t, performance.now() / 1000, frame.look(), frame.pending?.() ?? null);
    frame.drawn?.();
  };
  ticker.add(tick);
  return () => ticker.remove(tick);
}
