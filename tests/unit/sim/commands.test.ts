/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import { applyCommand } from '../../../src/sim/commands.ts';
import type { Command, World } from '../../../src/sim/types.ts';
import { getTie, side } from '../../../src/sim/world.ts';
import { befriend, get, makeWorld, scriptedRng, setWarmth, tuning as t } from './helpers.ts';

function world(): World {
  const w = makeWorld([
    { id: 'a', x: 400, y: 400 },
    { id: 'b', x: 600, y: 500 },
    { id: 'gone', x: 500, y: 450 },
  ]);
  get(w, 'gone').state = 'away';
  return w;
}

test('shine sets the lens', () => {
  const w = world();
  expect(applyCommand(w, { t: 'shine', x: 300, y: 200 }, t, scriptedRng([]))).toEqual([]);
  expect(w.fields.light).toEqual({ x: 300, y: 200 });
});

test('paintFog adds with linear falloff from the center and clamps to [0, 1]', () => {
  const w = world();
  const cs = t.fog.cellSize;
  const at = (col: number, row: number) => w.fields.fog[row * w.fields.fogW + col] ?? NaN;
  // Center on the center of cell (5, 5); r = 2 cells.
  const cx = 5.5 * cs;
  const cy = 5.5 * cs;
  applyCommand(w, { t: 'paintFog', x: cx, y: cy, r: 2 * cs, amount: 0.8 }, t, scriptedRng([]));
  expect(at(5, 5)).toBeCloseTo(0.8, 6);
  expect(at(6, 5)).toBeCloseTo(0.4, 6); // d = r / 2
  expect(at(7, 5)).toBe(0); // d = r: no fog
  expect(at(8, 5)).toBe(0);
  applyCommand(w, { t: 'paintFog', x: cx, y: cy, r: 2 * cs, amount: 0.8 }, t, scriptedRng([]));
  expect(at(5, 5)).toBe(1);
  expect(at(6, 5)).toBeCloseTo(0.8, 6);
  applyCommand(w, { t: 'paintFog', x: cx, y: cy, r: 2 * cs, amount: -5 }, t, scriptedRng([]));
  expect(at(5, 5)).toBe(0);
  expect(at(6, 5)).toBe(0);
});

test('place adds a bench or a bush with the next id', () => {
  const w = world();
  applyCommand(w, { t: 'place', kind: 'bench', x: 10, y: 20 }, t, scriptedRng([]));
  applyCommand(w, { t: 'place', kind: 'bush', x: 30, y: 40 }, t, scriptedRng([]));
  expect(w.structures).toEqual([{ id: 'bench-1', kind: 'bench', x: 10, y: 20 }]);
  expect(w.bushes).toEqual([{ id: 'bush-2', x: 30, y: 40, berries: 0 }]);
  expect(w.nextId).toBe(3);
});

test('thread on raises both warmths to at least 0.4 and sets both opinions to match', () => {
  const w = world();
  setWarmth(w, 'a', 'b', 0.7);
  setWarmth(w, 'b', 'a', -0.2);
  const events = applyCommand(w, { t: 'thread', a: 'a', b: 'b', on: true }, t, scriptedRng([]));
  const tie = getTie(w, 'a', 'b')!;
  expect(tie.ab.warmth).toBe(0.7);
  expect(tie.ba.warmth).toBe(0.4);
  expect(get(w, 'a').opinions.b).toBe(0.7);
  expect(get(w, 'b').opinions.a).toBe(0.4);
  expect(events).toEqual([
    { t: 'opinion', holder: 'a', about: 'b', value: 0.7 },
    { t: 'opinion', holder: 'b', about: 'a', value: 0.4 },
  ]);
});

test('thread on creates the tie for a pair that never met; thread off cuts both warmths to at most 0', () => {
  const w = world();
  applyCommand(w, { t: 'thread', a: 'b', b: 'a', on: true }, t, scriptedRng([]));
  const tie = getTie(w, 'a', 'b')!;
  expect([side(tie, 'a').warmth, side(tie, 'b').warmth]).toEqual([0.4, 0.4]);
  expect(tie.meetings).toBe(0);
  side(tie, 'b').warmth = -0.3;
  applyCommand(w, { t: 'thread', a: 'a', b: 'b', on: false }, t, scriptedRng([]));
  expect([side(tie, 'a').warmth, side(tie, 'b').warmth]).toEqual([0, -0.3]);
  expect(get(w, 'a').opinions.b).toBe(0);
  expect(get(w, 'b').opinions.a).toBe(-0.3);
});

test('whisper sets the opinion to sign x 0.6 and adds a rumor', () => {
  const w = world();
  w.tick = 77;
  const events = applyCommand(w, { t: 'whisper', target: 'a', about: 'b', sign: -1 }, t, scriptedRng([]));
  expect(get(w, 'a').opinions.b).toBe(-0.6);
  expect(w.rumors).toEqual([{ about: 'b', sign: -1, strength: 0.6, origin: 'a', tick: 77 }]);
  expect(events).toEqual([{ t: 'opinion', holder: 'a', about: 'b', value: -0.6 }]);
});

