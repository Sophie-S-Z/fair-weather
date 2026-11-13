import { expect, test } from 'vitest';
import { mushroomDawn } from '../../../../src/sim/daily/mushroom.ts';
import { moveCreatures } from '../../../../src/sim/move.ts';
import { createRng } from '../../../../src/sim/rng.ts';
import type { World } from '../../../../src/sim/types.ts';
import { befriend, get, makeWorld, scriptedRng, tuning as t } from '../helpers.ts';

const AT = { x: 800, y: 450 };

function mushroom(w: World) {
  if (!w.mushroom) throw new Error('no mushroom');
  return w.mushroom;
}

test('a scenario mushroom starts with mushroom.drops drops, none taken, not withered', () => {
  expect(makeWorld([], { mushroom: AT }).mushroom).toEqual({ ...AT, drops: 10, taken: 0, witherDays: 0 });
  expect('mushroom' in makeWorld([])).toBe(false);
});

test.each([
  [0, 20],
  [6, 20],
  [7, 10],
  [8, 10],
])('taking %i drops gives %i at the next dawn', (taken, next) => {
  const w = makeWorld([], { mushroom: AT });
  mushroom(w).taken = taken;
  expect(mushroomDawn(w, t, scriptedRng([]))).toEqual([{ t: 'mushroom', taken, drops: next }]);
  expect(mushroom(w)).toMatchObject({ drops: next, taken: 0, witherDays: 0 });
});

test('taking 9 withers it: 0, 0, 0, then 10 at the next four dawns', () => {
  const w = makeWorld([], { mushroom: AT });
  mushroom(w).taken = 9;
  const drops: number[] = [];
  for (let i = 0; i < 4; i++) {
    mushroomDawn(w, t, scriptedRng([]));
    drops.push(mushroom(w).drops);
  }
  expect(drops).toEqual([0, 0, 0, 10]);
  expect(mushroom(w).witherDays).toBe(0);
});

test('a world without a mushroom gets no mushroom event', () => {
  expect(mushroomDawn(makeWorld([{ id: 'a' }]), t, scriptedRng([]))).toEqual([]);
});

test('a creature takes one drop a day, only below 1 berry, or below 5 with fewer than 2 friends', () => {
  // Everyone stands on the mushroom; a step moves them less than a unit, so they stay in reach.
  const w = makeWorld(
    [
      { id: 'empty', berries: 0 },
      { id: 'loner', berries: 4 },
      { id: 'full', berries: 5 },
      { id: 'friended', berries: 4 },
      { id: 'f1', berries: 5 },
      { id: 'f2', berries: 5 },
    ],
    { mushroom: AT },
  );
  befriend(w, 'friended', 'f1');
  befriend(w, 'friended', 'f2');
  const rng = createRng(1);
  moveCreatures(w, t, rng);
  expect(w.creatures.map((c) => c.berries)).toEqual([1, 5, 5, 4, 5, 5]);
  expect(mushroom(w).taken).toBe(2);

  // A second chance the same day takes nothing; the next day it takes again.
  get(w, 'empty').berries = 0;
  moveCreatures(w, t, rng);
  expect(get(w, 'empty').berries).toBe(0);
  w.day += 1;
  moveCreatures(w, t, rng);
  expect(get(w, 'empty').berries).toBe(1);
  expect(mushroom(w).taken).toBe(3);
});

test('nobody takes from a mushroom with no drops left, or from beyond meet.radius', () => {
  const w = makeWorld(
    [
      { id: 'near', berries: 0 },
      { id: 'far', x: AT.x + t.meet.radius + 1, berries: 0 },
    ],
    { mushroom: AT },
  );
  const rng = createRng(1);
  moveCreatures(w, t, rng);
  expect(get(w, 'near').berries).toBe(1);
  expect(get(w, 'far').berries).toBe(0);
  mushroom(w).taken = mushroom(w).drops;
  get(w, 'near').berries = 0;
  w.day += 1;
  moveCreatures(w, t, rng);
  expect(get(w, 'near').berries).toBe(0);
});

test('a hungry creature with a full mushroom in reach and no bush heads for the mushroom', () => {
  const w = makeWorld([{ id: 'a', x: 400, y: 300, berries: 0 }], {
    mushroom: AT,
    bushes: [{ id: 'bare', x: 410, y: 300, berries: 0 }],
  });
  moveCreatures(w, t, scriptedRng([]));
  expect(get(w, 'a')).toMatchObject({ goalX: AT.x, goalY: AT.y });

  // A mushroom with no drops left is not a goal: the creature picks a random cell instead.
  const bare = makeWorld([{ id: 'a', x: 400, y: 300, berries: 0 }], { mushroom: AT });
  mushroom(bare).taken = 10;
  moveCreatures(bare, t, scriptedRng([0, 0.5, 0.5]));
  expect(get(bare, 'a').goalX).not.toBe(AT.x);
});
