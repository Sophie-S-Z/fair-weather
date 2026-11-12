import { expect, test } from 'vitest';
import { runDusk } from '../../../../src/sim/daily/index.ts';
import { createRng } from '../../../../src/sim/rng.ts';
import { get, hasBadNumber, makeWorld, scriptedRng, tuning as t } from '../helpers.ts';

const bush = (berries: number) => ({ id: 'b1', x: 100, y: 100, berries });

test('runDusk raises the day, drops expired boosts, and resets light sky warmth for the day', () => {
  const w = makeWorld([{ id: 'a' }]);
  w.day = 4;
  w.boosts = [
    { behavior: 'toward', x: 0, y: 0, untilDay: 4 },
    { behavior: 'give', x: 0, y: 0, untilDay: 5 },
  ];
  get(w, 'a').skyLightToday = 0.1;
  runDusk(w, t, scriptedRng([]));
  expect(w.day).toBe(5);
  expect(w.boosts).toEqual([{ behavior: 'give', x: 0, y: 0, untilDay: 5 }]);
  expect(get(w, 'a').skyLightToday).toBe(0);
});

test('runDusk: eat runs before leave, so a third hungry dusk becomes the fourth and the creature leaves', () => {
  const w = makeWorld([{ id: 'a', berries: 0 }]);
  get(w, 'a').hungryDusks = 3;
  const events = runDusk(w, t, scriptedRng([]));
  expect(events).toContainEqual({ t: 'leave', who: 'a' });
  expect(get(w, 'a').state).toBe('away');
});

test('runDusk: leave runs before newcomer, which runs before bush regrowth', () => {
  // 5 berries for 2 creatures is 2.5 each; once b leaves it is 5 for 1.
  const w = makeWorld([{ id: 'a' }, { id: 'b', berries: 0 }], { bushes: [bush(5)] });
  get(w, 'b').hungryDusks = 3;
  expect(runDusk(w, t, scriptedRng([]))).toContainEqual({ t: 'arrive', who: 'newcomer-1' });

  // 2.9 for 1 is below 3 before regrowth (3.81 after), so no newcomer.
  const w2 = makeWorld([{ id: 'a' }], { bushes: [bush(2.9)] });
  expect(runDusk(w2, t, scriptedRng([]))).toEqual([]);
  expect(w2.bushes[0]?.berries).toBeGreaterThan(3);
});

test('runDusk on a world with 0 creatures and with 1 creature leaves no NaN anywhere', () => {
  for (const ids of [[], ['solo']]) {
    const w = makeWorld(ids.map((id) => ({ id, berries: 0 })));
    const rng = createRng(7);
    for (let d = 0; d < 30; d++) runDusk(w, t, rng);
    expect(w.day).toBe(30);
    expect(hasBadNumber(w)).toBe(false);
    expect(w.creatures).toHaveLength(ids.length);
  }
});

test('runDusk: a sleeper with 0 berries does not get hungry and stays after 30 dusks', () => {
  const w = makeWorld([
    { id: 'sleeper', berries: 0 },
    { id: 'awake', berries: 0 },
  ]);
  get(w, 'sleeper').state = 'sleep';
  const rng = createRng(1);
  const events = [];
  for (let d = 0; d < 30; d++) events.push(...runDusk(w, t, rng));
  const s = get(w, 'sleeper');
  expect(s.state).toBe('sleep');
  expect(s.hungryDusks).toBe(0);
  expect(s.shell.bristle).toBe(0);
  expect(events).not.toContainEqual({ t: 'leave', who: 'sleeper' });
  expect(events).toContainEqual({ t: 'leave', who: 'awake' }); // the same rules still move an awake creature
});
