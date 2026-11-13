/* eslint-disable @typescript-eslint/no-non-null-assertion -- the fixtures always have a hero */
// The hero in the sim (ADR 0013 items 1, 2, and 8).
import { expect, test } from 'vitest';
import { runGolden } from '../../golden/run-golden.ts';
import { applyCommand } from '../../../src/sim/commands.ts';
import { gossip } from '../../../src/sim/daily/gossip.ts';
import { imitate } from '../../../src/sim/daily/imitation.ts';
import { leave } from '../../../src/sim/daily/population.ts';
import { hashWorld } from '../../../src/sim/hash.ts';
import { moveCreatures } from '../../../src/sim/move.ts';
import { createRng } from '../../../src/sim/rng.ts';
import { step } from '../../../src/sim/step.ts';
import type { Command, Scenario, World } from '../../../src/sim/types.ts';
import { HERO } from '../../../src/sim/types.ts';
import { ensureTie, side } from '../../../src/sim/world.ts';
import type { CreatureSpec } from './helpers.ts';
import { befriend, get, makeWorld, scriptedRng, tuning as t } from './helpers.ts';

type HeroSpec = NonNullable<Scenario['hero']>;

/** A world with these locals and a lantern hero named Wren at (800, 450) with 3 berries. */
function heroWorld(locals: CreatureSpec[], hero: Partial<HeroSpec> = {}, over: Partial<Scenario> = {}) {
  const spec: HeroSpec = {
    kind: 'lantern',
    name: 'Wren',
    x: 800,
    y: 450,
    berries: 3,
    keepsakes: [],
    rumor: null,
  };
  return makeWorld(locals, { hero: { ...spec, ...hero }, ...over });
}

const none = () => scriptedRng([]);
const run = (w: World, cmd: Command) => applyCommand(w, cmd, t, none());

test('the hero is the last creature, with its kind as species and a toward-and-give manner', () => {
  const w = heroWorld([{ id: 'a' }, { id: 'b' }], { kind: 'kite', berries: 2, keepsakes: ['acorn'] });
  expect(w.creatures.map((c) => c.id)).toEqual(['a', 'b', HERO]);
  expect(get(w, HERO)).toMatchObject({
    speciesId: 'kite',
    name: 'Wren',
    x: 800,
    y: 450,
    berries: 2,
    state: 'wander',
    dials: { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 },
    shell: { tightness: 0, bristle: 0, color: 0, softness: 0 },
  });
  expect(w.hero).toEqual({ kind: 'kite', reply: 'toward', gift: 'give', waveTo: null, keepsakes: ['acorn'] });
  expect(makeWorld([{ id: 'a' }])).not.toHaveProperty('hero');
});

test('a rumor becomes the first opinion of locals whose Ear is at or below its strength', () => {
  const w = heroWorld(
    [
      { id: 'low', ear: 0.3 },
      { id: 'edge', ear: 0.4 },
      { id: 'high', ear: 0.5 },
    ],
    {
      rumor: { value: -0.6, strength: 0.4 },
    },
  );
  expect(get(w, 'low').opinions).toEqual({ hero: -0.6 });
  expect(get(w, 'edge').opinions).toEqual({ hero: -0.6 });
  expect(get(w, 'high').opinions).toEqual({});
  expect(get(w, HERO).opinions).toEqual({});
  const tie = ensureTie(w, get(w, 'low'), get(w, HERO), t);
  expect(side(tie, 'low').warmth).toBeCloseTo(-0.3, 12);
  expect(side(tie, HERO).warmth).toBe(0);
  expect(get(heroWorld([{ id: 'low', ear: 0 }]), 'low').opinions).toEqual({});
});

test('walk to a point moves only the hero; it stops there and picks no goal', () => {
  const w = heroWorld([{ id: 'a', x: 100, y: 100 }], { x: 200, y: 450 });
  const a = get(w, 'a');
  const hero = get(w, HERO);
  w.hero!.waveTo = 'a';
  run(w, { t: 'walk', x: 400, y: 450 });
  expect([hero.goalX, hero.goalY]).toEqual([400, 450]);
  expect([a.goalX, a.goalY]).toEqual([100, 100]);
  expect(w.hero!.waveTo).toBeNull();
  a.state = 'sleep'; // the local takes no draws, so any draw is the hero's
  for (let i = 0; i < 200; i++) moveCreatures(w, t, none());
  expect(Math.hypot(hero.x - 400, hero.y - 450)).toBeLessThanOrEqual(t.move.arriveRadius);
  expect([hero.goalX, hero.goalY]).toEqual([400, 450]);
  run(w, { t: 'walk', x: -50, y: 2000 });
  expect([hero.goalX, hero.goalY]).toEqual([0, t.scene.height]);
});

