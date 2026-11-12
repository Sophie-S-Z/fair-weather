import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { HintTimer } from '../../../src/input/hints.ts';
import { createWait } from '../../../src/input/wait.ts';

const timer: HintTimer = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => {
    clearTimeout(h as ReturnType<typeof setTimeout>);
  },
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test('wait fires once after 180 s idle, and again only after activity and 180 s more', () => {
  const wait = createWait(180_000, timer);
  const visits = vi.fn();
  wait.onVisit(visits);
  vi.advanceTimersByTime(179_999);
  expect(visits).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(visits).toHaveBeenCalledTimes(1);
  // No activity: it does not come again.
  vi.advanceTimersByTime(600_000);
  expect(visits).toHaveBeenCalledTimes(1);
  // Activity starts a new full wait.
  wait.activity();
  vi.advanceTimersByTime(179_999);
  expect(visits).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  expect(visits).toHaveBeenCalledTimes(2);
});

test('activity puts the wait back to its start, and dispose and the returned off stop it', () => {
  const wait = createWait(180_000, timer);
  const visits = vi.fn();
  const off = wait.onVisit(visits);
  vi.advanceTimersByTime(170_000);
  wait.activity();
  vi.advanceTimersByTime(170_000);
  expect(visits).not.toHaveBeenCalled();
  off();
  vi.advanceTimersByTime(10_000);
  expect(visits).not.toHaveBeenCalled();

  const other = vi.fn();
  wait.onVisit(other);
  wait.activity();
  wait.dispose();
  vi.advanceTimersByTime(600_000);
  expect(other).not.toHaveBeenCalled();
});
