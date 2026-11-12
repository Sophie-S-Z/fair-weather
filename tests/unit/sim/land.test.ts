import fc from 'fast-check';
import { expect, test } from 'vitest';
import { bridgeNear, inWater } from '../../../src/sim/land.ts';
import { fogAt } from '../../../src/sim/light.ts';
import { step } from '../../../src/sim/step.ts';
import type { Rect, SimEvent, Structure, World } from '../../../src/sim/types.ts';
import { activeCreatures } from '../../../src/sim/world.ts';
import { landRunArb, replay } from '../../property/arbitraries.ts';
import { befriend, get, makeWorld, tuning as t, type CreatureSpec } from './helpers.ts';

const brook: Rect = { x: 780, y: 0, w: 60, h: 900 };

/** 30 creatures, half west and half east of the brook, each with a goal across it. */
function brookWorld(structures: Structure[]): World {
  const specs: CreatureSpec[] = [];
  for (let i = 0; i < 30; i++) {
    const west = i < 15;
    specs.push({ id: `c${String(i)}`, x: west ? 100 + i * 40 : 900 + (i - 15) * 40, y: 30 + i * 28 });
  }
  const w = makeWorld(specs, { water: [brook], structures, ticksPerDay: 400 });
  for (const c of w.creatures) {
    c.goalX = c.x < 780 ? 1400 : 200;
    c.goalY = 900 - c.y;
  }
  return w;
}

test('with no bridge, no creature crosses the brook in 10 days', () => {
  const w = brookWorld([]);
  const west = new Set(w.creatures.filter((c) => c.x < 780).map((c) => c.id));
  while (w.day < 10) {
    step(w, [], t);
    for (const c of w.creatures) {
      if (west.has(c.id)) expect(c.x).toBeLessThan(brook.x);
      else expect(c.x).toBeGreaterThan(brook.x + brook.w);
    }
  }
});

test('with one bridge at (810, 450), a creature crosses only within 32 units of it', () => {
  const bridge: Structure = { id: 'bridge-s0', kind: 'bridge', x: 810, y: 450 };
  const w = brookWorld([bridge]);
  const startWest = new Map(w.creatures.map((c) => [c.id, c.x < 780]));
  const crossed = new Set<string>();
  while (w.day < 10) {
    step(w, [], t);
    for (const c of activeCreatures(w)) {
      if (inWater(w, c.x, c.y))
        expect(Math.sqrt((c.x - 810) ** 2 + (c.y - 450) ** 2)).toBeLessThanOrEqual(32);
      if (c.x < brook.x !== startWest.get(c.id) && !inWater(w, c.x, c.y)) crossed.add(c.id);
    }
  }
  expect(crossed.size).toBeGreaterThan(0);
});

test('a creature never stands in water away from a bridge (property, 500 runs)', () => {
  fc.assert(
    fc.property(landRunArb, (run) => {
      replay(run, (w) => {
        for (const c of activeCreatures(w)) {
          if (inWater(w, c.x, c.y)) expect(bridgeNear(w, c.x, c.y, t)).not.toBeNull();
        }
      });
    }),
    { numRuns: 500 },
  );
});

test('a world with no water has no water anywhere', () => {
  const w = makeWorld([{ id: 'a' }]);
  expect(w.water).toBeUndefined();
  expect(inWater(w, 800, 450)).toBe(false);
});

test('bridgeNear finds a bridge within 32 units, edge included, and nothing else', () => {
  const w = makeWorld([], {
    water: [brook],
    structures: [
      { id: 'bench-s0', kind: 'bench', x: 810, y: 300 },
      { id: 'bridge-s0', kind: 'bridge', x: 810, y: 450 },
    ],
  });
  expect(bridgeNear(w, 810, 482, t)?.id).toBe('bridge-s0');
  expect(bridgeNear(w, 810, 483, t)).toBeNull();
  expect(bridgeNear(w, 810, 300, t)).toBeNull();
});

test('a lantern halves the fog within 120 units and nowhere else', () => {
  const w = makeWorld([], { structures: [{ id: 'lantern-s0', kind: 'lantern', x: 100, y: 100 }] });
  w.fields.fog.fill(0.6);
  expect(fogAt(w, 100, 100, t)).toBeCloseTo(0.3);
  expect(fogAt(w, 100, 220, t)).toBeCloseTo(0.3);
  expect(fogAt(w, 100, 221, t)).toBeCloseTo(0.6);
  expect(fogAt(w, 400, 400, t)).toBeCloseTo(0.6);
});

test('with a ridge at 1500, no random goal is at x >= 1500', () => {
  const specs: CreatureSpec[] = [];
  for (let i = 0; i < 10; i++)
    specs.push({ id: `c${String(i)}`, x: 1000 + i * 40, y: 80 + i * 80, berries: 100 });
  const w = makeWorld(specs, { ridgeX: 1500 });
  const goals = new Set<number>();
  while (w.day < 10) {
    step(w, [], t);
    for (const c of w.creatures) {
      expect(c.gone).toBeUndefined();
      expect(c.goalX).toBeLessThan(1500);
      goals.add(c.goalX);
    }
  }
  expect(Math.max(...goals)).toBeGreaterThan(1400); // the east column was picked
});

test('a gust from (1300, 300) by (400, 0) sends Wisp to the ridge, and Wisp leaves for good', () => {
  const w = makeWorld(
    [
      { id: 'wisp', x: 1300, y: 300 },
      { id: 'pim', x: 300, y: 600, berries: 100 },
      { id: 'bell', x: 340, y: 600, berries: 100 },
    ],
    { ridgeX: 1500, ticksPerDay: 40 },
  );
  befriend(w, 'pim', 'bell', 0.9); // warm enough for the weekly return to fire
  befriend(w, 'wisp', 'pim', 0.9);
  const events: SimEvent[] = step(w, [{ t: 'blow', x: 1300, y: 300, dx: 400, dy: 0 }], t);
  expect(get(w, 'wisp').goalX).toBe(t.scene.width);
  expect(get(w, 'wisp').goalY).toBe(300);
  while (get(w, 'wisp').state !== 'away') events.push(...step(w, [], t));
  expect(get(w, 'wisp').gone).toBe(true);
  while (w.day < 22) {
    events.push(...step(w, [], t));
    expect(get(w, 'wisp').state).toBe('away');
  }
  expect(events.filter((e) => 'who' in e && e.who === 'wisp')).toEqual([{ t: 'leave', who: 'wisp' }]);
});
