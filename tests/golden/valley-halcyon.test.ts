// T3 (plan task M3.10): over 200 seeds, with Kith at 0.3, the player who gives Wisp three gifts
// and then the Fen's feather brings Wisp home in at least 190, and the postcard comes after 6 to 8
// minutes of play at the median (spec 7.3). Wisp's choice is the sim's goHome or stay event.
import { expect, test } from 'vitest';
import halcyonJson from '../../content/valleys/halcyon.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { tuning } from '../../src/story/tuning.ts';
import { PLAYERS } from './players.ts';
import { runChapterHeadless } from './run-chapter.ts';
import { halcyonJourney, VALLEY_SEEDS } from './valleys.ts';

const halcyon = ChapterSchema.parse(halcyonJson);

test('T3 halcyon: Wisp comes home in at least 190 of 200, and the postcard at 6 to 8 minutes', async () => {
  const flags = parseFlags(flagsJson);
  let home = 0;
  const seconds: number[] = [];
  for (const seed of VALLEY_SEEDS) {
    const r = await runChapterHeadless(
      halcyon,
      seed,
      PLAYERS.halcyon(),
      flags,
      undefined,
      undefined,
      halcyonJourney(0.3),
    );
    if (r.flags.wispHome) home += 1;
    const sent = r.log.find((e) => e.kind === 'postcard');
    if (!sent) throw new Error(`halcyon seed ${String(seed)} sent no postcard`);
    seconds.push(sent.tick / tuning.sim.stepsPerSecond);
  }
  const sorted = [...seconds].sort((a, b) => a - b);
  const median = ((sorted[99] ?? 0) + (sorted[100] ?? 0)) / 2;
  console.log(`T3 halcyon: Wisp home ${String(home)}, postcard median ${String(median)} s`);
  expect(home).toBeGreaterThanOrEqual(190);
  expect(median).toBeGreaterThanOrEqual(360);
  expect(median).toBeLessThanOrEqual(480);
}, 900_000); // 200 runs to the third dusk: near the t3 project's 600-s default
