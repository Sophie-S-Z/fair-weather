// The sandbox world rules (ADR 0014 items 1, 4, and 5).
import { expect, test } from 'vitest';
import { applyCommand } from '../../../src/sim/commands.ts';
import { runDusk } from '../../../src/sim/daily/index.ts';
import { newcomer } from '../../../src/sim/daily/population.ts';
import { hashWorld } from '../../../src/sim/hash.ts';
import { moveCreatures } from '../../../src/sim/move.ts';
import { createRng } from '../../../src/sim/rng.ts';
import type { Command, Scenario, World } from '../../../src/sim/types.ts';
import { runGolden } from '../../golden/run-golden.ts';
import { get, makeWorld, scriptedRng, tuning as t, type CreatureSpec } from './helpers.ts';

const sandbox = (specs: CreatureSpec[], over: Partial<Scenario> = {}): World =>
  makeWorld(specs, { sandbox: true, ...over });

const apply = (w: World, cmd: Command) => applyCommand(w, cmd, t, scriptedRng([]));

test('baseFog 0.4 starts every fog cell at 0.4 (as float32)', () => {
  const fog = sandbox([], { baseFog: 0.4 }).fields.fog;
  expect(fog.length).toBeGreaterThan(0);
  expect(fog.every((f) => f === Math.fround(0.4))).toBe(true);
  expect(makeWorld([]).fields.fog.every((f) => f === 0)).toBe(true);
});

test('rain at a point adds 2 berries to each bush within 120 units, capped at bush.limit', () => {
  const w = sandbox([], {
    bushes: [
      { id: 'here', x: 800, y: 450, berries: 3 },
      { id: 'edge', x: 920, y: 450, berries: 9 },
      { id: 'full', x: 800, y: 500, berries: 10 },
      { id: 'far', x: 921, y: 450, berries: 0 },
    ],
  });
  expect(apply(w, { t: 'rain', x: 800, y: 450 })).toEqual([]);
  expect(w.bushes.map((b) => b.berries)).toEqual([5, 10, 10, 0]);
});

test('with seasonDays 2 the season turns at the dusks that end days 1 and 3; thaw turns to spring', () => {
  const w = sandbox([{ id: 'a' }], { season: 'winter', seasonDays: 2 });
  const plain = makeWorld([{ id: 'a' }], { season: 'winter' });
  const seasons: string[] = [];
  for (let d = 0; d < 4; d++) {
    runDusk(w, t, createRng(1));
    runDusk(plain, t, createRng(1));
    seasons.push(w.season);
  }
  expect(seasons).toEqual(['winter', 'thaw', 'thaw', 'spring']);
  expect(w.day).toBe(4);
  expect(plain.season).toBe('winter');
});

test('a dark gate lets no newcomer in; a sandbox world fills up to cap.sandbox, a story world to cap.story', () => {
  const crowd = (n: number): CreatureSpec[] => Array.from({ length: n }, (_, i) => ({ id: `c${String(i)}` }));
  const bushes = [{ id: 'b', x: 400, y: 400, berries: 1000 }];
  const rng = scriptedRng([]);

  const gate = sandbox(crowd(2), { bushes });
  expect(apply(gate, { t: 'welcome', on: false })).toEqual([]);
  expect(gate.gateDark).toBe(true);
  expect(newcomer(gate, t, rng)).toEqual([]);
  apply(gate, { t: 'welcome', on: true });
  expect(gate).not.toHaveProperty('gateDark');
  expect(newcomer(gate, t, rng)).toEqual([{ t: 'arrive', who: 'newcomer-1' }]);

  expect(newcomer(sandbox(crowd(t.cap.story), { bushes }), t, rng)).toHaveLength(1);
  expect(newcomer(sandbox(crowd(t.cap.sandbox), { bushes }), t, rng)).toEqual([]);
  expect(newcomer(makeWorld(crowd(t.cap.story), { bushes }), t, rng)).toEqual([]);
});

