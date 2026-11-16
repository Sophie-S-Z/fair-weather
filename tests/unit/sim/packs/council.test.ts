/* eslint-disable @typescript-eslint/no-non-null-assertion -- the fixtures always have a council */
// Toadstool Council (ADR 0015 item 4).
import { expect, test } from 'vitest';
import { applyCommand } from '../../../../src/sim/commands.ts';
import { checkInvariants } from '../../../../src/sim/invariants.ts';
import { elect } from '../../../../src/sim/packs/council.ts';
import { PACKS } from '../../../../src/sim/packs/index.ts';
import { step } from '../../../../src/sim/step.ts';
import type {
  CouncilState,
  HeroKind,
  LocalVerb,
  Scenario,
  SimEvent,
  World,
} from '../../../../src/sim/types.ts';
import { HERO } from '../../../../src/sim/types.ts';
import { createWorld, getTie, side } from '../../../../src/sim/world.ts';
import { toLite } from '../../../../src/sim-host/lite.ts';
import { get, hasBadNumber, scriptedRng, tuning as t } from '../helpers.ts';

const DIALS = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
/** A and B close together (wet and near), C far and dry, D dry and near. */
const SPOTS = [
  { id: 'a', x: 300, y: 300, wet: 0.2, far: 0.2 },
  { id: 'b', x: 400, y: 300, wet: 0.25, far: 0.25 },
  { id: 'c', x: 1200, y: 300, wet: 0.8, far: 0.8 },
  { id: 'd', x: 800, y: 700, wet: 0.8, far: 0.2 },
];
/** 8 voters nearest A, 7 nearest B, 10 at C: plurality picks C (ADR 0015 item 4). */
const voter = (wet: number, far: number) => (i: number) => [`t${String(i)}`, { wet, far }] as const;
const PREFS: Record<string, { wet: number; far: number }> = Object.fromEntries([
  ...[0, 1, 2, 3, 4, 5, 6, 7].map(voter(0.2, 0.2)),
  ...[8, 9, 10, 11, 12, 13, 14].map(voter(0.25, 0.25)),
  ...[15, 16, 17, 18, 19, 20, 21, 22, 23, 24].map(voter(0.8, 0.8)),
]);

function councilWorld(kind?: HeroKind, rule?: 'approval'): World {
  const scenario: Scenario = {
    valleyId: 'council',
    season: 'summer',
    creatures: Object.keys(PREFS).map((id, i) => ({
      id,
      speciesId: 'toadstool',
      name: id,
      x: 100 + (i % 10) * 140,
      y: 200 + Math.floor(i / 10) * 200,
      berries: 3,
      dials: DIALS,
    })),
    bushes: [
      { id: 'near-a', x: 320, y: 320, berries: 0 },
      { id: 'near-c', x: 1220, y: 320, berries: 0 },
    ],
    structures: [],
    pack: { id: 'council', spots: SPOTS, prefs: PREFS, ...(rule ? { rule } : {}) },
  };
  if (kind) scenario.hero = { kind, name: 'Wren', x: 40, y: 450, berries: 3, keepsakes: [], rumor: null };
  return createWorld(1, t, scenario);
}

const council = (w: World): CouncilState => {
  const p = w.pack!;
  if (p.id !== 'council') throw new Error('not the council');
  return p;
};
const local = (w: World, verb: LocalVerb) => applyCommand(w, { t: 'local', verb }, t, scriptedRng([]));
/** The council's own step at the day's last tick. */
const dusk = (w: World): SimEvent[] => {
  w.tick = w.ticksPerDay * (w.day + 1) - 1;
  const out = PACKS.council.step(w, [], t, scriptedRng([]));
  w.day += 1;
  return out;
};
const towardHero = (w: World, id: string): number => {
  const tie = getTie(w, id, HERO);
  return tie ? side(tie, id).warmth : 0;
};

const ballots = Object.values(PREFS).map((p) =>
  SPOTS.map((s) => 1 - Math.sqrt((s.wet - p.wet) ** 2 + (s.far - p.far) ** 2) / Math.sqrt(2)),
);

test.each([
  ['plurality', 'c'],
  ['approval', 'a'],
  ['runoff', 'a'],
  ['score', 'b'],
] as const)('%s elects %s when two close spots split the vote', (rule, winner) => {
  expect(SPOTS[elect(rule, ballots, SPOTS.length)]?.id).toBe(winner);
});

