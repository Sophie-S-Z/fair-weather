/* eslint-disable @typescript-eslint/no-non-null-assertion -- test fixtures have known ids */
import { expect, test } from 'vitest';
import { applyCommand } from '../../../src/sim/commands.ts';
import { landOf, withBank } from '../../../src/sim/land.ts';
import { perceivedShares } from '../../../src/sim/packs/fen.ts';
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

test('lite carries who dances and the mushroom with the drops left today', () => {
  const w = createWorld(1, t, { ...scenario, mushroom: { x: 400, y: 300 } });
  get(w, 'pim').dancing = true;
  w.mushroom!.taken = 3;
  const lite = toLite(w, t);
  expect(lite.creatures.find((c) => c.id === 'pim')!.dancing).toBe(true);
  expect(lite.creatures.find((c) => c.id === 'krit')!.dancing).toBe(false);
  expect(lite.mushroom).toEqual({ x: 400, y: 300, drops: 7, witherDays: 0 });
  expect(toLite(createWorld(1, t, scenario), t).mushroom).toBeNull();
});

test("lite carries the sim's own land: each water's bank, the decks, and the islets", () => {
  const water = [{ x: 780, y: 0, w: 60, h: 900 }];
  const bridge = { id: 'bridge-1', kind: 'bridge' as const, x: 810, y: 450 };
  const w = createWorld(1, t, { ...scenario, water, structures: [bridge] });
  const land = landOf(w, t);
  const lite = toLite(w, t);
  expect(lite.banks).toEqual([withBank(water[0]!, t)]);
  expect(lite.banks).toEqual(land.banks);
  expect(lite.decks).toEqual(land.decks);
  expect(lite.islets).toEqual([]);
  expect(toLite(createWorld(1, t, scenario), t).banks).toEqual([]);
});

test('lite carries each species, and the hero with what each other creature thinks of it', () => {
  const plain = toLite(createWorld(1, t, scenario), t);
  expect(plain.hero).toBeNull();
  expect(plain.creatures.map((c) => c.speciesId)).toEqual(scenario.creatures.map((c) => c.speciesId));
  const hero = { kind: 'mosscoat' as const, name: 'Wren', x: 400, y: 300, berries: 2, keepsakes: ['acorn'] };
  const w = createWorld(1, t, { ...scenario, hero: { ...hero, rumor: null } });
  get(w, 'pim').opinions.hero = 0.4;
  get(w, 'krit').opinions.hero = -0.2;
  const lite = toLite(w, t);
  expect(lite.creatures.at(-1)).toMatchObject({ id: 'hero', speciesId: 'mosscoat' });
  expect(lite.hero).toEqual({
    kind: 'mosscoat',
    name: 'Wren',
    reply: 'toward',
    gift: 'give',
    keepsakes: ['acorn'],
    opinions: { pim: 0.4, krit: -0.2 },
  });
  expect(lite.hero!.keepsakes).not.toBe(w.hero!.keepsakes);
});

test('lite carries the Fen flock: who flies, the hero while it has joined, and each perceived share', () => {
  expect(toLite(createWorld(1, t, scenario), t).pack).toBeNull();
  const birds = scenario.creatures.map((c) => ({ ...c, speciesId: 'starling' }));
  const hero = {
    kind: 'kite' as const,
    name: 'Wren',
    x: 400,
    y: 300,
    berries: 2,
    keepsakes: [],
    rumor: null,
  };
  const second = birds[1]!;
  const w = createWorld(1, t, {
    ...scenario,
    creatures: birds,
    hero,
    pack: { id: 'fen', restless: [second.id], fixed: {} },
  });
  w.pack!.heroFlying = true;
  const lite = toLite(w, t);
  expect(lite.pack).toEqual({ id: 'fen', flying: [second.id, 'hero'], perceived: perceivedShares(w, t) });
  expect(Object.keys(lite.pack!.perceived)).toEqual(birds.map((c) => c.id));
  get(w, second.id).state = 'away';
  expect(toLite(w, t).pack!.flying).toEqual(['hero']);
});
