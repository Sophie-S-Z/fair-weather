import { expect, test } from 'vitest';
import {
  bridgeDeck,
  inRect,
  inWater,
  islets,
  landOf,
  waterBlocking,
  withBank,
} from '../../../src/sim/land.ts';
import { fogAt } from '../../../src/sim/light.ts';
import { step } from '../../../src/sim/step.ts';
import type { Rect, SimEvent, Structure, World } from '../../../src/sim/types.ts';
import { activeCreatures } from '../../../src/sim/world.ts';
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
      if (west.has(c.id)) expect(c.x).toBeLessThan(brook.x - t.bank.side);
      else expect(c.x).toBeGreaterThan(brook.x + brook.w + t.bank.side);
    }
  }
});

test('with one bridge at (810, 450), a creature enters the bank only on its deck, and crosses', () => {
  const bridge: Structure = { id: 'bridge-s0', kind: 'bridge', x: 810, y: 450 };
  const w = brookWorld([bridge]);
  const bank = withBank(brook, t);
  const deck = bridgeDeck(bridge, [brook], t);
  const startWest = new Map(w.creatures.map((c) => [c.id, c.x < 780]));
  const crossed = new Set<string>();
  while (w.day < 10) {
    step(w, [], t);
    for (const c of activeCreatures(w)) {
      if (inRect(bank, c.x, c.y)) expect(deck && inRect(deck, c.x, c.y)).toBe(true);
      if (c.x < brook.x !== startWest.get(c.id) && !inRect(bank, c.x, c.y)) crossed.add(c.id);
    }
  }
  expect(crossed.size).toBeGreaterThan(0);
});

/** The longest run of ticks in which some wandering creature does not move, over `days`. */
function longestStill(w: World, days: number, each?: () => void): number {
  const last = new Map(w.creatures.map((c) => [c.id, [c.x, c.y]]));
  const still = new Map<string, number>();
  let longest = 0;
  while (w.day < days) {
    step(w, [], t);
    each?.();
    for (const c of w.creatures) {
      const [x, y] = last.get(c.id) ?? [];
      const n = c.state === 'wander' && x === c.x && y === c.y ? (still.get(c.id) ?? 0) + 1 : 0;
      still.set(c.id, n);
      longest = Math.max(longest, n);
      last.set(c.id, [c.x, c.y]);
    }
  }
  return longest;
}

test('a hungry creature whose nearest bush is across a bridgeless brook does not freeze', () => {
  const w = makeWorld([{ id: 'a', x: 700, y: 450, berries: 0, wanderlust: 1 }], {
    water: [brook],
    bushes: [
      { id: 'e', x: 900, y: 450, berries: 5 },
      { id: 'w', x: 100, y: 450, berries: 5 },
    ],
  });
  expect(longestStill(w, 3)).toBeLessThanOrEqual(40);
  expect(get(w, 'a').state).toBe('wander');
});

test('creatures do not freeze at a pond whose mid bridge neither bank can reach', () => {
  const pond: Rect = { x: 700, y: 0, w: 200, h: 900 };
  const specs: CreatureSpec[] = [];
  for (let i = 0; i < 10; i++)
    specs.push({ id: `c${String(i)}`, x: 300 + i * 30, y: 60 + i * 80, berries: 100 });
  const w = makeWorld(specs, {
    water: [pond],
    structures: [{ id: 'bridge-s0', kind: 'bridge', x: 800, y: 450 }],
  });
  for (const c of w.creatures)
    c.visits.fill(1000, 0, 4).fill(1000, 8, 12).fill(1000, 16, 20).fill(1000, 24, 28);
  expect(longestStill(w, 5)).toBeLessThanOrEqual(40);
});

test('a world with no water has no water anywhere', () => {
  const w = makeWorld([{ id: 'a' }]);
  expect(w.water).toBeUndefined();
  expect(inWater(w, 800, 450)).toBe(false);
});

