import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { retryImage } from '../../../src/ui/retry-image.ts';

/** The parts of an image the action uses: a src, and listeners for `error`. */
function fakeImage(src: string) {
  const listeners = new Set<() => void>();
  const node = {
    src,
    getAttribute: (name: string) => (name === 'src' ? node.src : null),
    setAttribute: (name: string, value: string) => {
      if (name === 'src') node.src = value;
    },
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    fail: () => {
      for (const cb of [...listeners]) cb();
    },
    listeners,
  };
  return node;
}
const asImage = (n: ReturnType<typeof fakeImage>) => n as unknown as HTMLImageElement;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test('a failed image tries again after each wait with ?retry=n, then shows the fallback, then stops', () => {
  const img = fakeImage('/a.svg');
  retryImage(asImage(img), { waits: [1000, 2000], fallback: '/scene.svg' });
  img.fail();
  expect(img.src).toBe('/a.svg');
  vi.advanceTimersByTime(999);
  expect(img.src).toBe('/a.svg');
  vi.advanceTimersByTime(1);
  expect(img.src).toBe('/a.svg?retry=1');
  img.fail();
  vi.advanceTimersByTime(2000);
  expect(img.src).toBe('/a.svg?retry=2');
  img.fail();
  expect(img.src).toBe('/scene.svg');
  img.fail();
  expect(img.src).toBe('/scene.svg');
  vi.advanceTimersByTime(10_000);
  expect(img.src).toBe('/scene.svg');
});

test('with no fallback the third failure leaves the image as it is, for its alt text', () => {
  const img = fakeImage('/a.svg?v=3');
  retryImage(asImage(img), { waits: [1000], fallback: null });
  img.fail();
  vi.advanceTimersByTime(1000);
  expect(img.src).toBe('/a.svg?v=3&retry=1');
  img.fail();
  expect(img.src).toBe('/a.svg?v=3&retry=1');
  img.fail();
  vi.advanceTimersByTime(10_000);
  expect(img.src).toBe('/a.svg?v=3&retry=1');
});

test('a data URL is set again as it is, and destroy stops a wait and removes the listener', () => {
  const img = fakeImage('data:image/svg+xml;base64,AAAA');
  const action = retryImage(asImage(img), { waits: [1000], fallback: null });
  img.fail();
  vi.advanceTimersByTime(1000);
  expect(img.src).toBe('data:image/svg+xml;base64,AAAA');
  const other = fakeImage('/b.svg');
  const second = retryImage(asImage(other), { waits: [1000], fallback: null });
  other.fail();
  second.destroy();
  vi.advanceTimersByTime(5000);
  expect(other.src).toBe('/b.svg');
  expect(other.listeners.size).toBe(0);
  action.destroy();
});
