import { expect, test } from 'vitest';
import { gossip } from '../../../../src/sim/daily/gossip.ts';
import { hashWorld } from '../../../../src/sim/hash.ts';
import { runGolden } from '../../../golden/run-golden.ts';
import { befriend, get, hasBadNumber, makeWorld, scriptedRng, setWarmth, tuning as t } from '../helpers.ts';

/** L hears from friends F1 and F2, who hold opinions of X; F1 and F2 are not friends of each other. */
function simpleWorld() {
  const w = makeWorld([{ id: 'L', ear: 0.05 }, { id: 'F1' }, { id: 'F2' }, { id: 'X' }]);
  befriend(w, 'L', 'F1');
  befriend(w, 'L', 'F2');
  get(w, 'F1').opinions.X = 0.8;
  get(w, 'F2').opinions.X = 0.6;
  return w;
}

test('gossip, simple: Ear below 0.1 takes the opinion with chance 0.3 for each friend who holds it', () => {
  const w = simpleWorld();
  const rng = scriptedRng([0.31, 0.29]); // F1 misses, F2 hits
  const events = gossip(w, t, rng);
  expect(rng.used()).toBe(2);
  expect(get(w, 'L').opinions.X).toBeCloseTo(0.7, 12); // mean of the holders' values
  expect(events).toEqual([{ t: 'opinion', holder: 'L', about: 'X', value: get(w, 'L').opinions.X }]);
});

test('gossip, simple: every friend draw at or above 0.3 leaves the listener unchanged', () => {
  const w = simpleWorld();
  const rng = scriptedRng([0.31, 0.3]);
  expect(gossip(w, t, rng)).toEqual([]);
  expect(rng.used()).toBe(2);
  expect(get(w, 'L').opinions.X).toBeUndefined();
});

function complexWorld(holders: number) {
  const w = makeWorld([
    { id: 'L', ear: 0.5 },
    { id: 'F1' },
    { id: 'F2' },
    { id: 'F3' },
    { id: 'F4' },
    { id: 'X' },
  ]);
  for (const f of ['F1', 'F2', 'F3', 'F4']) befriend(w, 'L', f);
  if (holders >= 1) get(w, 'F1').opinions.X = 0.8;
  if (holders >= 2) get(w, 'F2').opinions.X = 0.4;
  return w;
}

test('gossip, complex: Ear 0.5 and 2 of 4 friends holding it takes the opinion, with no draws', () => {
  const w = complexWorld(2);
  const events = gossip(w, t, scriptedRng([]));
  expect(get(w, 'L').opinions.X).toBeCloseTo(0.6, 12);
  expect(events).toHaveLength(1);
});

test('gossip, complex: 1 of 4 friends holding it is below Ear 0.5', () => {
  const w = complexWorld(1);
  expect(gossip(w, t, scriptedRng([]))).toEqual([]);
  expect(get(w, 'L').opinions.X).toBeUndefined();
});

test('gossip: an opinion weaker than opinion.holdAt is not held, so it is not shared', () => {
  const w = makeWorld([{ id: 'L' }, { id: 'S' }, { id: 'X' }]);
  befriend(w, 'L', 'S');
  get(w, 'S').opinions.X = 0.29;
  expect(gossip(w, t, scriptedRng([]))).toEqual([]);
  expect(get(w, 'L').opinions.X).toBeUndefined();
});

test('gossip: a sharer shares its strongest held opinion, but never one about the listener', () => {
  const w = makeWorld([{ id: 'L' }, { id: 'S' }, { id: 'X' }, { id: 'Y' }]);
  befriend(w, 'L', 'S');
  const s = get(w, 'S');
  s.opinions.L = 0.95; // strongest, but about the listener
  s.opinions.X = 0.5;
  s.opinions.Y = -0.7; // strongest about a third creature
  gossip(w, t, scriptedRng([]));
  const l = get(w, 'L');
  expect(l.opinions.Y).toBeCloseTo(-0.7, 12);
  expect(l.opinions.X).toBeUndefined();
  expect(l.opinions.L).toBeUndefined();
});

