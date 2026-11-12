// The brook and the pond (M2.13b): no drawn body covers water except on a bridge deck. Over ch9
// (from the stored carry and from an empty one, with the T3 player's bridges), the dev brook
// page's setup, ch6's pond, and ch10's bridgeless brook, from the start and each tick, every
// creature not away either stands on a deck or keeps its body box (bodyBox, the bank's size) off
// every water rectangle. tests/unit/render/bank.test.ts checks that the box holds each drawn body.
// The one exception is an islet (ground the water closes in, sim/land.ts islets): too small for a
// body clear of the water, so a creature whose feet are on one is only checked to stay out of it.
// Each step also checks that no creature vanishes: one that turns away has a `leave` event then.
import { expect, test } from 'vitest';
import ch6Json from '../../content/chapters/ch6.json';
import ch9Json from '../../content/chapters/ch9.json';
import ch10Json from '../../content/chapters/ch10.json';
import flagsJson from '../../content/flags.json';
import scenarioJson from '../../content/scenarios/m0.json';
import { decksOf, inRect, inWater, islets } from '../../src/sim/land.ts';
import { step } from '../../src/sim/step.ts';
import type { Command, Rect, Scenario, World } from '../../src/sim/types.ts';
import { createWorld } from '../../src/sim/world.ts';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { buildScenario, chapterTicksPerDay } from '../../src/story/scenario.ts';
import { ChapterSchema, type Chapter } from '../../src/story/schema.ts';
import ch6Carry from '../golden/carry/ch6.json';
import ch9Carry from '../golden/carry/ch9.json';
import ch10Carry from '../golden/carry/ch10.json';
import { tuning } from './arbitraries.ts';

const ch6 = ChapterSchema.parse(ch6Json);
const ch9 = ChapterSchema.parse(ch9Json);
const ch10 = ChapterSchema.parse(ch10Json);
const DAYS = 5;
const SEEDS = 20;

/** The box a body at feet (x, y) covers, with its shadow: x +- bank.side, bank.below above to bank.side below. */
function bodyBox(x: number, y: number): Rect {
  const { side, below } = tuning.bank;
  return { x: x - side, y: y - below, w: 2 * side, h: below + side };
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

/** Each creature not away whose body covers water off a deck, or, on an islet, whose feet are in water. */
function covered(world: World): string[] {
  const water = world.water ?? [];
  const decks = decksOf(world, tuning);
  const isles = islets(water);
  const out: string[] = [];
  for (const c of world.creatures) {
    if (c.state === 'away' || decks.some((d) => inRect(d, c.x, c.y))) continue;
    const wet = isles.some((r) => inRect(r, c.x, c.y))
      ? inWater(world, c.x, c.y)
      : water.some((r) => overlaps(bodyBox(c.x, c.y), r));
    if (wet) out.push(`${c.id} at (${String(c.x)}, ${String(c.y)}) on tick ${String(world.tick)}`);
  }
  return out;
}

/**
 * One step, then no vanishing: each creature that turns away in it has a `leave` event for it in
 * that step's events (only the hunger leave and the ridge set `away`, and both emit one).
 */
function stepNoVanish(world: World, cmds: Command[]): void {
  const here = world.creatures.filter((c) => c.state !== 'away').map((c) => c.id);
  const events = step(world, cmds, tuning);
  const turned = here.filter((id) => world.creatures.find((c) => c.id === id)?.state === 'away');
  const left = events.flatMap((e) => (e.t === 'leave' ? [e.who] : []));
  expect(turned.filter((id) => !left.includes(id))).toEqual([]);
}

const setups: {
  name: string;
  chapter: Chapter;
  carry: Carry;
  mushroom?: boolean;
  first: Command[];
  minCrossings: number;
}[] = [
  {
    name: 'ch9 from the stored carry, with the T3 bridges',
    chapter: ch9,
    carry: ch9Carry,
    minCrossings: 100,
    first: [
      { t: 'place', kind: 'bridge', x: 810, y: 300 },
      { t: 'place', kind: 'bridge', x: 810, y: 600 },
    ],
  },
  {
    name: 'ch9 from an empty carry, with the T3 bridges',
    chapter: ch9,
    carry: { creatures: [], ties: [] },
    minCrossings: 100,
    first: [
      { t: 'place', kind: 'bridge', x: 810, y: 300 },
      { t: 'place', kind: 'bridge', x: 810, y: 600 },
    ],
  },
  {
    name: 'the dev brook page',
    chapter: ch9,
    carry: ch9Carry,
    minCrossings: 100,
    mushroom: true,
    first: [
      { t: 'shine', x: 820, y: 330 },
      { t: 'paintFog', x: 1300, y: 700, r: 180, amount: 0.9 },
      { t: 'place', kind: 'bridge', x: 810, y: 260 },
      { t: 'place', kind: 'bridge', x: 810, y: 640 },
      { t: 'place', kind: 'lantern', x: 960, y: 820 },
    ],
  },
  { name: 'ch6, the pond', chapter: ch6, carry: ch6Carry, first: [], minCrossings: 0 },
  { name: 'ch10, the bridgeless brook', chapter: ch10, carry: ch10Carry, first: [], minCrossings: 0 },
];

for (const setup of setups) {
  test(`${setup.name}: no body covers water off a bridge deck`, () => {
    const flags = parseFlags(flagsJson);
    const ticks = DAYS * chapterTicksPerDay(setup.chapter);
    let crossings = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const scenario = buildScenario(setup.chapter, flags, scenarioJson as Scenario, setup.carry);
      if (setup.mushroom) scenario.mushroom = { x: 1120, y: 560 };
      const world = createWorld(seed, tuning, scenario);
      expect(covered(world)).toEqual([]);
      stepNoVanish(world, setup.first);
      const west = new Map(world.creatures.map((c) => [c.id, c.x < 810]));
      while (world.tick < ticks) {
        stepNoVanish(world, []);
        expect(covered(world)).toEqual([]);
        for (const c of world.creatures) {
          if (inWater(world, c.x, c.y) || west.get(c.id) === c.x < 810) continue;
          west.set(c.id, c.x < 810);
          crossings += 1;
        }
      }
    }
    // Where there are bridges they are used: the check is not passing on a village that never crosses.
    expect(crossings).toBeGreaterThanOrEqual(setup.minCrossings);
  });
}
