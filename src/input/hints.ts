// One ghost-hand hint per new verb, after idleMs of no player activity. Never repeats a verb, and
// never shows one the player has already used.
import type { Verb } from '../story/verbs.ts';

export type Hints = {
  unlock(v: Verb): void;
  activity(): void;
  /** The player used `v`: its hint is dropped and never shows. Also counts as activity. */
  used(v: Verb): void;
  onHint(cb: (v: Verb) => void): void;
  dispose(): void;
};

export type HintTimer = {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
};

/** The page clock: setTimeout and clearTimeout. */
export const realTimer: HintTimer = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => {
    clearTimeout(h as ReturnType<typeof setTimeout>);
  },
};

export function createHints(idleMs = 10000, timer: HintTimer = realTimer): Hints {
  const pending: Verb[] = [];
  const shown = new Set<Verb>();
  const known = new Set<Verb>();
  const listeners: Array<(v: Verb) => void> = [];
  let handle: unknown = null;

  const stop = (): void => {
    if (handle !== null) timer.clear(handle);
    handle = null;
  };
  const arm = (): void => {
    stop();
    if (pending.length === 0) return;
    handle = timer.set(() => {
      handle = null;
      const v = pending.shift();
      if (v === undefined || shown.has(v)) return;
      shown.add(v);
      for (const cb of listeners) cb(v);
      arm();
    }, idleMs);
  };

  return {
    unlock(v) {
      if (known.has(v)) return;
      known.add(v);
      pending.push(v);
      arm();
    },
    activity: arm,
    used(v) {
      known.add(v);
      shown.add(v);
      const i = pending.indexOf(v);
      if (i >= 0) pending.splice(i, 1);
      arm();
    },
    onHint(cb) {
      listeners.push(cb);
    },
    dispose() {
      stop();
      listeners.length = 0;
      pending.length = 0;
    },
  };
}