test("a path's ends are clamped to the scene and its id is path-<nextId>", () => {
  const w = sandbox([]);
  apply(w, { t: 'path', x: -50, y: 450, x2: 1700, y2: 950 });
  expect(w.structures).toEqual([{ id: 'path-1', kind: 'path', x: 0, y: 450, x2: 1600, y2: 900 }]);
  expect(w.nextId).toBe(2);
});

test('a creature within 40 units of a path end walks to its other end when its draw is below 0.5', () => {
  // Two paths; the creature stands 30 from the second's start and 35 from the first's end.
  const w = sandbox([{ id: 'a', x: 830, y: 450 }]);
  apply(w, { t: 'path', x: 400, y: 450, x2: 795, y2: 450 });
  apply(w, { t: 'path', x: 860, y: 450, x2: 1200, y2: 450 });
  const rng = scriptedRng([0.49]);
  moveCreatures(w, t, rng);
  expect(rng.used()).toBe(1);
  expect([get(w, 'a').goalX, get(w, 'a').goalY]).toEqual([1200, 450]);

  // A draw of 0.5 or more goes on to the other goal steps: here a random least-visited cell.
  const miss = sandbox([{ id: 'a', x: 830, y: 450 }]);
  apply(miss, { t: 'path', x: 860, y: 450, x2: 1200, y2: 450 });
  const rest = scriptedRng([0.5, 0, 0.5, 0.5]);
  moveCreatures(miss, t, rest);
  expect(rest.used()).toBe(4);
  expect([get(miss, 'a').goalX, get(miss, 'a').goalY]).toEqual([100, 112.5]);

  // At equal distances the earlier path wins.
  const tie = sandbox([{ id: 'a', x: 800, y: 450 }]);
  apply(tie, { t: 'path', x: 400, y: 450, x2: 780, y2: 450 });
  apply(tie, { t: 'path', x: 820, y: 450, x2: 1200, y2: 450 });
  moveCreatures(tie, t, scriptedRng([0]));
  expect([get(tie, 'a').goalX, get(tie, 'a').goalY]).toEqual([400, 450]);
});

test('a creature near no path end takes the same draws as a world without paths', () => {
  const withPath = sandbox([{ id: 'a', x: 800, y: 450 }]);
  apply(withPath, { t: 'path', x: 841, y: 450, x2: 1200, y2: 450 });
  const without = sandbox([{ id: 'a', x: 800, y: 450 }]);
  const r1 = createRng(7);
  const r2 = createRng(7);
  moveCreatures(withPath, t, r1);
  moveCreatures(without, t, r2);
  expect(r1.state()).toBe(r2.state());
  expect(get(withPath, 'a')).toEqual(get(without, 'a'));
});

test('a path shorter than meet.radius, and rain, welcome, or path in a world without sandbox, change nothing', () => {
  const short = sandbox([]);
  const before = hashWorld(short);
  expect(apply(short, { t: 'path', x: 800, y: 450, x2: 800 + t.meet.radius - 0.01, y2: 450 })).toEqual([]);
  expect(hashWorld(short)).toBe(before);

  const bushes = [{ id: 'b', x: 800, y: 450, berries: 3 }];
  const story = makeWorld([{ id: 'a' }], { bushes });
  const hash = hashWorld(story);
  for (const cmd of [
    { t: 'rain', x: 800, y: 450 },
    { t: 'welcome', on: false },
    { t: 'path', x: 100, y: 100, x2: 900, y2: 100 },
  ] satisfies Command[]) {
    const rng = scriptedRng([]);
    expect(applyCommand(story, cmd, t, rng)).toEqual([]);
    expect(rng.used()).toBe(0);
  }
  expect(hashWorld(story)).toBe(hash);
});

test('the m0 golden hash is unchanged', () => {
  expect(hashWorld(runGolden())).toBe('c29d2fa4dbda4dcf');
});
