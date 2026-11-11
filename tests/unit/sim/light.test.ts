/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import scenarioJson from '../../../content/scenarios/m0.json';
import { boostAt, fogAt, lightSkyWarmth, recordLitMeeting } from '../../../src/sim/light.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { Scenario, World } from '../../../src/sim/types.ts';
import { createWorld } from '../../../src/sim/world.ts';

const t = parseTuning(tuningJson);
const scenario = scenarioJson as Scenario;

function world(): World {
  const base = scenario.creatures[0]!;
  return createWorld(1, t, {
    ...scenario,
    creatures: [
      { ...base, id: 'a', x: 800, y: 450 },
      { ...base, id: 'b', x: 1300, y: 450 },
    ],
    bushes: [],
  });
}

test('fogAt reads the fog cell under a point and clamps points outside the scene', () => {
  const w = world();
  const cs = t.fog.cellSize;
  w.fields.fog[2 * w.fields.fogW + 3] = 0.75;
  expect(fogAt(w, 3 * cs + 1, 2 * cs + 1, t)).toBe(0.75);
  expect(fogAt(w, 2 * cs + 1, 2 * cs + 1, t)).toBe(0);
  w.fields.fog[w.fields.fog.length - 1] = 0.5;
  expect(fogAt(w, 99999, 99999, t)).toBe(0.5);
  w.fields.fog[0] = 0.25;
  expect(fogAt(w, -5, -5, t)).toBe(0.25);
});

test('light: a meeting in the lens adds a boost that raises the same behavior nearby by 0.15, capped at 0.3', () => {
  const w = world();
  w.day = 4;
  w.fields.light = { x: 800, y: 450 };
  recordLitMeeting(w, 810, 450, ['toward', 'give'], t);
  expect(w.boosts).toEqual([
    { behavior: 'toward', x: 810, y: 450, untilDay: 5 },
    { behavior: 'give', x: 810, y: 450, untilDay: 5 },
  ]);
  expect(boostAt(w, 'toward', 1100, 450, t)).toBeCloseTo(0.15, 12); // 290 away
  expect(boostAt(w, 'give', 810, 450, t)).toBeCloseTo(0.15, 12);
  expect(boostAt(w, 'against', 810, 450, t)).toBe(0);
  expect(boostAt(w, 'toward', 1200, 450, t)).toBe(0); // 390 away, past light.radius
  recordLitMeeting(w, 800, 450, ['toward'], t);
  recordLitMeeting(w, 800, 450, ['toward'], t);
  expect(boostAt(w, 'toward', 800, 450, t)).toBe(t.light.cap);
  w.day = 5;
  expect(boostAt(w, 'give', 810, 450, t)).toBeCloseTo(0.15, 12);
  w.day = 6;
  expect(boostAt(w, 'give', 810, 450, t)).toBe(0);
});

test('light: a meeting outside the lens, or with no light, adds no boost', () => {
  const w = world();
  recordLitMeeting(w, 800, 450, ['toward'], t);
  expect(w.boosts).toHaveLength(0);
  w.fields.light = { x: 800, y: 450 };
  recordLitMeeting(w, 800 + t.light.lensRadius + 1, 450, ['toward'], t);
  expect(w.boosts).toHaveLength(0);
  recordLitMeeting(w, 800 + t.light.lensRadius, 450, ['keep'], t);
  expect(w.boosts).toHaveLength(1);
});

test('light: sky warmth rises 0.001 per tick in the lens, up to 0.1 per day', () => {
  const w = world();
  const [a, b] = w.creatures as [World['creatures'][number], World['creatures'][number]];
  lightSkyWarmth(w, t);
  expect(a.skyWarmth).toBe(0); // no light
  w.fields.light = { x: 800, y: 450 };
  lightSkyWarmth(w, t);
  expect(a.skyWarmth).toBeCloseTo(0.001, 12);
  expect(a.skyLightToday).toBeCloseTo(0.001, 12);
  expect(b.skyWarmth).toBe(0); // outside the lens
  for (let i = 0; i < 200; i++) lightSkyWarmth(w, t);
  expect(a.skyWarmth).toBeCloseTo(0.1, 12);
  expect(a.skyLightToday).toBeLessThanOrEqual(t.sky.lightDailyCap);
  expect(a.skyLightToday).toBeCloseTo(t.sky.lightDailyCap, 12);
});

test('light: sky warmth stays at most 1, and away creatures gain nothing', () => {
  const w = world();
  const [a, b] = w.creatures as [World['creatures'][number], World['creatures'][number]];
  w.fields.light = { x: 800, y: 450 };
  b.x = 800;
  b.state = 'away';
  a.skyWarmth = 0.9995;
  lightSkyWarmth(w, t);
  lightSkyWarmth(w, t);
  expect(a.skyWarmth).toBe(1);
  expect(b.skyWarmth).toBe(0);
  expect(b.skyLightToday).toBe(0);
});