test('a bank grows water by bank.side left, right and above, and bank.below under it', () => {
  const { side, below } = t.bank;
  expect(withBank({ x: 100, y: 200, w: 60, h: 40 }, t)).toEqual({
    x: 100 - side,
    y: 200 - side,
    w: 60 + 2 * side,
    h: 40 + side + below,
  });
});

test('a deck crosses the water and its bank the short way, bridge.landing past each side', () => {
  const { radius, landing } = t.bridge;
  const { side, below } = t.bank;
  const bridge: Structure = { id: 'bridge-s0', kind: 'bridge', x: 810, y: 450 };
  expect(bridgeDeck(bridge, [brook], t)).toEqual({
    x: 780 - side - landing,
    y: 450 - radius,
    w: 60 + 2 * side + 2 * landing,
    h: 2 * radius,
    eastWest: true,
  });
  const river: Rect = { x: 0, y: 400, w: 1600, h: 60 };
  expect(bridgeDeck({ ...bridge, x: 500, y: 430 }, [river], t)).toEqual({
    x: 500 - radius,
    y: 400 - side - landing,
    w: 2 * radius,
    h: 60 + side + below + 2 * landing,
    eastWest: false,
  });
  expect(bridgeDeck({ ...bridge, x: 100 }, [brook], t)).toBeNull();
});

test('a step into the bank is refused off a deck and allowed along one', () => {
  const bridge: Structure = { id: 'bridge-s0', kind: 'bridge', x: 810, y: 450 };
  const land = landOf(makeWorld([], { water: [brook], structures: [bridge] }), t);
  const edge = brook.x - t.bank.side;
  expect(waterBlocking(land, edge - 2, 200, edge + 1, 200)).toEqual(brook);
  expect(waterBlocking(land, edge - 2, 200, edge - 1, 200)).toBeNull();
  expect(waterBlocking(land, edge - 2, 450, edge + 2, 450)).toBeNull();
  expect(waterBlocking(land, 810, 450, 810, 450 + t.bridge.radius + 1)).toEqual(brook);
});

test('a creature in a bank off a deck may walk out or along it, never nearer the water', () => {
  const land = landOf(makeWorld([], { water: [brook] }), t);
  const edge = brook.x - t.bank.side;
  expect(waterBlocking(land, edge + 4, 200, edge + 1, 200)).toBeNull(); // out
  expect(waterBlocking(land, edge + 4, 200, edge + 4, 210)).toBeNull(); // along
  expect(waterBlocking(land, edge + 4, 200, edge + 6, 200)).toEqual(brook); // deeper
  expect(waterBlocking(land, edge + 4, 200, brook.x + 1, 200)).toEqual(brook); // into the water
});

// The ch6 pond: a ring of water round a 60 x 60 islet at (990, 390).
const pond: Rect[] = [
  { x: 950, y: 350, w: 140, h: 40 },
  { x: 950, y: 450, w: 140, h: 40 },
  { x: 950, y: 390, w: 40, h: 60 },
  { x: 1050, y: 390, w: 40, h: 60 },
];

test('the ground a ring of water closes in is an islet, walked freely but never left', () => {
  expect(islets(pond)).toEqual([{ x: 990, y: 390, w: 60, h: 60 }]);
  expect(islets([brook])).toEqual([]);
  const land = landOf(makeWorld([], { water: pond }), t);
  // The islet lies wholly in the bank, too small for a body clear of the water: its residents are
  // held by the water only.
  expect(waterBlocking(land, 1000, 400, 1040, 440)).toBeNull();
  expect(waterBlocking(land, 1040, 440, 1000, 400)).toBeNull();
  expect(waterBlocking(land, 1000, 400, 985, 400)).toEqual(pond[2]);
});

