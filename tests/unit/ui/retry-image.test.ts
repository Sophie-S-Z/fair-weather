import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { retryImage } from '../../../src/ui/retry-image.ts';

/** The parts of an image the action uses: a src, and listeners for `load` and `error`. */
function fakeImage(src: string) {
  const listeners = new Map<string, Set<() => void>>();
  const node = {
    src,
    getAttribute: (name: string) => (name === 'src' ? node.src : null),
    setAttribute: (name: string, value: string) => {
      if (name === 'src') node.src = value;
    },
    addEventListener: (type: string, cb: () => void) => {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(cb));
    },
    removeEventListener: (type: string, cb: () => void) => listeners.get(type)?.delete(cb),
    emit: (type: string) => {
      for (const cb of [...(listeners.get(type) ?? [])]) cb();
    },
    /** The image fails: its error event, then the timers and the promises that follow it settle. */
    fail: async () => {
      node.emit('error');
      await vi.advanceTimersByTimeAsync(0);
    },
    count: () => [...listeners.values()].reduce((n, set) => n + set.size, 0),
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

test('a failed image tries again after each wait with ?retry=n, then shows the fallback, then stops', async () => {
  const img = fakeImage('/a.svg');
  retryImage(asImage(img), { waits: [1000, 2000], fallback: '/scene.svg' });
  await img.fail();
  expect(img.src).toBe('/a.svg');
  await vi.advanceTimersByTimeAsync(999);
  expect(img.src).toBe('/a.svg');
  await vi.advanceTimersByTimeAsync(1);
  expect(img.src).toBe('/a.svg?retry=1');
  await img.fail();
  await vi.advanceTimersByTimeAsync(2000);
  expect(img.src).toBe('/a.svg?retry=2');
  await img.fail();
  expect(img.src).toBe('/scene.svg');
  await img.fail();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(img.src).toBe('/scene.svg');
});

test('with no fallback the last failure leaves the image as it is, for its alt text', async () => {
  const img = fakeImage('/a.svg?v=3');
  retryImage(asImage(img), { waits: [1000], fallback: null });
  await img.fail();
  await vi.advanceTimersByTimeAsync(1000);
  expect(img.src).toBe('/a.svg?v=3&retry=1');
  await img.fail();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(img.src).toBe('/a.svg?v=3&retry=1');
});

test('an image that loads stops the tries, and a fallback equal to the source is not tried again', async () => {
  const img = fakeImage('/a.svg');
  retryImage(asImage(img), { waits: [1000], fallback: null });
  await img.fail();
  await vi.advanceTimersByTimeAsync(1000);
  img.emit('load');
  await vi.advanceTimersByTimeAsync(0);
  expect(img.count()).toBe(0);

  const same = fakeImage('/a.svg');
  retryImage(asImage(same), { waits: [], fallback: '/a.svg' });
  await same.fail();
  await vi.advanceTimersByTimeAsync(0);
  expect(same.src).toBe('/a.svg');
  expect(same.count()).toBe(0);
});

test('a data URL is set again as it is, and destroy stops a wait and removes the listeners', async () => {
  const img = fakeImage('data:image/svg+xml;base64,AAAA');
  const action = retryImage(asImage(img), { waits: [1000], fallback: null });
  await img.fail();
  await vi.advanceTimersByTimeAsync(1000);
  expect(img.src).toBe('data:image/svg+xml;base64,AAAA');
  action.destroy();
  const other = fakeImage('/b.svg');
  const second = retryImage(asImage(other), { waits: [1000], fallback: null });
  await other.fail();
  second.destroy();
  await vi.advanceTimersByTimeAsync(5000);
  expect(other.src).toBe('/b.svg');
  expect(other.count()).toBe(0);
  expect(img.count()).toBe(0);
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
  // A fallback that is the source has failed already.
  tried.length = 0;
  expect(await tryThenFallback(never, '/a.svg', [], '/a.svg', wait)).toBeNull();
  expect(tried).toEqual(['/a.svg']);
});
