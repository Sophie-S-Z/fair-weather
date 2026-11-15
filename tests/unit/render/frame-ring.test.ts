import { describe, expect, it } from 'vitest';
import { createFrameRing } from '../../../src/render/frame-ring.ts';

const OPTS = { seconds: 5, fps: 12, width: 480, aspect: 900 / 1600 } as const;

/** A ring whose captures are numbered from 1, in each capture's first byte, with the sizes it asked for. */
function ring() {
  const asked: [number, number][] = [];
  let n = 0;
  const r = createFrameRing((w, h) => {
    asked.push([w, h]);
    n += 1;
    return Uint8ClampedArray.of(n);
  }, OPTS);
  return { r, asked };
}

describe('createFrameRing', () => {
  it('captures 480 x 270 for a 1600 x 900 scene', () => {
    const { r, asked } = ring();
    r.offer(0);
    expect(asked).toEqual([[480, 270]]);
    expect(r.frames()[0]).toMatchObject({ width: 480, height: 270 });
  });

  it('captures once for offers 10 ms apart', () => {
    const { r, asked } = ring();
    for (let t = 0; t < 80; t += 10) r.offer(t);
    expect(asked).toHaveLength(1);
    r.offer(1000 / 12);
    expect(asked).toHaveLength(2);
  });

  it('keeps at most 60 frames and none older than 5 s before the newest', () => {
    const { r, asked } = ring();
    // An offer each millisecond for 20 s: a capture each 84 ms, at 0, 84, ..., 19992.
    for (let t = 0; t < 20_000; t += 1) r.offer(t);
    expect(asked).toHaveLength(239);
    const frames = r.frames();
    expect(frames).toHaveLength(60);
    // The newest 60 captures, from 15036 ms on.
    expect(frames.map((f) => f.data[0])).toEqual(Array.from({ length: 60 }, (_, i) => 180 + i));

    const slow = ring().r;
    for (let i = 0; i < 20; i += 1) slow.offer(i * 1000);
    // At 19 s the captures at 14 s to 19 s are within 5 s.
    expect(slow.frames().map((f) => f.data[0])).toEqual([15, 16, 17, 18, 19, 20]);
  });

  it('gives each frame the time to the next capture, and the last one the mean', () => {
    const { r } = ring();
    for (const t of [0, 100, 300, 400]) r.offer(t);
    expect(r.frames().map((f) => f.delayMs)).toEqual([100, 200, 100, 400 / 3]);
  });

  it('gives a lone frame the capture gap', () => {
    const { r } = ring();
    r.offer(5);
    expect(r.frames().map((f) => f.delayMs)).toEqual([1000 / 12]);
  });

  it('clear empties the ring, and the next offer captures at once', () => {
    const { r, asked } = ring();
    r.offer(0);
    r.clear();
    expect(r.frames()).toEqual([]);
    r.offer(10);
    expect(asked).toHaveLength(2);
  });
});
