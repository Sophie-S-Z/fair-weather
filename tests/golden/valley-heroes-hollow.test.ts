// Hero balance for Hearsay Hollow (ADR 0013 item 15): for each hero kind, over seeds 1 to 10, the
// T3 player (poses) makes the hero famous in at least 8, and the control (never poses, toward and
// give) in at most 2. Its own file so vitest runs it beside the Fen and Halcyon balance files.
import { expect, test } from 'vitest';
import hollowJson from '../../content/valleys/hollow.json';
import flagsJson from '../../content/flags.json';
import { HERO_KINDS } from '../../src/sim/types.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { PLAYERS, walksToSquare } from './players.ts';
import { controlFired, runChapterHeadless } from './run-chapter.ts';
import { BALANCE_SEEDS, journeyFor } from './valleys.ts';

const hollow = ChapterSchema.parse(hollowJson);
const flags = parseFlags(flagsJson);

test.each(HERO_KINDS)(
  'hero balance hollow: %s',
  async (kind) => {
    let fired = 0;
    for (const seed of BALANCE_SEEDS) {
      const r = await runChapterHeadless(
        hollow,
        seed,
        PLAYERS.hollow(),
        flags,
        undefined,
        undefined,
        journeyFor(kind),
      );
      if (r.twistFired) fired += 1;
    }
    const control = await controlFired(
      hollow,
      walksToSquare(false),
      flags,
      undefined,
      journeyFor(kind),
      BALANCE_SEEDS,
    );
    console.log(`hero balance hollow ${kind}: fired ${String(fired)}, control ${String(control)}`);
    expect(fired).toBeGreaterThanOrEqual(8);
    expect(control).toBeLessThanOrEqual(2);
  },
  600_000,
); // per kind: 10 runs to the postcard near 420 s and 10 seven-day control windows, with room to spare
