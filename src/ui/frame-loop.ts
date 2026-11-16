// The frame loop the game and sandbox screens share: it draws the last two live snapshots, the
// newer one tweened in over the time between them. It stops while the tab is hidden; main.ts holds
// the sim at speed 0 meanwhile.
import type { WorldLite } from '../sim-host/protocol.ts';

export interface FrameLoop {
  /** A new live snapshot: the one before it becomes the tween's start. */
  push(lite: WorldLite): void;
  /** Draws a frame on each animation frame from now on, while the tab is visible. */
  start(): void;
  /** Cancels the next frame and forgets the snapshots, so a new run does not tween from the old one. */
  stop(): void;
}

/**
 * `draw` gets the two snapshots and `alpha`, 0 at the frame time when the newer one came and 1
 * one snapshot span later; with no span (the first snapshot) it is 1. `now` is the clock a pushed
 * snapshot is timed by (the page clock, as the animation frame time is).
 */
export function createFrameLoop(
  draw: (prev: WorldLite, next: WorldLite, alpha: number) => void,
  now: () => number,
): FrameLoop {
  let prev: WorldLite | null = null;
  let next: WorldLite | null = null;
  let prevAt = 0;
  let nextAt = 0;
  let raf: number | null = null;
  let running = false;

  function frame(t: number): void {
    raf = requestAnimationFrame(frame);
    if (!prev || !next) return;
    const span = nextAt - prevAt;
    const alpha = span > 0 ? Math.min(1, Math.max(0, (t - nextAt) / span)) : 1;
    draw(prev, next, alpha);
  }
  function cancel(): void {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  }
  function onVisibility(): void {
    if (document.visibilityState === 'hidden') cancel();
    else if (raf === null) raf = requestAnimationFrame(frame);
  }

  return {
    push(lite) {
      prev = next ?? lite;
      next = lite;
      prevAt = nextAt;
      nextAt = now();
    },
    start() {
      if (running) return;
      running = true;
      document.addEventListener('visibilitychange', onVisibility);
      if (document.visibilityState !== 'hidden') raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      document.removeEventListener('visibilitychange', onVisibility);
      cancel();
      prev = next = null;
      prevAt = nextAt = 0;
    },
  };
}