test('ties go to the earlier spot, and a runoff removes the later of two fewest', () => {
  const even = [
    [1, 0, 0],
    [0, 1, 0],
  ];
  expect(elect('plurality', even, 3)).toBe(0);
  expect(elect('score', even, 3)).toBe(0);
  // First choices 2, 1, 1: the runoff removes spot 2 first, then spot 1.
  const run = [
    [1, 0.5, 0],
    [1, 0.5, 0],
    [0, 1, 0.5],
    [0, 0.5, 1],
  ];
  expect(elect('runoff', run, 3)).toBe(0);
  // A voter's tie ranks the earlier spot first.
  expect(elect('plurality', [[0.5, 0.5]], 2)).toBe(0);
});

test('the first tally is plurality, and the cloud rains on the winner', () => {
  const w = councilWorld();
  const events = dusk(w);
  expect(events).toEqual([{ t: 'tally', rule: 'plurality', winner: 'c', glad: 10 }]);
  expect(w.bushes.find((b) => b.id === 'near-c')?.berries).toBe(t.rain.berries);
  expect(w.bushes.find((b) => b.id === 'near-a')?.berries).toBe(0);
  expect(council(w).winner).toBe('c');
});

test("the hero's vote is one more ballot, as a voter at its spot", () => {
  const w = councilWorld('lantern');
  local(w, { verb: 'vote', spot: 'nowhere' });
  expect(council(w).heroVote).toBeNull();
  local(w, { verb: 'vote', spot: 'b' });
  expect(council(w).heroVote).toBe('b');
  expect(dusk(w)[0]).toMatchObject({ winner: 'c', glad: 10 });
});

test('a proposal works once, and the council warms toward the hero when the new winner gladdens more', () => {
  const w = councilWorld('lantern');
  dusk(w);
  local(w, { verb: 'propose', rule: 'approval' });
  local(w, { verb: 'propose', rule: 'score' });
  expect(council(w).rule).toBe('approval');
  const events = dusk(w);
  expect(events[0]).toEqual({ t: 'tally', rule: 'approval', winner: 'a', glad: 15 });
  expect(events[1]).toEqual({ t: 'heard', rule: 'approval', change: t.council.warmth });
  expect(towardHero(w, 't0')).toBeCloseTo(t.council.warmth);
  expect(get(w, 't20').opinions[HERO]).toBeCloseTo(t.council.warmth);
  // It hears a rule once.
  expect(dusk(w).some((e) => e.t === 'heard')).toBe(false);
});

test('a Glassling is heard by 1.5 times as much', () => {
  const w = councilWorld('glassling');
  local(w, { verb: 'propose', rule: 'runoff' });
  const heard = dusk(w).find((e) => e.t === 'heard');
  expect(heard).toEqual({ t: 'heard', rule: 'runoff', change: t.council.warmth * t.knack.glassWarmth });
});

test('a rule no better than plurality cools the council', () => {
  const w = councilWorld('lantern');
  // With every voter at C, every rule picks C: no more glad voters than plurality's.
  for (const p of Object.values(council(w).prefs)) Object.assign(p, { wet: 0.8, far: 0.8 });
  local(w, { verb: 'propose', rule: 'score' });
  expect(dusk(w).find((e) => e.t === 'heard')).toEqual({
    t: 'heard',
    rule: 'score',
    change: -t.council.warmth,
  });
  expect(towardHero(w, 't3')).toBeCloseTo(-t.council.warmth);
});

test('a sandbox council votes under its own rule; without a hero, propose and vote do nothing', () => {
  const w = councilWorld(undefined, 'approval');
  local(w, { verb: 'propose', rule: 'score' });
  local(w, { verb: 'vote', spot: 'a' });
  expect(council(w)).toMatchObject({ rule: 'approval', proposed: null, heroVote: null });
  expect(dusk(w)[0]).toMatchObject({ rule: 'approval', winner: 'a' });
});

test('toadstools never walk', () => {
  const w = councilWorld('kite');
  const toadstools = () => w.creatures.filter((c) => c.id !== HERO).map((c) => [c.x, c.y]);
  const start = toadstools();
  for (let i = 0; i < 400; i++) step(w, [], t);
  expect(toadstools()).toEqual(start);
  expect(checkInvariants(w, t)).toEqual([]);
  expect(hasBadNumber(w)).toBe(false);
});

test('the snapshot carries the spots, the rule, the proposal, the vote, and the winner', () => {
  const w = councilWorld('lantern');
  local(w, { verb: 'vote', spot: 'a' });
  local(w, { verb: 'propose', rule: 'score' });
  expect(toLite(w, t).pack).toEqual({
    id: 'council',
    spots: SPOTS,
    rule: 'score',
    proposed: 'score',
    heroVote: 'a',
    winner: null,
  });
});
