import { expect, test } from 'vitest';
import { leave, newcomer, regrowBushes, returnAway } from '../../../../src/sim/daily/population.ts';
import { befriend, get, makeWorld, scriptedRng, tuning as t } from '../helpers.ts';

const bush = (id: string, berries: number) => ({ id, x: 100, y: 100, berries });

test('bush: 4 of 10 berries grows by 0.2 x 4 x 0.6 + 0.5 = 0.98', () => {
  const w = makeWorld([], { bushes: [bush('b1', 4)] });
  regrowBushes(w, t, scriptedRng([]));
  expect(w.bushes[0]?.berries).toBeCloseTo(4.98, 12);
});

test('bush: growth clamps at the limit, and an empty bush gains the base', () => {
  const w = makeWorld([], { bushes: [bush('full', 10), bush('empty', 0)] });
  regrowBushes(w, t, scriptedRng([]));
  expect(w.bushes[0]?.berries).toBe(10);
  expect(w.bushes[1]?.berries).toBe(0.5);
});

test('newcomer: spare berries above 3 per creature add one newcomer at the gate', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }], { bushes: [bush('b1', 5), bush('b2', 2)] }); // 7 / 2 = 3.5
  const events = newcomer(w, t, scriptedRng([]));
  expect(events).toEqual([{ t: 'arrive', who: 'newcomer-1' }]);
  expect(w.nextId).toBe(2);
  const n = get(w, 'newcomer-1');
  expect(n).toMatchObject({
    name: 'Newcomer 1',
    speciesId: 'kith',
    x: t.scene.gateX,
    y: t.scene.gateY,
    berries: 0,
    state: 'wander',
    dials: { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 },
    shell: { tightness: 0, bristle: 0, color: 0, softness: 0 },
  });
});

test('newcomer: at most one per dusk, none at exactly 3 per creature, none at the cap', () => {
  const rich = makeWorld([{ id: 'a' }], { bushes: [bush('b1', 10), bush('b2', 10)] });
  expect(newcomer(rich, t, scriptedRng([]))).toHaveLength(1);
  expect(rich.creatures).toHaveLength(2);

  const even = makeWorld([{ id: 'a' }], { bushes: [bush('b1', 3)] });
  expect(newcomer(even, t, scriptedRng([]))).toEqual([]);

  const capped = makeWorld([{ id: 'a' }], { bushes: [bush('b1', 10)] });
  expect(newcomer(capped, { ...t, cap: { ...t.cap, story: 1 } }, scriptedRng([]))).toEqual([]);
});

test('newcomer: spare counts only creatures not away; with none, spare is the bush total', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }], { bushes: [bush('b1', 4)] });
  get(w, 'b').state = 'away';
  expect(newcomer(w, t, scriptedRng([]))).toHaveLength(1); // 4 / 1
  const empty = makeWorld([], { bushes: [bush('b1', 4)] });
  expect(newcomer(empty, t, scriptedRng([]))).toHaveLength(1);
});

test('leave: 4 hungry dusks and 1 friend leaves; 2 friends or 3 hungry dusks stays', () => {
  const w = makeWorld([{ id: 'lonely' }, { id: 'liked' }, { id: 'new' }, { id: 'f1' }, { id: 'f2' }]);
  befriend(w, 'lonely', 'f1');
  befriend(w, 'liked', 'f1');
  befriend(w, 'liked', 'f2');
  get(w, 'lonely').hungryDusks = 4;
  get(w, 'liked').hungryDusks = 4;
  get(w, 'new').hungryDusks = 3;
  expect(leave(w, t, scriptedRng([]))).toEqual([{ t: 'leave', who: 'lonely' }]);
  expect(get(w, 'lonely').state).toBe('away');
  expect(get(w, 'liked').state).toBe('wander');
  expect(get(w, 'new').state).toBe('wander');
  expect(w.ties.size).toBe(3); // a leaving creature keeps its memory
});

test('leave: friend counts are read before anyone leaves, so order does not matter', () => {
  // a and b are each other's only friend besides c; both are hungry.
  for (const order of [
    ['a', 'b', 'c'],
    ['b', 'a', 'c'],
  ]) {
    const w = makeWorld(order.map((id) => ({ id })));
    befriend(w, 'a', 'b');
    befriend(w, 'a', 'c');
    get(w, 'a').hungryDusks = 4;
    get(w, 'b').hungryDusks = 4;
    // b has 1 friend (a) and leaves; a has 2 friends before b leaves, so a stays.
    expect(leave(w, t, scriptedRng([]))).toEqual([{ t: 'leave', who: 'b' }]);
    expect(get(w, 'a').state).toBe('wander');
  }
});

/** a and b are warm (0.5 each way); c is away. */
function returnWorld(day: number, warmth = 0.5) {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }, { id: 'c', x: 900, y: 300 }]);
  befriend(w, 'a', 'b', warmth);
  const c = get(w, 'c');
  c.state = 'away';
  c.hungryDusks = 4;
  w.day = day;
  return w;
}

test('return: on the seventh dusk an away creature returns when the draw is below 0.25', () => {
  const w = returnWorld(6);
  const events = returnAway(w, t, scriptedRng([0.24]));
  expect(events).toEqual([{ t: 'return', who: 'c' }]);
  const c = get(w, 'c');
  expect(c).toMatchObject({ state: 'wander', x: t.scene.gateX, y: t.scene.gateY, hungryDusks: 0 });
  expect(c.goalX).toBe(t.scene.gateX);

  const stays = returnWorld(6);
  expect(returnAway(stays, t, scriptedRng([0.25]))).toEqual([]);
  expect(get(stays, 'c').state).toBe('away');
});

test('return: no draw when average warmth is 0.2 or less, or on other days', () => {
  const cold = returnWorld(6, 0.2);
  expect(returnAway(cold, t, scriptedRng([]))).toEqual([]);
  for (const day of [0, 5, 7]) {
    expect(returnAway(returnWorld(day), t, scriptedRng([]))).toEqual([]);
  }
  expect(returnAway(returnWorld(13), t, scriptedRng([0.1]))).toHaveLength(1);
});

test('leave: a sleeper never leaves, even with hungry dusks and no friends', () => {
  const w = makeWorld([{ id: 'a', berries: 0 }]);
  const a = get(w, 'a');
  a.state = 'sleep';
  a.hungryDusks = 9;
  expect(leave(w, t, scriptedRng([]))).toEqual([]);
  expect(a.state).toBe('sleep');
});
