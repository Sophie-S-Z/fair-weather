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

// The PNG export loads by the same rule as the action: the waits, then the fallback once.
test('tryThenFallback tries the source after each wait, then the fallback once, then gives up', async () => {
  const { tryThenFallback } = await import('../../../src/ui/retry-image.ts');
  const tried: string[] = [];
  const waited: number[] = [];
  const wait = (ms: number) => {
    waited.push(ms);
    return Promise.resolve();
  };
  const never = (src: string) => {
    tried.push(src);
    return Promise.resolve(null);
  };
  expect(await tryThenFallback(never, '/a.svg', [1000, 2000], '/scene.svg', wait)).toBeNull();
  expect(tried).toEqual(['/a.svg', '/a.svg?retry=1', '/a.svg?retry=2', '/scene.svg']);
  expect(waited).toEqual([1000, 2000]);

  tried.length = 0;
  expect(await tryThenFallback(never, '/a.svg', [1000], null, wait)).toBeNull();
  expect(tried).toEqual(['/a.svg', '/a.svg?retry=1']);

  const second = (src: string) => {
    tried.push(src);
    return Promise.resolve(src.endsWith('retry=1') ? 'ok' : null);
  };
  tried.length = 0;
  expect(await tryThenFallback(second, '/a.svg', [1000, 2000], '/scene.svg', wait)).toBe('ok');
  expect(tried).toEqual(['/a.svg', '/a.svg?retry=1']);
});