test('respond changes sky warmth by +0.1, -0.03, or -0.15, clamped', () => {
  const w = world();
  const a = get(w, 'a');
  applyCommand(w, { t: 'respond', to: 'a', reply: 'toward' }, t, scriptedRng([]));
  expect(a.skyWarmth).toBeCloseTo(0.1, 12);
  applyCommand(w, { t: 'respond', to: 'a', reply: 'away' }, t, scriptedRng([]));
  expect(a.skyWarmth).toBeCloseTo(0.07, 12);
  applyCommand(w, { t: 'respond', to: 'a', reply: 'against' }, t, scriptedRng([]));
  expect(a.skyWarmth).toBeCloseTo(-0.08, 12);
  a.skyWarmth = 0.95;
  applyCommand(w, { t: 'respond', to: 'a', reply: 'toward' }, t, scriptedRng([]));
  expect(a.skyWarmth).toBe(1);
});

test('arrangeMeeting sets both goals to the midpoint of the pair', () => {
  const w = world();
  expect(applyCommand(w, { t: 'arrangeMeeting', a: 'a', b: 'b' }, t, scriptedRng([]))).toEqual([]);
  expect([get(w, 'a').goalX, get(w, 'a').goalY]).toEqual([500, 450]);
  expect([get(w, 'b').goalX, get(w, 'b').goalY]).toEqual([500, 450]);
});

test('setSeason sets the season', () => {
  const w = world();
  applyCommand(w, { t: 'setSeason', season: 'winter' }, t, scriptedRng([]));
  expect(w.season).toBe('winter');
});

function windWorld() {
  // A gust from (100, 400) to (500, 400). "in" sits 40 from the path; "out" sits 41 from it.
  const w = makeWorld([
    { id: 'in', x: 300, y: 440, opener: 0.95 },
    { id: 'out', x: 300, y: 359 },
    { id: 'past', x: 541, y: 400 }, // beyond the segment end by 41
    { id: 'end', x: 530, y: 400 }, // within 40 of the end point
  ]);
  w.tick = 50;
  return w;
}

test('blow: each creature inside the 80-wide gust path gets a push and maybe one dial shift', () => {
  const w = windWorld();
  // "in": chance 0.1 (< 0.2, shift), dial 0 (opener), amount 0.9 -> +0.12, clamped to 1.
  // "end": chance 0.2 (no shift).
  const rng = scriptedRng([0.1, 0, 0.9, 0.2]);
  const events = applyCommand(w, { t: 'blow', x: 100, y: 400, dx: 400, dy: 0 }, t, rng);
  expect(events).toEqual([]);
  expect(rng.used()).toBe(4);
  expect(w.fields.gusts).toEqual([{ x: 100, y: 400, dx: 400, dy: 0, untilTick: 60 }]);
  expect([get(w, 'in').vx, get(w, 'in').vy]).toEqual([t.wind.push, 0]);
  expect([get(w, 'end').vx, get(w, 'end').vy]).toEqual([t.wind.push, 0]);
  expect([get(w, 'out').vx, get(w, 'past').vx]).toEqual([0, 0]);
  expect(get(w, 'in').dials.opener).toBe(1);
  expect(get(w, 'end').dials.opener).toBe(0.5);
});

test('blow: the dial shift is (2 x draw - 1) x 0.15, clamped at 0', () => {
  const w = makeWorld([{ id: 'c', x: 300, y: 400, ear: 0.1 }]);
  // chance 0, dial 0.6 -> index 3 (ear), amount 0 -> -0.15.
  applyCommand(w, { t: 'blow', x: 300, y: 100, dx: 0, dy: 600 }, t, scriptedRng([0, 0.6, 0]));
  expect(get(w, 'c').dials.ear).toBe(0);
  const w2 = makeWorld([{ id: 'c', x: 300, y: 400, wanderlust: 0.5 }]);
  applyCommand(w2, { t: 'blow', x: 300, y: 100, dx: 0, dy: 600 }, t, scriptedRng([0, 0.9, 0.75]));
  expect(get(w2, 'c').dials.wanderlust).toBeCloseTo(0.5 + 0.5 * 0.15, 12);
  expect(get(w2, 'c').vy).toBe(t.wind.push);
});

