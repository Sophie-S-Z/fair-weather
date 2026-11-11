/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import scenarioJson from '../../../content/scenarios/m0.json';
import { moveCreatures } from '../../../src/sim/move.ts';
import { createRng } from '../../../src/sim/rng.ts';
import { dist2 } from '../../../src/sim/math.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { Scenario, Structure, World } from '../../../src/sim/types.ts';
import { byId, createWorld, ensureTie, side } from '../../../src/sim/world.ts';
import { scriptedRng } from './helpers.ts';

const tuning = parseTuning(tuningJson);
const scenario = scenarioJson as Scenario;
const perTick = tuning.move.speed / tuning.sim.stepsPerSecond;

/** Advance the world n ticks the way step() will: move, then tick++. */
function run(world: World, n: number, seed = 9): void {
  const rng = createRng(seed);
  for (let i = 0; i < n; i++) {
    moveCreatures(world, tuning, rng);
    world.tick++;
  }
}

/** One creature alone, no bushes unless given. */
function solo(over: Partial<Scenario['creatures'][number]> = {}, bushes: Scenario['bushes'] = []): World {
  const base = scenario.creatures[0]!;
  return createWorld(1, tuning, { ...scenario, creatures: [{ ...base, x: 800, y: 450, ...over }], bushes });
}

test('a creature never exceeds speed per tick and stays in the scene', () => {
  const w = createWorld(3, tuning, scenario);
  const rng = createRng(3);
  for (let i = 0; i < 600; i++) {
    const before = w.creatures.map((c) => [c.x, c.y] as const);
    moveCreatures(w, tuning, rng);
    w.tick++;
    w.creatures.forEach((c, k) => {
      const [bx, by] = before[k]!;
      expect(Math.sqrt(dist2(c.x, c.y, bx, by))).toBeLessThanOrEqual(perTick + 1e-9);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(tuning.scene.width);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(tuning.scene.height);
    });
  }
});

test('a creature picks a goal on the first tick and a new one on arrival', () => {
  const w = solo({ berries: 3 });
  const c = w.creatures[0]!;
  const rng = createRng(5);
  moveCreatures(w, tuning, rng);
  w.tick++;
  expect(c.goalX !== 800 || c.goalY !== 450).toBe(true);
  const goals = new Set<string>();
  for (let i = 0; i < 3000; i++) {
    moveCreatures(w, tuning, rng);
    w.tick++;
    goals.add(String(c.goalX) + ',' + String(c.goalY));
  }
  expect(goals.size).toBeGreaterThan(3);
});

test('a creature with 0 berries picks a bush with berries', () => {
  const w = solo({ berries: 0 }, [
    { id: 'empty', x: 100, y: 100, berries: 0 },
    { id: 'full', x: 1200, y: 700, berries: 4 },
  ]);
  run(w, 1);
  expect([w.creatures[0]!.goalX, w.creatures[0]!.goalY]).toEqual([1200, 700]);
});

test('a creature near a bush takes 1 berry, then waits the cooldown', () => {
  const w = solo({ berries: 0 }, [{ id: 'b', x: 810, y: 450, berries: 5 }]);
  const c = w.creatures[0]!;
  run(w, 1);
  expect(c.berries).toBe(1);
  expect(w.bushes[0]!.berries).toBe(4);
  expect(c.forageReadyTick).toBe(0 + tuning.forage.cooldownTicks);
  run(w, tuning.forage.cooldownTicks - 1);
  expect(c.berries).toBe(1);
  c.x = 810; // the creature may have wandered off; put it back in reach
  c.y = 450;
  run(w, 1);
  expect(c.berries).toBe(2);
});

test('foraging stops at carryMax and ignores bushes out of reach or empty', () => {
  const w = solo({ berries: 5 }, [{ id: 'b', x: 810, y: 450, berries: 5 }]);
  run(w, 200);
  expect(w.creatures[0]!.berries).toBe(5);
  const far = solo({ berries: 0 }, [{ id: 'b', x: 1500, y: 450, berries: 5 }]);
  run(far, 1);
  expect(far.creatures[0]!.berries).toBe(0);
  const empty = solo({ berries: 0 }, [{ id: 'b', x: 810, y: 450, berries: 0.5 }]);
  run(empty, 1);
  expect(empty.creatures[0]!.berries).toBe(0);
});

