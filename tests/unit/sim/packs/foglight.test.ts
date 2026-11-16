/* eslint-disable @typescript-eslint/no-non-null-assertion -- the fixtures always have Foglight */
// Foglight Heights (ADR 0015 item 3).
import { expect, test } from 'vitest';
import { applyCommand } from '../../../../src/sim/commands.ts';
import { PACKS } from '../../../../src/sim/packs/index.ts';
import { step } from '../../../../src/sim/step.ts';
import type { FoglightState, HeroKind, Scenario, World } from '../../../../src/sim/types.ts';
import { HERO } from '../../../../src/sim/types.ts';
import { createWorld } from '../../../../src/sim/world.ts';
import { toLite } from '../../../../src/sim-host/lite.ts';
import { checkInvariants } from '../../../../src/sim/invariants.ts';
import { get, hasBadNumber, scriptedRng, setWarmth, tuning as t } from '../helpers.ts';

const COLS = 16;
const ROWS = 9;
const DIALS = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
/** Cell centers: column c, row r. */
const at = (c: number, r: number): [number, number] => [c * 100 + 50, r * 100 + 50];

/**
 * A map whose height rises by column from 1 to a small peak at column 4 (height 5), falls to a fog valley
 * at columns 6 to 8 (height 1), and climbs to the meadow (height 9) at column 15.
 */
const PROFILE = [1, 2, 3, 4, 5, 3, 1, 1, 1, 3, 5, 6, 7, 8, 9, 9];
const MAP = Array.from({ length: ROWS }, () => PROFILE).flat();

function foglightWorld(
  snails: { id: string; x: number; y: number }[],
  hero?: { x: number; y: number; kind?: HeroKind },
  heights = MAP,
): World {
  const scenario: Scenario = {
    valleyId: 'foglight',
    season: 'spring',
    creatures: snails.map((c) => ({ ...c, speciesId: 'snail', name: c.id, berries: 3, dials: DIALS })),
    bushes: [],
    structures: [],
    pack: { id: 'foglight', heights, meadow: 9, guide: 'brume' },
  };
  if (hero) {
    const { kind = 'lantern', ...p } = hero;
    scenario.hero = { kind, name: 'Wren', ...p, berries: 3, keepsakes: [], rumor: null };
  }
  return createWorld(1, t, scenario);
}

function fog(w: World): FoglightState {
  const p = w.pack!;
  if (p.id !== 'foglight') throw new Error('not Foglight');
  return p;
}

/** Runs whole ticks with no commands. */
function run(w: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(w, [], t);
}

const stepDown = (w: World, on: boolean) =>
  applyCommand(w, { t: 'local', verb: { verb: 'stepDown', on } }, t, scriptedRng([]));

test('the map must hold one height per cell', () => {
  expect(() => foglightWorld([], undefined, [1, 2, 3])).toThrow(/144 heights/);
});

test('fog lies on low ground and the meadow is clear', () => {
  const w = foglightWorld([]);
  const { fog: cells, fogW } = w.fields;
  const fogAt = (x: number, y: number) => cells[Math.floor(y / 40) * fogW + Math.floor(x / 40)];
  const below = t.foglight.fogBelow;
  expect(fogAt(...at(7, 4))).toBeCloseTo((below - 1) / below);
  expect(fogAt(...at(3, 4))).toBeCloseTo((below - 4) / below);
  expect(fogAt(...at(15, 4))).toBe(0);
});

test('a snail climbs to the highest cell within one step and stops on a local peak', () => {
  const w = foglightWorld([{ id: 'slow', ...xy(1, 4) }]);
  run(w, 2000);
  const s = get(w, 'slow');
  expect(Math.floor(s.x / 100)).toBe(4);
  expect(Math.abs(s.vx) + Math.abs(s.vy)).toBeLessThan(1e-6);
});

test('a snail in the fog valley climbs toward the nearer higher side, never down', () => {
  const w = foglightWorld([{ id: 'lost', ...xy(8, 4) }]);
  const heights: number[] = [];
  for (let i = 0; i < 3000; i++) {
    step(w, [], t);
    heights.push(PROFILE[Math.floor(get(w, 'lost').x / 100)] ?? 0);
  }
  expect(heights.every((h, i) => i === 0 || h >= (heights[i - 1] ?? 0))).toBe(true);
  expect(heights.at(-1)).toBe(9);
});

