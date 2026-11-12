// Over-poke detector (spec 9): more than `count` pokes inside `windowSeconds` fires once, then resets.
/** `clock` returns milliseconds; `windowSeconds` is in seconds. */
export function createOverPoke(
  windowSeconds: number,
  count: number,
  clock: () => number,
): { poke(): boolean } {
  let times: number[] = [];
  return {
    poke() {
      const now = clock();
      times = times.filter((t) => now - t < windowSeconds * 1000);
      times.push(now);
      if (times.length > count) {
        times = [];
        return true;
      }
      return false;
    },
  };
}
