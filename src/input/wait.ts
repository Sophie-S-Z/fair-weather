// The Quiet Visitor's wait (spec 6.4, ADR 0012 item 12): real time with no input.
import type { HintTimer } from './hints.ts';

/**
 * Calls each `onVisit` listener once after `ms` with no `activity()`. It does not call them again
 * until `activity()` comes and another full `ms` passes. `onVisit` returns a function that removes
 * its listener.
 */
export function createWait(
  ms: number,
  timer: HintTimer,
): { activity(): void; onVisit(cb: () => void): () => void; dispose(): void } {
  const listeners = new Set<() => void>();
  let handle: unknown = null;
  const stop = (): void => {
    if (handle !== null) timer.clear(handle);
    handle = null;
  };
  const arm = (): void => {
    stop();
    handle = timer.set(() => {
      handle = null;
      for (const cb of [...listeners]) cb();
    }, ms);
  };
  arm();
  return {
    activity: arm,
    onVisit(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    dispose() {
      stop();
      listeners.clear();
    },
  };
}