test('two creatures on an islet walk it, never stall at the water, and never leave it', () => {
  const w = makeWorld(
    [
      { id: 'a', x: 1005, y: 420, berries: 100 },
      { id: 'b', x: 1035, y: 420, berries: 100 },
    ],
    { water: pond },
  );
  const isle = { x: 990, y: 390, w: 60, h: 60 };
  const seen = new Set<string>();
  const check = (): void => {
    for (const c of w.creatures) {
      expect(inRect(isle, c.x, c.y)).toBe(true);
      seen.add(`${String(Math.round(c.x / 10))},${String(Math.round(c.y / 10))}`);
    }
  };
  expect(longestStill(w, 3, check)).toBeLessThanOrEqual(2);
  expect(seen.size).toBeGreaterThan(4);
});

test('on an islet the ridge still caps the goal, after the islet keeps it on the islet', () => {
  // The islet runs from x 990 to 1050; a ridge at 1040 leaves its east end past the cap.
  const ridgeX = 1040;
  const margin = t.move.arriveRadius + (t.move.speed * t.move.speed) / (2 * t.move.accel);
  const w = makeWorld([{ id: 'a', x: 1000, y: 420, berries: 100 }], { water: pond, ridgeX });
  while (w.day < 3) {
    step(w, [], t);
    expect(get(w, 'a').goalX).toBeLessThanOrEqual(ridgeX - margin);
    expect(get(w, 'a').gone).toBeUndefined();
  }
});

test('a creature placed in a bank starts just past it; on an islet or a deck it stays', () => {
  const edge = brook.x - t.bank.side;
  const w = makeWorld(
    [
      { id: 'bank', x: 760, y: 200 },
      { id: 'deck', x: 760, y: 450 },
    ],
    { water: [brook], structures: [{ id: 'bridge-s0', kind: 'bridge', x: 810, y: 450 }] },
  );
  expect([get(w, 'bank').x, get(w, 'bank').y]).toEqual([edge - 1, 200]);
  expect([get(w, 'bank').goalX, get(w, 'bank').goalY]).toEqual([edge - 1, 200]);
  expect([get(w, 'deck').x, get(w, 'deck').y]).toEqual([760, 450]);
  const isle = makeWorld([{ id: 'isle', x: 1005, y: 420 }], { water: pond });
  expect([get(isle, 'isle').x, get(isle, 'isle').y]).toEqual([1005, 420]);
});

test('a creature turned back on one deck aims at that deck, not a nearer bridge beside it', () => {
  // Bridge b is nearer the creature than bridge a, whose deck it stands on.
  const a: Structure = { id: 'bridge-a', kind: 'bridge', x: 785, y: 300 };
  const b: Structure = { id: 'bridge-b', kind: 'bridge', x: 835, y: 380 };
  const deck = bridgeDeck(a, [brook], t);
  if (!deck) throw new Error('no deck');
  const w = makeWorld([{ id: 'c', x: 840, y: deck.y + deck.h - 1 }], {
    water: [brook],
    structures: [a, b],
  });
  const c = get(w, 'c');
  expect((c.x - b.x) ** 2 + (c.y - b.y) ** 2).toBeLessThan((c.x - a.x) ** 2 + (c.y - a.y) ** 2);
  // Heading south-east, off the deck's south edge into the bank: refused.
  [c.vx, c.vy] = [0, t.move.speed];
  [c.goalX, c.goalY] = [1000, 700];
  step(w, [], t);
  expect([c.x, c.y]).toEqual([840, deck.y + deck.h - 1]);
  expect([c.goalX, c.goalY]).toEqual([deck.x + deck.w, a.y]);
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

test('a bench east of the ridge walks nobody over', () => {
  const specs: CreatureSpec[] = [];
  for (let i = 0; i < 10; i++)
    specs.push({ id: `c${String(i)}`, x: 1200 + i * 20, y: 80 + i * 80, berries: 100 });
  const w = makeWorld(specs, {
    ridgeX: 1500,
    structures: [{ id: 'bench-s0', kind: 'bench', x: 1550, y: 450 }],
  });
  while (w.day < 5) {
    step(w, [], t);
    for (const c of w.creatures) expect(c.gone).toBeUndefined();
  }
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