test('gossip: equal strength goes to the lower id', () => {
  const w = makeWorld([{ id: 'L' }, { id: 'S' }, { id: 'X' }, { id: 'Y' }]);
  befriend(w, 'L', 'S');
  get(w, 'S').opinions.Y = -0.5;
  get(w, 'S').opinions.X = 0.5;
  gossip(w, t, scriptedRng([]));
  expect(get(w, 'L').opinions).toEqual({ X: 0.5 });
});

test('gossip: a listener that already holds the same sign keeps its own value', () => {
  const w = makeWorld([{ id: 'L' }, { id: 'S' }, { id: 'X' }]);
  befriend(w, 'L', 'S');
  get(w, 'S').opinions.X = 0.9;
  get(w, 'L').opinions.X = 0.4;
  expect(gossip(w, t, scriptedRng([]))).toEqual([]);
  expect(get(w, 'L').opinions.X).toBe(0.4);
});

test('gossip: an opposite-signed opinion can be replaced', () => {
  const w = makeWorld([{ id: 'L' }, { id: 'S' }, { id: 'X' }]);
  befriend(w, 'L', 'S');
  get(w, 'S').opinions.X = -0.9;
  get(w, 'L').opinions.X = 0.4;
  gossip(w, t, scriptedRng([]));
  expect(get(w, 'L').opinions.X).toBe(-0.9);
});

test('gossip: shares are collected before any is applied, so creature order does not matter', () => {
  for (const order of [
    ['A', 'B', 'C', 'X'],
    ['C', 'B', 'A', 'X'],
  ]) {
    const w = makeWorld(order.map((id) => ({ id })));
    befriend(w, 'A', 'B');
    befriend(w, 'B', 'C');
    get(w, 'A').opinions.X = 0.8;
    gossip(w, t, scriptedRng([]));
    expect(get(w, 'B').opinions.X).toBe(0.8); // 1 of B's 2 friends holds it: 0.5 >= Ear 0.5
    expect(get(w, 'C').opinions.X).toBeUndefined(); // B did not hold it before this dusk
  }
});

test('gossip: away creatures neither share nor listen', () => {
  const w = makeWorld([{ id: 'L' }, { id: 'S' }, { id: 'X' }]);
  befriend(w, 'L', 'S');
  get(w, 'S').opinions.X = 0.9;
  get(w, 'S').state = 'away';
  expect(gossip(w, t, scriptedRng([]))).toEqual([]);
  expect(get(w, 'L').opinions.X).toBeUndefined();
});

test('gossip, simple: once a subject is adopted, the other sign about it takes no draws', () => {
  const w = makeWorld([{ id: 'L', ear: 0.05 }, { id: 'N' }, { id: 'P' }, { id: 'X' }]);
  befriend(w, 'L', 'N');
  befriend(w, 'L', 'P');
  get(w, 'P').opinions.X = 0.8;
  get(w, 'N').opinions.X = -0.8;
  const rng = scriptedRng([0.1]); // positive first: P's draw adopts; the negative share is skipped
  expect(gossip(w, t, rng)).toEqual([{ t: 'opinion', holder: 'L', about: 'X', value: 0.8 }]);
  expect(rng.used()).toBe(1);
});

/** L's one friend F holds Y at 0.9 and the latest rumor, about X, at -0.6. */
function rumorWorld(rumorFirst: boolean) {
  const w = makeWorld([{ id: 'L', ear: 0.5 }, { id: 'F' }, { id: 'X' }, { id: 'Y' }]);
  befriend(w, 'L', 'F');
  get(w, 'F').opinions.Y = 0.9;
  get(w, 'F').opinions.X = -0.6;
  w.rumors.push({ about: 'X', sign: -1, strength: 0.6, origin: 'F', tick: 0 });
  if (rumorFirst) w.rumorFirst = true;
  return w;
}

test('gossip: without rumorFirst the strongest opinion is shared, not the rumor', () => {
  const w = rumorWorld(false);
  gossip(w, t, scriptedRng([]));
  expect(get(w, 'L').opinions).toEqual({ Y: 0.9 });
});

