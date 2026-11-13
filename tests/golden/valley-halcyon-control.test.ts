// T3 control for Halcyon (plan task M3.10): free gifts mean little (spec 7.3). The same walk to
// Wisp with three gifts and no keepsake brings Wisp home in at most 10 of 200. Its own file so
// vitest runs it beside valley-halcyon.test.ts.
import { expect, test } from 'vitest';
import halcyonJson from '../../content/valleys/halcyon.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { givesToWisp } from './players.ts';
import { runChapterHeadless } from './run-chapter.ts';
import { halcyonJourney, VALLEY_SEEDS } from './valleys.ts';

const halcyon = ChapterSchema.parse(halcyonJson);

test('T3 halcyon control: three gifts and no keepsake bring Wisp home in at most 10 of 200', async () => {
  const flags = parseFlags(flagsJson);
  let home = 0;
  for (const seed of VALLEY_SEEDS) {
    const r = await runChapterHeadless(
      halcyon,
      seed,
      givesToWisp(false)(),
      flags,
      undefined,
      undefined,
      halcyonJourney(0.3),
    );
    if (r.flags.wispHome) home += 1;
  }
  console.log(`T3 halcyon control: Wisp home ${String(home)}`);
  expect(home).toBeLessThanOrEqual(10);
}, 1_200_000); // 200 runs to the third dusk, as valley-halcyon.test.ts, with room to spare