test('walk to a creature makes the hero follow it and bid at their meeting', () => {
  // `a` has the higher Opener, so `a` would bid at any meeting the hero did not wave at.
  const w = heroWorld([{ id: 'a', x: 1400, y: 200, opener: 0.9 }], { x: 200, y: 700 });
  const a = get(w, 'a');
  const hero = get(w, HERO);
  run(w, { t: 'walk', to: 'a' });
  expect(w.hero!.waveTo).toBe('a');
  for (let i = 0; i < 2000; i++) {
    const bid = step(w, [], t).find((e) => e.t === 'bid');
    if (bid) {
      expect(bid).toMatchObject({ from: HERO, to: 'a' });
      expect(w.hero!.waveTo).toBeNull();
      return;
    }
    expect([hero.goalX, hero.goalY]).toEqual([a.x, a.y]);
  }
  throw new Error('the hero never met the creature it followed');
});

test('the hero stops following a creature that goes away', () => {
  const w = heroWorld([{ id: 'a', x: 1400 }], { x: 200 });
  run(w, { t: 'walk', to: 'a' });
  get(w, 'a').state = 'away';
  moveCreatures(w, t, createRng(1));
  const hero = get(w, HERO);
  expect(w.hero!.waveTo).toBeNull();
  expect([hero.goalX, hero.goalY]).toEqual([hero.x, hero.y]);
});

test('water stops the hero with its goal at its own spot, and it picks no goal', () => {
  const w = heroWorld([], { x: 400, y: 450 }, { water: [{ x: 700, y: 0, w: 60, h: 900 }] });
  const hero = get(w, HERO);
  run(w, { t: 'walk', x: 1200, y: 450 });
  let stopped = false;
  for (let i = 0; i < 200 && !stopped; i++) {
    moveCreatures(w, t, none());
    stopped = hero.goalX !== 1200;
  }
  expect(stopped).toBe(true);
  expect([hero.goalX, hero.goalY]).toEqual([hero.x, hero.y]);
  expect([hero.vx, hero.vy]).toEqual([0, 0]);
  expect(hero.x).toBeLessThan(700 - t.bank.side);
  const at = [hero.x, hero.y];
  for (let i = 0; i < 20; i++) moveCreatures(w, t, none());
  expect([hero.x, hero.y]).toEqual(at);
});

test('arrangeMeeting with the hero moves only the other creature, to the hero', () => {
  const w = heroWorld([{ id: 'a', x: 100, y: 100 }], { x: 600, y: 300 });
  const hero = get(w, HERO);
  run(w, { t: 'arrangeMeeting', a: 'a', b: HERO });
  expect([get(w, 'a').goalX, get(w, 'a').goalY]).toEqual([600, 300]);
  expect([hero.goalX, hero.goalY]).toEqual([600, 300]);
  run(w, { t: 'walk', x: 900, y: 300 });
  run(w, { t: 'arrangeMeeting', a: HERO, b: 'a' });
  expect([hero.goalX, hero.goalY]).toEqual([900, 300]);
});

test('the hero never leaves by hunger, never gossips, and is never imitated', () => {
  const w = heroWorld([{ id: 'a', ear: 0.5 }, { id: 'b' }]);
  const hero = get(w, HERO);
  for (const c of w.creatures) c.hungryDusks = t.population.leaveHungryDusks;
  expect(leave(w, t, none())).toEqual([
    { t: 'leave', who: 'a' },
    { t: 'leave', who: 'b' },
  ]);
  expect(hero.state).toBe('wander');

  // A listener whose only friend is the hero hears nothing from it.
  const g = heroWorld([{ id: 'a', ear: 0.5 }, { id: 'b' }, { id: 'c' }]);
  befriend(g, 'a', HERO);
  get(g, HERO).opinions.b = -0.9;
  expect(gossip(g, t, none())).toEqual([]);
  // With a local friend holding the same opinion, the hero's own value does not count.
  befriend(g, 'a', 'c');
  get(g, 'c').opinions.b = -0.5;
  expect(gossip(g, t, none())).toEqual([{ t: 'opinion', holder: 'a', about: 'b', value: -0.5 }]);

  // Imitation: the hero has no neighbor to copy and is nobody's neighbor, so no draws at all.
  const m = heroWorld([{ id: 'a', berries: 0 }], { berries: 9 });
  m.day = t.imitation.everyDays - 1;
  expect(imitate(m, t, none())).toEqual([]);
});

test('walk and manner with bad values are ignored', () => {
  const w = heroWorld([{ id: 'a' }, { id: 'gone' }]);
  get(w, 'gone').state = 'away';
  const before = structuredClone(w);
  for (const cmd of [
    { t: 'walk', to: HERO },
    { t: 'walk', to: 'nobody' },
    { t: 'walk', to: 'gone' },
    { t: 'walk', x: NaN, y: 100 },
    { t: 'walk', x: 100, y: Infinity },
    { t: 'manner', reply: 'shrug' as 'toward', gift: 'give' },
    { t: 'manner', reply: 'toward', gift: 'hoard' as 'give' },
  ] satisfies Command[]) {
    expect(run(w, cmd)).toEqual([]);
  }
  expect(w).toEqual(before);
  run(w, { t: 'manner', reply: 'against', gift: 'keep' });
  expect(w.hero).toMatchObject({ reply: 'against', gift: 'keep' });
});

test('the m0 golden hash is unchanged', () => {
  expect(hashWorld(runGolden())).toBe('c29d2fa4dbda4dcf');
});
