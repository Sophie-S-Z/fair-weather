/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import { checkInvariants } from '../../../src/sim/invariants.ts';
import type { HollowState, World } from '../../../src/sim/types.ts';
import { befriend, get, makeWorld, tuning as t } from './helpers.ts';

function fresh(): World {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }], { bushes: [{ id: 'bush-1', x: 1, y: 1, berries: 2 }] });
  befriend(w, 'a', 'b');
  get(w, 'a').opinions.b = 0.2;
  return w;
}

test('a fresh world has no invariant violations', () => {
  expect(checkInvariants(fresh(), t)).toEqual([]);
});

test.each<[string, (w: World) => void]>([
  ['negative creature berries', (w) => (get(w, 'a').berries = -1)],
  ['negative bush berries', (w) => (w.bushes[0]!.berries = -0.5)],
  ['a NaN anywhere', (w) => w.boosts.push({ behavior: 'give', x: NaN, y: 0, untilDay: 1 })],
  ['an infinite number', (w) => (get(w, 'a').vx = Infinity)],
  ['warmth above 1', (w) => (w.ties.get('a|b')!.ab.warmth = 1.01)],
  ['an opinion below -1', (w) => (get(w, 'a').opinions.b = -1.5)],
  ['a dial above 1', (w) => (get(w, 'a').dials.ear = 1.2)],
  ['a shell below 0', (w) => (get(w, 'b').shell.bristle = -0.1)],
  ['a rest shell above 1', (w) => (get(w, 'b').restShell.color = 2)],
  ['a creature outside the scene', (w) => (get(w, 'a').x = t.scene.width + 1)],
  ['a creature above the scene', (w) => (get(w, 'a').y = -1)],
  [
    'population over cap.sandbox',
    (w) => {
      for (let i = 0; i < t.cap.sandbox; i++) w.creatures.push({ ...get(w, 'a'), id: `x${String(i)}` });
    },
  ],
  [
    'a tie key that does not match its creatures',
    (w) => {
      const tie = w.ties.get('a|b')!;
      w.ties.delete('a|b');
      w.ties.set('a|c', tie);
    },
  ],
  ['a duplicate creature id', (w) => w.creatures.push({ ...get(w, 'a') })],
  ['sky warmth below -1', (w) => (get(w, 'a').skyWarmth = -1.1)],
  ['light sky warmth above the daily cap', (w) => (get(w, 'a').skyLightToday = t.sky.lightDailyCap + 0.01)],
  ['negative light sky warmth', (w) => (get(w, 'a').skyLightToday = -0.01)],
  ['fog above 1', (w) => (w.fields.fog[3] = 1.5)],
  ['fog below 0', (w) => (w.fields.fog[3] = -0.5)],
])('checkInvariants reports %s', (_, edit) => {
  const w = fresh();
  edit(w);
  expect(checkInvariants(w, t)).not.toEqual([]);
});

function hollowFresh(): World {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }], { pack: { id: 'hollow' } });
  if (w.pack?.id === 'hollow') {
    w.pack.fame = { a: 0.3 };
    w.pack.drama = [{ subject: 'a', x: 800, y: 450, score: 1, day: 0, hero: false }];
  }
  return w;
}

test('a fresh Hollow world has no invariant violations', () => {
  expect(checkInvariants(hollowFresh(), t)).toEqual([]);
});

test.each<[string, (h: HollowState, w: World) => void]>([
  ['the lens off the drama sky', (_, w) => (w.fields.light = { x: 0, y: 0 })],
  ['a negative fame', (h) => (h.fame.a = -0.1)],
  ['a negative drama score', (h) => (h.drama[0]!.score = -1)],
  ['a drama subject twice', (h) => h.drama.push({ ...h.drama[0]! })],
])('checkInvariants reports %s in the Hollow', (_, edit) => {
  const w = hollowFresh();
  if (w.pack?.id !== 'hollow') throw new Error('not a Hollow');
  edit(w.pack, w);
  expect(checkInvariants(w, t)).not.toEqual([]);
});