const badCommands: [string, Command][] = [
  ['thread, unknown id', { t: 'thread', a: 'a', b: 'nobody', on: true }],
  ['thread, away id', { t: 'thread', a: 'gone', b: 'a', on: true }],
  ['thread, non-boolean on', { t: 'thread', a: 'a', b: 'b', on: 1 as unknown as boolean }],
  ['thread, same id', { t: 'thread', a: 'a', b: 'a', on: true }],
  ['whisper, unknown target', { t: 'whisper', target: 'nobody', about: 'b', sign: 1 }],
  ['whisper, away target', { t: 'whisper', target: 'gone', about: 'b', sign: 1 }],
  ['whisper, unknown about', { t: 'whisper', target: 'a', about: 'nobody', sign: 1 }],
  ['whisper, away about', { t: 'whisper', target: 'a', about: 'gone', sign: 1 }],
  ['whisper, about itself', { t: 'whisper', target: 'a', about: 'a', sign: 1 }],
  ['whisper, bad sign', { t: 'whisper', target: 'a', about: 'b', sign: 0 as 1 }],
  ['respond, unknown id', { t: 'respond', to: 'nobody', reply: 'toward' }],
  ['respond, away id', { t: 'respond', to: 'gone', reply: 'toward' }],
  ['respond, bad reply', { t: 'respond', to: 'a', reply: 'shrug' as 'toward' }],
  ['arrangeMeeting, unknown id', { t: 'arrangeMeeting', a: 'a', b: 'nobody' }],
  ['arrangeMeeting, away id', { t: 'arrangeMeeting', a: 'gone', b: 'b' }],
  ['arrangeMeeting, same id', { t: 'arrangeMeeting', a: 'a', b: 'a' }],
  ['shine, NaN', { t: 'shine', x: NaN, y: 0 }],
  ['shine, Infinity', { t: 'shine', x: 0, y: Infinity }],
  ['paintFog, NaN amount', { t: 'paintFog', x: 100, y: 100, r: 50, amount: NaN }],
  ['paintFog, NaN r', { t: 'paintFog', x: 100, y: 100, r: NaN, amount: 0.5 }],
  ['paintFog, Infinity r', { t: 'paintFog', x: 100, y: 100, r: Infinity, amount: 0.5 }],
  ['paintFog, Infinity x', { t: 'paintFog', x: Infinity, y: 100, r: 50, amount: 0.5 }],
  ['paintFog, r 0', { t: 'paintFog', x: 100, y: 100, r: 0, amount: 0.5 }],
  ['blow, NaN', { t: 'blow', x: 100, y: 400, dx: NaN, dy: 0 }],
  ['blow, no direction', { t: 'blow', x: 100, y: 400, dx: 0, dy: 0 }],
  ['blow, length squared underflows to 0', { t: 'blow', x: 100, y: 400, dx: 0, dy: 5e-324 }],
  ['blow, length squared overflows', { t: 'blow', x: 100, y: 400, dx: 1e200, dy: 0 }],
  ['place, NaN', { t: 'place', kind: 'bench', x: NaN, y: 0 }],
  ['shine, x left of the scene', { t: 'shine', x: -1, y: 100 }],
  ['shine, y below the scene', { t: 'shine', x: 100, y: 901 }],
  ['paintFog, x right of the scene', { t: 'paintFog', x: 1600.5, y: 100, r: 50, amount: 0.5 }],
  ['paintFog, y above the scene', { t: 'paintFog', x: 100, y: -0.1, r: 50, amount: 0.5 }],
  ['blow, start left of the scene', { t: 'blow', x: -10, y: 400, dx: 100, dy: 0 }],
  ['blow, start below the scene', { t: 'blow', x: 100, y: 950, dx: 0, dy: -100 }],
  ['place bench, x right of the scene', { t: 'place', kind: 'bench', x: 1700, y: 100 }],
  ['place bush, y above the scene', { t: 'place', kind: 'bush', x: 100, y: -5 }],
  ['place, Infinity', { t: 'place', kind: 'bush', x: 0, y: -Infinity }],
  ['place, unknown kind', { t: 'place', kind: 'lantern' as 'bench', x: 0, y: 0 }],
  ['setSeason, unknown season', { t: 'setSeason', season: 'monsoon' as 'winter' }],
  ['unknown tag', { t: 'rain' } as unknown as Command],
  ['null', null as unknown as Command],
  ['a number', 5 as unknown as Command],
  ['a string', 'shine' as unknown as Command],
];

test.each(badCommands)('bad input (%s) returns [] and changes nothing', (_name, cmd) => {
  const w = world();
  befriend(w, 'a', 'b');
  const before = structuredClone(w);
  expect(applyCommand(w, cmd, t, scriptedRng([]))).toEqual([]);
  expect(w).toEqual(before);
});

test('commands on the scene edge are accepted', () => {
  const w = world();
  applyCommand(w, { t: 'shine', x: t.scene.width, y: 0 }, t, scriptedRng([]));
  expect(w.fields.light).toEqual({ x: t.scene.width, y: 0 });
  applyCommand(w, { t: 'place', kind: 'bench', x: 0, y: t.scene.height }, t, scriptedRng([]));
  expect(w.structures.at(-1)).toMatchObject({ x: 0, y: t.scene.height });
});
