import { expect, test } from 'vitest';
import { applyCommand } from '../../../src/sim/commands.ts';
import { runDusk } from '../../../src/sim/daily/index.ts';
import { spreadDance } from '../../../src/sim/festival.ts';
import { moveCreatures } from '../../../src/sim/move.ts';
import { createRng } from '../../../src/sim/rng.ts';
import { step } from '../../../src/sim/step.ts';
import type { Command, World } from '../../../src/sim/types.ts';
import { createWorld } from '../../../src/sim/world.ts';
import { get, hasBadNumber, makeWorld, scriptedRng, setWarmth, tuning as t } from './helpers.ts';

/** Bell (threshold 3) counts a, b, and c as friends; they count nobody. Everyone stands 300 apart. */
function bellWorld(): World {
  const w = createWorld(1, t, {
    valleyId: 'kith',
    season: 'thaw',
    creatures: ['bell', 'a', 'b', 'c'].map((id, i) => ({
      id,
      speciesId: 'kith',
      name: id,
      x: 200 + 300 * i,
      y: 450,
      berries: 3,
      dials: { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 },
      ...(id === 'bell' ? { danceThreshold: 3 } : {}),
    })),
    bushes: [],
    structures: [],
  });
  for (const f of ['a', 'b', 'c']) setWarmth(w, 'bell', f, 0.5);
  return w;
}

function runTo(w: World, tick: number, at: Record<number, Command[]>): void {
  while (w.tick <= tick) step(w, at[w.tick] ?? [], t);
}

test('a dance command starts one present creature dancing, once', () => {
  const w = makeWorld([{ id: 'pim' }, { id: 'gone' }]);
  get(w, 'gone').state = 'away';
  const rng = scriptedRng([]);
  expect(applyCommand(w, { t: 'dance', who: 'pim' }, t, rng)).toEqual([{ t: 'dance', who: 'pim' }]);
  expect(get(w, 'pim').dancing).toBe(true);
  expect(applyCommand(w, { t: 'dance', who: 'pim' }, t, rng)).toEqual([]);
  expect(applyCommand(w, { t: 'dance', who: 'gone' }, t, rng)).toEqual([]);
  expect(applyCommand(w, { t: 'dance', who: 'nobody' }, t, rng)).toEqual([]);
  expect('dancing' in get(w, 'gone')).toBe(false);
});

test('a scenario danceThreshold is copied; without one the creature has no such key', () => {
  const w = bellWorld();
  expect(get(w, 'bell').danceThreshold).toBe(3);
  expect('danceThreshold' in get(w, 'a')).toBe(false);
});

test('dance: Bell (threshold 3) starts on the step where her third friend dances, not the second', () => {
  const w = bellWorld();
  const events: string[] = [];
  const dance = (who: string): Command[] => [{ t: 'dance', who }];
  runTo(w, 10, { 0: [...dance('a'), ...dance('b')] });
  expect(get(w, 'bell').dancing).toBeUndefined();
  while (w.tick <= 20) {
    for (const e of step(w, w.tick === 20 ? dance('c') : [], t)) if (e.t === 'dance') events.push(e.who);
  }
  expect(get(w, 'bell').dancing).toBe(true);
  expect(events).toEqual(['c', 'bell']);
});

test('dance: the spread counts from the same set, so array order does not matter', () => {
  // a dances; b needs 1 dancing friend (a); c needs 1 (b). One spread starts b only.
  for (const order of [
    ['a', 'b', 'c'],
    ['c', 'b', 'a'],
  ]) {
    const w = makeWorld(order.map((id) => ({ id })));
    get(w, 'a').dancing = true;
    get(w, 'b').danceThreshold = 1;
    get(w, 'c').danceThreshold = 1;
    setWarmth(w, 'b', 'a', 0.5);
    setWarmth(w, 'c', 'b', 0.5);
    expect(spreadDance(w, t)).toEqual([{ t: 'dance', who: 'b' }]);
    expect(get(w, 'c').dancing).toBeUndefined();
    expect(spreadDance(w, t)).toEqual([{ t: 'dance', who: 'c' }]);
  }
});

test('dance: a sleeper or an away creature does not start, and the default threshold is 2', () => {
  const w = makeWorld([{ id: 'x' }, { id: 'y' }, { id: 'z' }, { id: 'one' }, { id: 'sleeper' }]);
  for (const d of ['x', 'y']) get(w, d).dancing = true;
  for (const d of ['x', 'y']) setWarmth(w, 'sleeper', d, 0.5);
  setWarmth(w, 'one', 'x', 0.5);
  setWarmth(w, 'z', 'x', 0.5);
  setWarmth(w, 'z', 'y', 0.5);
  get(w, 'sleeper').state = 'sleep';
  expect(spreadDance(w, t)).toEqual([{ t: 'dance', who: 'z' }]);
});

test('empty winter: mushroom, ambient bid, and dance rules on 0 and 1 creatures give no NaN', () => {
  for (const ids of [[], ['solo']]) {
    const w = makeWorld(
      ids.map((id) => ({ id, berries: 0 })),
      { season: 'winter', mushroom: { x: 800, y: 450 }, ambientSkyBids: true },
    );
    if (ids.length > 0) get(w, 'solo').dancing = true;
    const rng = createRng(3);
    for (let d = 0; d < 12; d++) {
      moveCreatures(w, t, rng);
      spreadDance(w, t);
      runDusk(w, t, rng);
    }
    expect(hasBadNumber(w)).toBe(false);
    expect(w.mushroom?.drops).toBeGreaterThanOrEqual(0);
  }
});
