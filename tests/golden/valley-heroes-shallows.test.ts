// Hero balance for Lily Shallows (ADR 0015 item 11): for each hero kind, over seeds 1 to 10, the
// T3 player (sings) brings the twist in at least 8, and the control in at most 2. Its own file so
// vitest runs it beside the other balance files.
import { expect, test } from 'vitest';
import shallowsJson from '../../content/valleys/shallows.json';
import flagsJson from '../../content/flags.json';
import { HERO_KINDS } from '../../src/sim/types.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { PLAYERS, singsAtShallows } from './players.ts';
import { controlFired, runChapterHeadless } from './run-chapter.ts';
import { BALANCE_SEEDS, journeyFor } from './valleys.ts';

const shallows = ChapterSchema.parse(shallowsJson);
const flags = parseFlags(flagsJson);

test.each(HERO_KINDS)(
  'hero balance shallows: %s',
  async (kind) => {
    let fired = 0;
    for (const seed of BALANCE_SEEDS) {
      const r = await runChapterHeadless(
        shallows,
        seed,
        PLAYERS.shallows(),
        flags,
        undefined,
        undefined,
        journeyFor(kind),
      );
      if (r.twistFired) fired += 1;
    }
    const control = await controlFired(
      shallows,
      singsAtShallows(false),
      flags,
      undefined,
      journeyFor(kind),
      BALANCE_SEEDS,
    );
    console.log(`hero balance shallows ${kind}: fired ${String(fired)}, control ${String(control)}`);
    expect(fired).toBeGreaterThanOrEqual(8);
    expect(control).toBeLessThanOrEqual(2);
  },
  600_000,
);
