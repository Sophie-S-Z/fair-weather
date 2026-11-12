// The brook (M2.13b): with bridges in place, a creature crosses the water only on a bridge. Over
// the ch9 scenario (from the stored carry and from an empty one, with the T3 player's bridges)
// and the dev brook page's setup, every creature's feet, each tick, are on land or on a deck the
// Meadow draws (the same rectangle: bridgeDeck).
import { expect, test } from 'vitest';
import ch9Json from '../../content/chapters/ch9.json';
import flagsJson from '../../content/flags.json';
import scenarioJson from '../../content/scenarios/m0.json';
import { bridgeDeck } from '../../src/render/land.ts';
import { inRect, inWater } from '../../src/sim/land.ts';
import { step } from '../../src/sim/step.ts';
import type { Command, Scenario, World } from '../../src/sim/types.ts';
import { createWorld } from '../../src/sim/world.ts';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { buildScenario, chapterTicksPerDay } from '../../src/story/scenario.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from '../golden/carry/ch9.json';
import { tuning } from './arbitraries.ts';

const ch9 = ChapterSchema.parse(ch9Json);
const DAYS = 5;
const SEEDS = 20;

/** Each creature not away whose feet are in water and on no bridge deck. */
function offDeck(world: World): string[] {
  const water = world.water ?? [];
  const decks = world.structures
    .filter((s) => s.kind === 'bridge')
    .map((s) => bridgeDeck(s, water, tuning.bridge.radius))
    .filter((d) => d !== null);
  return world.creatures
    .filter((c) => c.state !== 'away' && inWater(world, c.x, c.y) && !decks.some((d) => inRect(d, c.x, c.y)))
    .map((c) => `${c.id} at (${String(c.x)}, ${String(c.y)}) on tick ${String(world.tick)}`);
}

const setups: { name: string; carry: Carry; mushroom?: boolean; first: Command[] }[] = [
  {
    name: 'ch9 from the stored carry, with the T3 bridges',
    carry: carryJson,
    first: [
      { t: 'place', kind: 'bridge', x: 810, y: 300 },
      { t: 'place', kind: 'bridge', x: 810, y: 600 },
    ],
  },
  {
    name: 'ch9 from an empty carry, with the T3 bridges',
    carry: { creatures: [], ties: [] },
    first: [
      { t: 'place', kind: 'bridge', x: 810, y: 300 },
      { t: 'place', kind: 'bridge', x: 810, y: 600 },
    ],
  },
  {
    name: 'the dev brook page',
    carry: carryJson,
    mushroom: true,
    first: [
      { t: 'shine', x: 820, y: 330 },
      { t: 'paintFog', x: 1300, y: 700, r: 180, amount: 0.9 },
      { t: 'place', kind: 'bridge', x: 810, y: 260 },
      { t: 'place', kind: 'bridge', x: 810, y: 640 },
      { t: 'place', kind: 'lantern', x: 960, y: 820 },
    ],
  },
];

for (const setup of setups) {
  test(`${setup.name}: no creature's feet are in the brook off a bridge deck`, () => {
    const flags = parseFlags(flagsJson);
    const ticks = DAYS * chapterTicksPerDay(ch9);
    let crossings = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const scenario = buildScenario(ch9, flags, scenarioJson as Scenario, setup.carry);
      if (setup.mushroom) scenario.mushroom = { x: 1120, y: 560 };
      const world = createWorld(seed, tuning, scenario);
      step(world, setup.first, tuning);
      const west = new Map(world.creatures.map((c) => [c.id, c.x < 810]));
      while (world.tick < ticks) {
        step(world, [], tuning);
        expect(offDeck(world)).toEqual([]);
        for (const c of world.creatures) {
          if (inWater(world, c.x, c.y) || west.get(c.id) === c.x < 810) continue;
          west.set(c.id, c.x < 810);
          crossings += 1;
        }
      }
    }
    // The bridges are used: the check is not passing on a village that never crosses.
    expect(crossings).toBeGreaterThan(100);
  });
}
