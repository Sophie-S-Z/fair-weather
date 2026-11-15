// The postcard's frames (ADR 0014 item 8): the sandbox scene of the last 5 seconds, at most 12 a
// second (the boil rate, spec 11.2), each 480 pixels wide and 480 x the scene's aspect high.
import type { RgbaFrame } from '../persist/gif.ts';

/**
 * A ring of captures. `capture` gives the scene now as `width` x `height` RGBA pixels; `aspect` is
 * the scene's height over its width. `offer` captures when at least 1000 / fps ms passed since the
 * last capture, and drops the captures older than `seconds` before the newest, and past
 * seconds x fps. A frame's delay is the time to the next capture; the last one's is the mean of
 * the others (1000 / fps for a lone frame).
 */
export function createFrameRing(
  capture: (width: number, height: number) => Uint8ClampedArray,
  opts: { seconds: 5; fps: 12; width: 480; aspect: number },
): { offer(now: number): void; frames(): RgbaFrame[]; clear(): void } {
  const { width } = opts;
  const height = Math.round(width * opts.aspect);
  const gap = 1000 / opts.fps;
  const most = opts.seconds * opts.fps;
  let shots: { at: number; data: Uint8ClampedArray }[] = [];
  return {
    offer(now) {
      const last = shots.at(-1);
      if (last && now - last.at < gap) return;
      shots.push({ at: now, data: capture(width, height) });
      shots = shots.filter((s) => now - s.at <= opts.seconds * 1000).slice(-most);
    },
    frames() {
      const spans = shots.slice(1).map((s, i) => s.at - (shots[i]?.at ?? s.at));
      const mean = spans.length > 0 ? spans.reduce((a, b) => a + b, 0) / spans.length : gap;
      return shots.map((s, i) => ({ width, height, data: s.data, delayMs: spans[i] ?? mean }));
    },
    clear() {
      shots = [];
    },
  };
}
