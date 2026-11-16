/* eslint-disable @typescript-eslint/no-non-null-assertion -- the fixtures always have a pond */
// Lily Shallows (ADR 0015 item 5).
import { expect, test } from 'vitest';
import { applyCommand } from '../../../../src/sim/commands.ts';
import { checkInvariants } from '../../../../src/sim/invariants.ts';
import { PACKS } from '../../../../src/sim/packs/index.ts';
import { sorting } from '../../../../src/sim/packs/shallows.ts';
import { step } from '../../../../src/sim/step.ts';
import type { LocalVerb, Scenario, ShallowsState, Song, World } from '../../../../src/sim/types.ts';
import { createWorld } from '../../../../src/sim/world.ts';
import { toLite } from '../../../../src/sim-host/lite.ts';
import { get, hasBadNumber, scriptedRng, tuning as t } from '../helpers.ts';

const DIALS = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
const PADS = [
  { id: 'p1', x: 300, y: 300 },
  { id: 'p2', x: 800, y: 300 },
  { id: 'p3', x: 1300, y: 300 },
];
type Frog = { id: string; pad: string; songs: Song[] };

function pond(frogs: Frog[], hero = false, variety = false): World {
  const scenario: Scenario = {
    valleyId: 'shallows',
    season: 'summer',
    creatures: frogs.map((f) => ({
      id: f.id,
      speciesId: 'frog',
      name: f.id,
      x: 0,
      y: 0,
      berries: 3,
      dials: DIALS,
    })),
    bushes: [],
    structures: [],
    pack: {
      id: 'shallows',
      pads: PADS,
      padOf: Object.fromEntries(frogs.map((f) => [f.id, f.pad])),
      songs: Object.fromEntries(frogs.map((f) => [f.id, f.songs])),
      ...(variety ? { variety: true as const } : {}),
    },
  };
  if (hero)
    scenario.hero = {
      kind: 'seedcarrier',
      name: 'Wren',
      x: 300,
      y: 300,
      berries: 3,
      keepsakes: [],
      rumor: null,
    };
  return createWorld(1, t, scenario);
}

const shallows = (w: World): ShallowsState => {
  const p = w.pack!;
  if (p.id !== 'shallows') throw new Error('not the Shallows');
  return p;
};
const local = (w: World, verb: LocalVerb) => applyCommand(w, { t: 'local', verb }, t, scriptedRng([]));
/** The pond's own check, with the given draws. */
const check = (w: World, draws: number[] = []) => {
  w.tick = 0;
  return PACKS.shallows.step(w, [], t, scriptedRng(draws));
};
const frog = (id: string, pad: string, ...songs: Song[]): Frog => ({ id, pad, songs });

test('frogs take the lowest free slots of their pads and stand there', () => {
  const w = pond([frog('a', 'p1', 'reed'), frog('b', 'p1', 'reed'), frog('c', 'p2', 'rain')]);
  expect(shallows(w).slotOf).toEqual({ a: 0, b: 1, c: 0 });
  expect([get(w, 'a').x, get(w, 'a').y]).toEqual([300 - t.shallows.slot, 300]);
  expect([get(w, 'b').x, get(w, 'b').y]).toEqual([300 + t.shallows.slot, 300]);
});

test('a pad past its capacity, or a frog on no pad, throws', () => {
  const full = Array.from({ length: t.shallows.padCap + 1 }, (_, i) => frog(`f${String(i)}`, 'p1', 'reed'));
  expect(() => pond(full)).toThrow(/holds more than/);
  expect(() => pond([frog('a', 'nowhere', 'reed')])).toThrow(/no pad/);
});

test('a frog hops when fewer than a third of its pad-mates share a song with it, one draw each', () => {
  // On p1: a (reed) with three rain frogs: a's share is 0, the rain frogs' 2/3.
  const w = pond([
    frog('a', 'p1', 'reed'),
    frog('b', 'p1', 'rain'),
    frog('c', 'p1', 'rain'),
    frog('d', 'p1', 'rain'),
    frog('e', 'p2', 'reed'),
  ]);
  const rng = scriptedRng([0.6]);
  PACKS.shallows.step(Object.assign(w, { tick: 0 }), [], t, rng);
  expect(rng.used()).toBe(1);
  // Pads with room, in pad order: p2, p3; 0.6 × 2 picks p3.
  expect(shallows(w).padOf.a).toBe('p3');
  expect(shallows(w).slotOf.a).toBe(0);
});

test('a lone frog is content, a third is enough, and a frog who knows two songs matches both', () => {
  const alone = pond([frog('a', 'p1', 'reed')]);
  expect(check(alone)).toEqual([{ t: 'settled' }]);
  // b shares with 1 of its 3 mates: exactly a third, content.
  const third = pond([
    frog('a', 'p1', 'reed'),
    frog('b', 'p1', 'reed'),
    frog('c', 'p1', 'rain'),
    frog('d', 'p1', 'old'),
  ]);
  // c and d share with no one: they hop; a and b stay.
  check(third, [0, 0]);
  expect(shallows(third).padOf).toMatchObject({ a: 'p1', b: 'p1' });
  const bridge = pond([frog('a', 'p1', 'reed', 'rain'), frog('b', 'p1', 'rain'), frog('c', 'p1', 'reed')]);
  // a matches both; b and c each share with one of two (a), so all are content.
  expect(check(bridge)).toEqual([{ t: 'settled' }]);
});

