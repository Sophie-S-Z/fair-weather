import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  betCounts,
  createAnalytics,
  createVisibleTimer,
  fetchPost,
  type Count,
} from '../../../src/persist/analytics.ts';
import type { ActionLog } from '../../../src/story/action-log.ts';

function sink(url: string | null, on: boolean) {
  const sent: string[] = [];
  const a = createAnalytics(
    url,
    () => on,
    (_u, b) => {
      sent.push(b);
    },
  );
  return { a, sent };
}
const all: Count[] = [
  { v: 1, e: 'chapter', chapter: 'ch0' },
  { v: 1, e: 'bet', chapter: 'ch1', right: true },
  { v: 1, e: 'sandbox', minutes: 3 },
];

describe('analytics', () => {
  it('betCounts gives one count per bet with right true only when the answer is the result', () => {
    const log: ActionLog = [
      { kind: 'bet', tick: 5, id: 'b1', answer: 'yes', result: 'yes' },
      { kind: 'verb', tick: 6, input: { verb: 'wake' } as never },
      { kind: 'bet', tick: 9, id: 'b2', answer: 'no', result: 'yes' },
    ];
    expect(betCounts('ch2', log)).toEqual([
      { v: 1, e: 'bet', chapter: 'ch2', right: true },
      { v: 1, e: 'bet', chapter: 'ch2', right: false },
    ]);
  });

  it('nothing is posted while off or without a URL', () => {
    for (const [url, on] of [
      ['http://x/c', false],
      [null, true],
      [null, false],
    ] as const) {
      const { a, sent } = sink(url, on);
      for (const c of all) a.count(c);
      expect(sent).toEqual([]);
    }
  });

  it('every count body has only the keys v, e, and chapter, right, or minutes', () => {
    const { a, sent } = sink('http://x/c', true);
    const dirty = [
      { ...all[0], id: 'u1', time: 5, name: 'Pim', seed: 3 },
      { ...all[1], hero: 'Wren', order: 2 },
      { ...all[2], words: 'hello' },
    ];
    for (const c of dirty) a.count(c as Count);
    expect(sent.map((b) => Object.keys(JSON.parse(b) as object))).toEqual([
      ['v', 'e', 'chapter'],
      ['v', 'e', 'chapter', 'right'],
      ['v', 'e', 'minutes'],
    ]);
    expect(sent[0]).toBe('{"v":1,"e":"chapter","chapter":"ch0"}');
  });

  it('drops a count kind that is not in Count and a sandbox count under 1 minute', () => {
    const { a, sent } = sink('http://x/c', true);
    for (const c of [
      { v: 1, e: 'name', chapter: 'ch0' },
      { v: 2, e: 'chapter', chapter: 'ch0' },
      { v: 1, e: 'sandbox', minutes: 0 },
      { v: 1, e: 'sandbox', minutes: 1.5 },
      { v: 1, e: 'bet', chapter: 'ch0', right: 'yes' },
    ])
      a.count(c as unknown as Count);
    expect(sent).toEqual([]);
  });
});

describe('fetchPost', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends credentials omit, no-referrer, no-store, keepalive, and text/plain', async () => {
    const f = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal('fetch', f);
    fetchPost('http://x/c', '{"v":1}');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://x/c');
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });
    const blob = init.body as Blob;
    expect(blob.type).toBe('text/plain');
    expect(await blob.text()).toBe('{"v":1}');
  });

  it('drops a failed send without an error', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    expect(() => {
      fetchPost('http://x/c', '{}');
    }).not.toThrow();
    vi.stubGlobal('fetch', () => {
      throw new Error('blocked');
    });
    expect(() => {
      fetchPost('http://x/c', '{}');
    }).not.toThrow();
    await Promise.resolve();
  });
});

describe('visible timer', () => {
  it('counts whole minutes with the tab visible, rounded down', () => {
    let t = 0;
    const timer = createVisibleTimer(() => t, false);
    t = 100_000; // 1:40 visible
    timer.setHidden(true);
    t = 900_000; // hidden time does not count
    timer.setHidden(false);
    t = 900_000 + 50_000; // 0:50 more: 2:30 in all
    expect(timer.stop()).toBe(2);
  });

  it('gives 0 under a minute', () => {
    let t = 0;
    const timer = createVisibleTimer(() => t, false);
    t = 59_999;
    expect(timer.stop()).toBe(0);
  });
});
