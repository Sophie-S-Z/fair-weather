// T5 (spec 18, ADR 0015 item 12): in Lily Shallows, frogs that want only a third of their
// pad-mates to share a song still sort the pond, and a small wish for variety mixes it again.
import { expect, test } from 'vitest';
import scenarioJson from '../../content/scenarios/shallows.json';
import shallowsJson from '../../content/valleys/shallows.json';
import { sorting } from '../../src/sim/packs/shallows.ts';
import { step } from '../../src/sim/step.ts';
import type { Scenario, World } from '../../src/sim/types.ts';
import { createWorld } from '../../src/sim/world.ts';
import { chapterTicksPerDay } from '../../src/story/scenario.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { tuning as t } from '../../src/story/tuning.ts';

const day = chapterTicksPerDay(ChapterSchema.parse(shallowsJson));
const every = t.shallows.everyTicks;

/** Runs two days of `w` and gives each sorting seen after a pond check (frogs hop only then). */
function twoDays(w: World): number[] {
  const seen: number[] = [];
  for (let i = 0; i < 2 * day; i++) {
    step(w, [], t);
    if (w.tick % every === 1) seen.push(sorting(w));
  }
  return seen;
}

test('T5 shallows: the pond sorts within 2 days, and with the variety rule it mixes within 2 more, in at least 45 of 50 seeds', () => {
  let sorted = 0;
  let mixed = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const scenario = { ...structuredClone(scenarioJson), ticksPerDay: day } as Scenario;
    const w = createWorld(seed, t, scenario);
    expect(sorting(w)).toBeLessThan(t.shallows.mixedAt); // the layout starts mixed
    if (Math.max(...twoDays(w)) >= t.shallows.sortedAt) sorted += 1;
    if (w.pack?.id !== 'shallows') throw new Error('not the Shallows');
    w.pack.variety = true;
    if (Math.min(...twoDays(w)) <= t.shallows.mixedAt) mixed += 1;
  }
  console.log(`T5 shallows: sorted ${String(sorted)}, mixed ${String(mixed)} of 50`);
  expect(sorted).toBeGreaterThanOrEqual(45);
  expect(mixed).toBeGreaterThanOrEqual(45);
}, 120_000); // 50 seeds of four 180-s days
