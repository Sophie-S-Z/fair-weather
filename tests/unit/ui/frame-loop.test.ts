import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import { createFrameLoop } from '../../../src/ui/frame-loop.ts';

/** A fake animation frame queue and a page whose visibility the test sets. */
let frames: Map<number, (t: number) => void>;
let nextFrame: number;
let page: EventTarget & { visibilityState: 'visible' | 'hidden' };
let clock: number;

beforeEach(() => {
  frames = new Map();
  nextFrame = 1;
  clock = 0;
  page = Object.assign(new EventTarget(), { visibilityState: 'visible' as const });
  vi.stubGlobal('document', page);
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    const id = nextFrame++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** Runs the frames now queued at time `t`. */
function runFrames(t: number): void {
  const due = [...frames.values()];
  frames.clear();
  for (const cb of due) cb(t);
}

const lite = (day: number): WorldLite => ({ day }) as WorldLite;

function loop() {
  const drawn: { prev: number; next: number; alpha: number }[] = [];
  const l = createFrameLoop(
    (prev, next, alpha) => drawn.push({ prev: prev.day, next: next.day, alpha }),
    () => clock,
  );
  return { l, drawn };
}

test('alpha is 0 at a new snapshot and 1 one snapshot span later', () => {
  const { l, drawn } = loop();
  l.start();
  runFrames(0);
  expect(drawn).toEqual([]); // nothing to draw before a snapshot
  clock = 1000;
  l.push(lite(1));
  clock = 1100;
  l.push(lite(2));
  runFrames(1100);
  runFrames(1150);
  runFrames(1200);
  runFrames(1300);
  expect(drawn).toEqual([
    { prev: 1, next: 2, alpha: 0 },
    { prev: 1, next: 2, alpha: 0.5 },
    { prev: 1, next: 2, alpha: 1 },
    { prev: 1, next: 2, alpha: 1 },
  ]);
});

test('stop cancels the frame and forgets the snapshots; start again draws from the next one', () => {
  const { l, drawn } = loop();
  l.start();
  l.push(lite(1));
  l.stop();
  expect(frames.size).toBe(0);
  runFrames(10);
  expect(drawn).toEqual([]);
  l.start();
  runFrames(20);
  expect(drawn).toEqual([]);
  l.push(lite(5));
  runFrames(30);
  expect(drawn).toEqual([{ prev: 5, next: 5, alpha: 1 }]);
});

test('the loop stops while the tab is hidden and goes on when it shows, unless stopped', () => {
  const { l, drawn } = loop();
  l.start();
  l.push(lite(1));
  page.visibilityState = 'hidden';
  page.dispatchEvent(new Event('visibilitychange'));
  expect(frames.size).toBe(0);
  page.visibilityState = 'visible';
  page.dispatchEvent(new Event('visibilitychange'));
  runFrames(5);
  expect(drawn).toHaveLength(1);
  l.stop();
  page.dispatchEvent(new Event('visibilitychange'));
  expect(frames.size).toBe(0);
});

test('start while the tab is hidden waits for it to show', () => {
  page.visibilityState = 'hidden';
  const { l } = loop();
  l.start();
  expect(frames.size).toBe(0);
  page.visibilityState = 'visible';
  page.dispatchEvent(new Event('visibilitychange'));
  expect(frames.size).toBe(1);
  l.stop();
});
