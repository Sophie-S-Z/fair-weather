/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import { hashWorld } from '../../../src/sim/hash.ts';
import { ensureTie } from '../../../src/sim/world.ts';
import { befriend, get, makeWorld, tuning } from './helpers.ts';

function sample() {
  const w = makeWorld(
    [
      { id: 'a', x: 100 },
      { id: 'b', x: 120 },
      { id: 'c', x: 900 },
    ],
    {
      bushes: [{ id: 'bush-1', x: 50, y: 50, berries: 4 }],
    },
  );
  befriend(w, 'a', 'b');
  ensureTie(w, get(w, 'c'), get(w, 'a'), tuning);
  get(w, 'a').opinions = { b: 0.3, c: -0.2 };
  get(w, 'b').benchMemory = { benchId: 'bench-1', day: 0 };
  get(w, 'c').diary.push({ tick: 3, kind: 'bid', with: 'a', value: 0.1 });
  w.fields.fog[5] = 0.25;
  w.fields.gusts.push({ x: 1, y: 2, dx: 3, dy: 4, untilTick: 10 });
  w.rumors.push({ about: 'b', sign: -1, strength: 0.4, origin: 'a', tick: 2 });
  w.boosts.push({ behavior: 'give', x: 5, y: 6, untilDay: 3 });
  return w;
}

test('hash is 16 hex chars and stable for one world', () => {
  const w = sample();
  const h = hashWorld(w);
  expect(h).toMatch(/^[0-9a-f]{16}$/);
  expect(hashWorld(w)).toBe(h);
  expect(hashWorld(sample())).toBe(h);
});

test('hash changes when one berry changes by 1e-12', () => {
  const w = sample();
  const h = hashWorld(w);
  get(w, 'a').berries += 1e-12;
  expect(hashWorld(w)).not.toBe(h);
});

test('hash ignores Map insertion order', () => {
  const w = sample();
  const reversed = sample();
  reversed.ties = new Map([...reversed.ties].reverse());
  expect([...reversed.ties.keys()]).not.toEqual([...w.ties.keys()]);
  expect(hashWorld(reversed)).toBe(hashWorld(w));
});

test('hash ignores record key order', () => {
  const w = sample();
  const other = sample();
  get(other, 'a').opinions = { c: -0.2, b: 0.3 };
  expect(hashWorld(other)).toBe(hashWorld(w));
});

test('a structured clone of a world has the same hash', () => {
  const w = sample();
  expect(hashWorld(structuredClone(w))).toBe(hashWorld(w));
});

test('hash covers fog, gusts, boosts, rumors, diaries, visits, bench memory, rng state, and ties', () => {
  const edits: ((w: ReturnType<typeof sample>) => void)[] = [
    (w) => (w.fields.fog[0] = 0.5),
    (w) => (w.fields.gusts[0]!.untilTick += 1),
    (w) => (w.boosts[0]!.untilDay += 1),
    (w) => (w.rumors[0]!.strength += 0.1),
    (w) => (get(w, 'c').diary[0]!.with = 'b'),
    (w) => (get(w, 'a').visits[3] = 1),
    (w) => (get(w, 'b').benchMemory = null),
    (w) => (w.rngState += 1),
    (w) => (w.ties.get('a|b')!.ab.slights += 1),
    (w) => (w.fields.light = { x: 0, y: 0 }),
  ];
  const base = hashWorld(sample());
  for (const edit of edits) {
    const w = sample();
    edit(w);
    expect(hashWorld(w)).not.toBe(base);
  }
});

test('hash tells null, undefined, false, and 0 apart', () => {
  const values = [null, undefined, false, true, 0, -0, ''];
  const hashes = values.map((v) => {
    const w = sample();
    (get(w, 'b') as unknown as { benchMemory: unknown }).benchMemory = v;
    return hashWorld(w);
  });
  expect(new Set(hashes).size).toBe(values.length);
});