test('settled comes once, at the first check with no one unhappy', () => {
  const w = pond([frog('a', 'p1', 'reed'), frog('b', 'p1', 'reed')]);
  expect(check(w)).toEqual([{ t: 'settled' }]);
  expect(check(w)).toEqual([]);
});

test('with the variety rule on, a frog also hops from a pad more than 90% alike', () => {
  const same = [frog('a', 'p1', 'reed'), frog('b', 'p1', 'reed'), frog('c', 'p1', 'reed')];
  expect(check(pond(same))).toEqual([{ t: 'settled' }]);
  const w = pond(same, false, true);
  const rng = scriptedRng([0, 0, 0]);
  PACKS.shallows.step(Object.assign(w, { tick: 0 }), [], t, rng);
  expect(rng.used()).toBe(3);
});

test('a frog with no pad with room stays and takes no draw', () => {
  const crowd = (pad: string, n: number) =>
    Array.from({ length: n }, (_, i) => frog(`${pad}-${String(i)}`, pad, 'rain'));
  const w = pond([frog('a', 'p1', 'reed'), frog('b', 'p1', 'rain'), ...crowd('p2', 8), ...crowd('p3', 8)]);
  const rng = scriptedRng([]);
  PACKS.shallows.step(Object.assign(w, { tick: 0 }), [], t, rng);
  expect(shallows(w).padOf.a).toBe('p1');
});

test('learn takes a near frog song; sing teaches it once to a one-song frog in reach', () => {
  const w = pond([frog('pell', 'p1', 'old'), frog('b', 'p1', 'reed'), frog('far', 'p3', 'rain')], true);
  local(w, { verb: 'sing', to: 'b' });
  expect(shallows(w).songs.b).toEqual(['reed']);
  local(w, { verb: 'learn', from: 'far' });
  expect(shallows(w).heroSong).toBeNull();
  local(w, { verb: 'learn', from: 'pell' });
  expect(shallows(w).heroSong).toBe('old');
  expect(local(w, { verb: 'sing', to: 'b' })).toEqual([{ t: 'song', who: 'b', song: 'old' }]);
  expect(local(w, { verb: 'sing', to: 'b' })).toEqual([]);
  expect(local(w, { verb: 'sing', to: 'pell' })).toEqual([]);
  expect(local(w, { verb: 'sing', to: 'far' })).toEqual([]);
});

test('the variety rule turns on when the third frog learns a second song', () => {
  const w = pond(
    [frog('pell', 'p1', 'old'), frog('b', 'p1', 'reed'), frog('c', 'p1', 'rain'), frog('d', 'p1', 'reed')],
    true,
  );
  local(w, { verb: 'learn', from: 'pell' });
  local(w, { verb: 'sing', to: 'b' });
  local(w, { verb: 'sing', to: 'c' });
  expect(shallows(w).variety).toBe(false);
  expect(local(w, { verb: 'sing', to: 'd' })).toEqual([
    { t: 'song', who: 'd', song: 'old' },
    { t: 'variety' },
  ]);
  expect(shallows(w).variety).toBe(true);
});

test('sorting is the mean share of one-song frogs whose pad-mates know their song', () => {
  const w = pond([
    frog('a', 'p1', 'reed'),
    frog('b', 'p1', 'reed'),
    frog('c', 'p1', 'rain'),
    frog('d', 'p2', 'rain', 'reed'),
    frog('e', 'p2', 'rain'),
    frog('f', 'p3', 'old'),
  ]);
  // a 1/2, b 1/2, c 0, e 1 (d knows rain), f alone, d knows two.
  expect(sorting(w)).toBeCloseTo((0.5 + 0.5 + 0 + 1) / 4);
  expect(PACKS.shallows.metrics(w, t)).toEqual({ sorting: sorting(w) });
  expect(toLite(w, t).pack).toMatchObject({
    id: 'shallows',
    variety: false,
    heroSong: null,
    sorting: sorting(w),
  });
});

test('a mixed pond runs with its invariants', () => {
  const songs: Song[] = ['reed', 'rain', 'old'];
  const w = pond(
    Array.from({ length: 18 }, (_, i) =>
      frog(`f${String(i)}`, PADS[i % 3]!.id, songs[Math.floor(i / 3) % 3]!),
    ),
    true,
  );
  for (let i = 0; i < 2000; i++) step(w, [], t);
  expect(checkInvariants(w, t)).toEqual([]);
  expect(hasBadNumber(w)).toBe(false);
  expect(sorting(w)).toBeGreaterThan(0.9);
});
