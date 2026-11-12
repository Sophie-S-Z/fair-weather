/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import { applyCommand } from '../../../src/sim/commands.ts';
import { createWorld, ensureTie, side } from '../../../src/sim/world.ts';
import { toLite } from '../../../src/sim-host/lite.ts';
import { get, scriptedRng, tuning as t } from '../sim/helpers.ts';
import { scenario } from './harness.ts';

test('lite carries dials, tie warmths in key order, and the rumor holders', () => {
  const w = createWorld(1, t, scenario);
  const tie = (a: string, b: string, ab: number, ba: number) => {
    const x = ensureTie(w, get(w, a), get(w, b), t);
    side(x, a).warmth = ab;
    side(x, b).warmth = ba;
  };
  tie('pim', 'krit', 0.5, -0.25); // key krit|pim
  tie('echo', 'moss', 0.75, 0.1); // key echo|moss
  applyCommand(w, { t: 'whisper', target: 'echo', about: 'krit', sign: -1 }, t, scriptedRng([]));
  get(w, 'moss').opinions.krit = -0.4;
  get(w, 'pim').opinions.krit = -0.2;
  const lite = toLite(w, t);
  expect(lite.creatures[0]!.dials).toEqual(get(w, 'pim').dials);
  expect(lite.creatures[0]!.dials).not.toBe(get(w, 'pim').dials);
  expect(lite.ties).toEqual([
    { a: 'echo', b: 'moss', ab: 0.75, ba: 0.1 },
    { a: 'pim', b: 'krit', ab: 0.5, ba: -0.25 },
  ]);
  expect(lite.rumor).toEqual({ about: 'krit', sign: -1, holders: ['echo', 'moss'] });
});

test('lite rumor holders leave out away creatures', () => {
  const w = createWorld(1, t, scenario);
  applyCommand(w, { t: 'whisper', target: 'echo', about: 'krit', sign: -1 }, t, scriptedRng([]));
  get(w, 'echo').state = 'away';
  expect(toLite(w, t).rumor).toEqual({ about: 'krit', sign: -1, holders: [] });
});

test('lite rumor is null with no rumor', () => {
  expect(toLite(createWorld(1, t, scenario), t).rumor).toBeNull();
});