test('gossip: with rumorFirst a holder of the latest rumor shares it first', () => {
  const w = rumorWorld(true);
  gossip(w, t, scriptedRng([]));
  expect(get(w, 'L').opinions).toEqual({ X: -0.6 });
});

test('with weighted, a listener with Ear 0.6 adopts when its warmth to holders is 0.9 of 1.3 total, though 1 of 2 friends hold it', () => {
  for (const weighted of [false, true]) {
    const w = makeWorld(
      [{ id: 'L', ear: 0.6 }, { id: 'F1' }, { id: 'F2' }, { id: 'X' }],
      weighted ? { network: { weighted: true } } : {},
    );
    befriend(w, 'L', 'F1');
    befriend(w, 'L', 'F2');
    setWarmth(w, 'L', 'F1', 0.9);
    setWarmth(w, 'L', 'F2', 0.4);
    get(w, 'F1').opinions.X = 0.8;
    const rng = scriptedRng([]);
    gossip(w, t, rng);
    expect(rng.used()).toBe(0);
    // 1 of 2 friends is below Ear 0.6; 0.9 / 1.3 is above it.
    expect(get(w, 'L').opinions.X).toBe(weighted ? 0.8 : undefined);
  }
});

test('with drift, an adopted value is the mean plus a draw from -0.2 to 0.2, clamped, and the draw comes after the simple-contagion draws', () => {
  const w = makeWorld([{ id: 'L', ear: 0.05 }, { id: 'F1' }, { id: 'F2' }, { id: 'X' }, { id: 'Y' }], {
    network: { drift: true },
  });
  befriend(w, 'L', 'F1');
  befriend(w, 'L', 'F2');
  get(w, 'F1').opinions.X = 0.8; // F1 shares X
  get(w, 'F2').opinions.X = 0.6;
  get(w, 'F2').opinions.Y = -0.95; // F2 shares Y, its strongest
  // X: F1 misses, F2 hits; Y: F2 hits; then X's drift (+0.1) and Y's (-0.2), in adoption order.
  const rng = scriptedRng([0.5, 0.1, 0.1, 0.75, 0]);
  const events = gossip(w, t, rng);
  expect(rng.used()).toBe(5);
  const l = get(w, 'L');
  expect(l.opinions.X).toBeCloseTo(0.8, 12); // mean 0.7, plus 0.1
  expect(l.opinions.Y).toBe(-1); // -0.95 - 0.2, clamped
  expect(events).toEqual([
    { t: 'opinion', holder: 'L', about: 'X', value: l.opinions.X },
    { t: 'opinion', holder: 'L', about: 'Y', value: -1 },
  ]);
});

test('a world without network takes the same draws and gives the same opinions (golden hash unchanged)', () => {
  const w = simpleWorld();
  expect('network' in w).toBe(false);
  const rng = scriptedRng([0.31, 0.29]);
  gossip(w, t, rng);
  expect(rng.used()).toBe(2);
  expect(get(w, 'L').opinions.X).toBeCloseTo(0.7, 12);
  expect(hashWorld(runGolden())).toBe('c29d2fa4dbda4dcf');
});

test('weighted gossip with every friend at the threshold edge gives no NaN', () => {
  // At the default threshold 0.3, a warmth of exactly 0.3 makes no friend, so L weighs nobody.
  // At threshold 0, the smallest warmth above it makes two friends whose warmths sum above 0.
  for (const [threshold, warmth, value] of [
    [0.3, 0.3, undefined],
    [0, Number.MIN_VALUE, 0.8],
  ] as const) {
    const tuning = { ...t, friend: { threshold } };
    const w = makeWorld([{ id: 'L' }, { id: 'F1' }, { id: 'F2' }, { id: 'X' }], {
      network: { weighted: true },
    });
    befriend(w, 'L', 'F1');
    befriend(w, 'L', 'F2');
    setWarmth(w, 'L', 'F1', warmth);
    setWarmth(w, 'L', 'F2', warmth);
    get(w, 'F1').opinions.X = 0.8;
    gossip(w, tuning, scriptedRng([]));
    expect(get(w, 'L').opinions.X).toBe(value);
    expect(hasBadNumber(w)).toBe(false);
  }
});