test('snails on one peak stand apart', () => {
  const w = foglightWorld([
    { id: 'a', ...xy(4, 4) },
    { id: 'b', ...xy(4, 4) },
    { id: 'c', ...xy(4, 4) },
  ]);
  run(w, 300);
  const xs = ['a', 'b', 'c'].map(
    (id) => `${String(Math.round(get(w, id).x))},${String(Math.round(get(w, id).y))}`,
  );
  expect(new Set(xs).size).toBe(3);
});

test('the hero cannot step into a lower cell until it steps down', () => {
  const w = foglightWorld([], { x: at(4, 4)[0], y: at(4, 4)[1] });
  applyCommand(w, { t: 'walk', x: at(7, 4)[0], y: at(7, 4)[1] }, t, scriptedRng([]));
  run(w, 100);
  expect(Math.floor(get(w, HERO).x / 100)).toBe(4);
  stepDown(w, true);
  applyCommand(w, { t: 'walk', x: at(7, 4)[0], y: at(7, 4)[1] }, t, scriptedRng([]));
  run(w, 200);
  expect(Math.floor(get(w, HERO).x / 100)).toBe(7);
});

test('the hero may always walk up or level', () => {
  const w = foglightWorld([], { x: at(0, 4)[0], y: at(0, 4)[1] });
  applyCommand(w, { t: 'walk', x: at(4, 2)[0], y: at(4, 2)[1] }, t, scriptedRng([]));
  run(w, 300);
  expect(Math.floor(get(w, HERO).x / 100)).toBe(4);
});

test('Brume follows only a hero it trusts, once the hero steps down near it', () => {
  const [hx, hy] = at(4, 4);
  const cold = foglightWorld([{ id: 'brume', x: hx + 20, y: hy }], { x: hx, y: hy });
  stepDown(cold, true);
  run(cold, 20);
  expect(fog(cold).following).toBe(false);

  const warm = foglightWorld([{ id: 'brume', x: hx + 20, y: hy }], { x: hx, y: hy });
  setWarmth(warm, 'brume', HERO, t.friend.threshold);
  run(warm, 20);
  expect(fog(warm).following).toBe(false);
  stepDown(warm, true);
  const events = step(warm, [], t);
  expect(events).toContainEqual({ t: 'follow', who: 'brume' });
  expect(fog(warm).following).toBe(true);
});

test('a following Brume halves the hero speed while it walks beside it', () => {
  const [hx, hy] = at(4, 4);
  const w = foglightWorld([{ id: 'brume', x: hx + 10, y: hy }], { x: hx, y: hy });
  setWarmth(w, 'brume', HERO, 0.5);
  stepDown(w, true);
  step(w, [], t);
  applyCommand(w, { t: 'walk', x: at(9, 4)[0], y: hy }, t, scriptedRng([]));
  run(w, 100);
  const hero = get(w, HERO);
  expect(Math.hypot(hero.vx, hero.vy)).toBeCloseTo(t.move.speed * t.foglight.carrySpeed, 5);
  expect(Math.hypot(get(w, 'brume').x - hero.x, get(w, 'brume').y - hero.y)).toBeLessThan(
    t.foglight.followRadii * t.meet.radius,
  );
});

test('the snapshot carries the map, Brume, and Step down; metrics give the heights', () => {
  const w = foglightWorld([{ id: 'brume', ...xy(4, 4) }], { x: at(14, 4)[0], y: at(14, 4)[1] });
  stepDown(w, true);
  expect(toLite(w, t).pack).toEqual({
    id: 'foglight',
    cols: COLS,
    heights: MAP,
    meadow: 9,
    guide: 'brume',
    following: false,
    stepDown: true,
  });
  expect(PACKS.foglight.metrics(w, t)).toEqual({ guideHeight: 5, heroHeight: 9 });
});

test('Foglight runs keep their invariants and take no draws of their own', () => {
  const w = foglightWorld(
    Array.from({ length: 12 }, (_, i) => ({ id: `s${String(i)}`, ...xy(i % COLS, i % ROWS) })),
    { x: 50, y: 450 },
  );
  run(w, 600);
  expect(checkInvariants(w, t)).toEqual([]);
  expect(hasBadNumber(w)).toBe(false);
  expect(PACKS.foglight.step(w, [], t, scriptedRng([]))).toBeDefined();
});

function xy(c: number, r: number): { x: number; y: number } {
  const [x, y] = at(c, r);
  return { x, y };
}
