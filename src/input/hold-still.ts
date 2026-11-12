// The Long Night (spec 6.4): how long the cursor has rested.

/** A move within this many pixels of where the cursor rests is a hand's tremor, not a move. */
const SLACK = 4;

/**
 * `clock` returns milliseconds. `held()` is the seconds since the cursor last moved more than 4
 * pixels from where it rested, or since the start when it never moved.
 */
export function createHoldStill(clock: () => number): { move(x: number, y: number): void; held(): number } {
  let since = clock();
  let rest: { x: number; y: number } | null = null;
  return {
    move(x, y) {
      if (rest !== null && Math.hypot(x - rest.x, y - rest.y) <= SLACK) return;
      // The first move only says where the cursor is.
      if (rest !== null) since = clock();
      rest = { x, y };
    },
    held() {
      return (clock() - since) / 1000;
    },
  };
}
