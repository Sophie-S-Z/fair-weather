import { expect, test } from 'vitest';
import { createRng } from '../../../src/sim/rng.ts';
import { step } from '../../../src/sim/step.ts';
import { get, makeWorld, tuning as t } from './helpers.ts';

test('step raises the tick by one and stores the advanced PRNG state', () => {
  const w = makeWorld([{ id: 'a' }]);
  const before = w.rngState;
  step(w, [], t);
  expect(w.tick).toBe(1);
  expect(w.rngState).not.toBe(before); // a wander creature at its goal picks a new one
});

test('step applies commands in list order before movement', () => {
  const w = makeWorld([{ id: 'a' }]);
  step(
    w,
    [
      { t: 'setSeason', season: 'winter' },
      { t: 'setSeason', season: 'autumn' },
    ],
    t,
  );
  expect(w.season).toBe('autumn');
});

test('step drops gusts whose untilTick has come, after the commands that tick', () => {
  const w = makeWorld([{ id: 'a', x: 100, y: 100 }]);
  const blow = { t: 'blow', x: 800, y: 800, dx: 1, dy: 0 } as const;
  step(w, [blow], t);
  expect(w.fields.gusts).toHaveLength(1);
  while (w.tick < t.wind.gustTicks) step(w, [], t);
  expect(w.fields.gusts).toHaveLength(1);
  step(w, [], t); // tick === gustTicks: untilTick 0 + gustTicks <= tick
  expect(w.fields.gusts).toHaveLength(0);
});

test('step runs dusk on the last tick of each day only', () => {
  const w = makeWorld([{ id: 'a' }], { ticksPerDay: 20 });
  for (let i = 0; i < 19; i++) step(w, [], t);
  expect(w.day).toBe(0);
  step(w, [], t);
  expect(w.day).toBe(1);
  expect(w.tick).toBe(20);
});

test('step returns meeting events, and a creature meets once per day', () => {
  const w = makeWorld([
    { id: 'a', x: 800, y: 450, opener: 1 },
    { id: 'b', x: 805, y: 450, opener: 1 },
  ]);
  const events = step(w, [], t);
  expect(events.some((e) => e.t === 'bid' || e.t === 'gift')).toBe(true);
  expect(get(w, 'a').state).toBe('meet');
});

test('step with the same world and commands gives the same events and state', () => {
  const run = () => {
    const w = makeWorld(
      [
        { id: 'a', x: 100 },
        { id: 'b', x: 140 },
        { id: 'c', x: 900 },
      ],
      { ticksPerDay: 20 },
    );
    const events = [];
    for (let i = 0; i < 60; i++) events.push(...step(w, i === 5 ? [{ t: 'shine', x: 120, y: 450 }] : [], t));
    return { events, w };
  };
  const x = run();
  const y = run();
  expect(y.events).toEqual(x.events);
  expect(y.w).toEqual(x.w);
  expect(createRng(x.w.rngState).next()).toBe(createRng(y.w.rngState).next());
});