test('wanderlust 0 with one friend picks that friend', () => {
  const w = createWorld(1, tuning, {
    ...scenario,
    creatures: [
      {
        ...scenario.creatures[0]!,
        x: 100,
        y: 100,
        berries: 2,
        dials: { ...scenario.creatures[0]!.dials, wanderlust: 0 },
      },
      { ...scenario.creatures[1]!, x: 1300, y: 600, berries: 2 },
    ],
    bushes: [],
  });
  const a = byId(w, 'pim')!;
  const t = ensureTie(w, a, byId(w, 'krit')!, tuning);
  side(t, 'pim').warmth = 0.5;
  run(w, 1);
  expect([a.goalX, a.goalY]).toEqual([1300, 600]);
});

test('a bench attracts with the doubled chance the day after a meeting there', () => {
  const bench = { id: 'bench-1', kind: 'bench' as const, x: 1500, y: 800 };
  const pick = (memory: boolean, seed: number): boolean => {
    const w = solo({ berries: 3 });
    w.structures.push(bench);
    w.day = 5;
    if (memory) w.creatures[0]!.benchMemory = { benchId: 'bench-1', day: 4 };
    run(w, 1, seed);
    return w.creatures[0]!.goalX === 1500 && w.creatures[0]!.goalY === 800;
  };
  let plain = 0;
  let remembered = 0;
  for (let s = 0; s < 2000; s++) {
    if (pick(false, s)) plain++;
    if (pick(true, s)) remembered++;
  }
  expect(plain / 2000).toBeGreaterThan(0.2);
  expect(plain / 2000).toBeLessThan(0.3);
  expect(remembered / 2000).toBeGreaterThan(0.45);
  expect(remembered / 2000).toBeLessThan(0.55);
});

test('only structures of kind bench attract', () => {
  const w = solo({ berries: 3 });
  // A future structure kind; the cast stands in for a wider Structure['kind'] union.
  w.structures.push({ id: 'lantern-1', kind: 'lantern', x: 1500, y: 800 } as unknown as Structure);
  // With a bench check, draw 0 would pick the structure. Without, draws pick cell 0 and a point in it.
  const rng = scriptedRng([0, 0.5, 0.5]);
  moveCreatures(w, tuning, rng);
  expect([w.creatures[0]!.goalX, w.creatures[0]!.goalY]).toEqual([100, 112.5]);
  expect(rng.used()).toBe(3);
});

test('visits count one cell per tick, 8 by 4 over the scene', () => {
  const w = solo({ berries: 3, x: 50, y: 50 });
  run(w, 1);
  const v = w.creatures[0]!.visits;
  expect(v.reduce((a, b) => a + b, 0)).toBe(1);
  expect(v[0]).toBe(1);
});

test('random goals head for the least-visited cells', () => {
  const w = solo({ berries: 3 });
  const c = w.creatures[0]!;
  c.visits.fill(10);
  c.visits[31] = 0; // bottom-right cell
  run(w, 1);
  expect(c.goalX).toBeGreaterThanOrEqual(1400);
  expect(c.goalY).toBeGreaterThanOrEqual(675);
});

test('meet creatures stand still, then return to wander at stateUntilTick', () => {
  const w = solo({ berries: 3 });
  const c = w.creatures[0]!;
  c.state = 'meet';
  c.stateUntilTick = 5;
  c.goalX = 100;
  run(w, 5);
  expect([c.x, c.y]).toEqual([800, 450]);
  expect(c.state).toBe('meet');
  run(w, 1);
  expect(c.state).toBe('wander');
  run(w, 5);
  expect(c.x !== 800 || c.y !== 450).toBe(true);
});

test('non-wander creatures do not move or forage', () => {
  const w = solo({ berries: 0 }, [{ id: 'b', x: 810, y: 450, berries: 5 }]);
  for (const s of ['sleep', 'leave', 'away'] as const) {
    w.creatures[0]!.state = s;
    run(w, 5);
    expect(w.creatures[0]!.berries).toBe(0);
    expect(w.creatures[0]!.x).toBe(800);
  }
});

test('the same seed gives the same walk', () => {
  const a = createWorld(4, tuning, scenario);
  const b = createWorld(4, tuning, scenario);
  run(a, 300, 4);
  run(b, 300, 4);
  expect(a.creatures.map((c) => [c.x, c.y])).toEqual(b.creatures.map((c) => [c.x, c.y]));
});
