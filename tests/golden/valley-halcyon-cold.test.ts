// T3 control for Halcyon (plan task M3.10, spec 7.4): with Kith's warmth at 0.1, below
// wisp.minKithWarmth, the T3 player's Wisp stays in all 200 seeds, feather or not. Its own file
// so vitest runs it beside valley-halcyon.test.ts.
import { expect, test } from 'vitest';
import halcyonJson from '../../content/valleys/halcyon.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { PLAYERS } from './players.ts';
import { runChapterHeadless } from './run-chapter.ts';
import { halcyonJourney, VALLEY_SEEDS } from './valleys.ts';

const halcyon = ChapterSchema.parse(halcyonJson);

test('T3 halcyon cold: with Kith at 0.1, Wisp stays in 200 of 200', async () => {
  const flags = parseFlags(flagsJson);
  let stayed = 0;
  for (const seed of VALLEY_SEEDS) {
    const r = await runChapterHeadless(
      halcyon,
      seed,
      PLAYERS.halcyon(),
      flags,
      undefined,
      undefined,
      halcyonJourney(0.1),
    );
    if (r.log.some((e) => e.kind === 'event' && e.e.t === 'stay')) stayed += 1;
  }
  console.log(`T3 halcyon cold: Wisp stayed ${String(stayed)}`);
  expect(stayed).toBe(200);
}, 1_200_000); // 200 runs to the third dusk, as valley-halcyon.test.ts, with room to spare
