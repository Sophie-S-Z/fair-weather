// Hero balance for Murmuration Fen (ADR 0013 item 15): for each hero kind, over seeds 1 to 10, the
// T3 player brings Tove's flight in at least 8, and the control (never joins) in at most 2. Its own
// file so vitest runs it beside the Hollow and Halcyon balance files.
import { expect, test } from 'vitest';
import fenJson from '../../content/valleys/fen.json';
import flagsJson from '../../content/flags.json';
import { HERO_KINDS } from '../../src/sim/types.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { PLAYERS, walksToTove } from './players.ts';
import { controlFired, runChapterHeadless } from './run-chapter.ts';
import { BALANCE_SEEDS, journeyFor } from './valleys.ts';

const fen = ChapterSchema.parse(fenJson);
const flags = parseFlags(flagsJson);

test.each(HERO_KINDS)(
  'hero balance fen: %s',
  async (kind) => {
    let fired = 0;
    for (const seed of BALANCE_SEEDS) {
      const r = await runChapterHeadless(
        fen,
        seed,
        PLAYERS.fen(),
        flags,
        undefined,
        undefined,
        journeyFor(kind),
      );
      if (r.twistFired) fired += 1;
    }
    const control = await controlFired(
      fen,
      walksToTove(false),
      flags,
      undefined,
      journeyFor(kind),
      BALANCE_SEEDS,
    );
    console.log(`hero balance fen ${kind}: fired ${String(fired)}, control ${String(control)}`);
    expect(fired).toBeGreaterThanOrEqual(8);
    expect(control).toBeLessThanOrEqual(2);
  },
  600_000,
); // per kind: 10 runs to day 1's dusk and 10 whole 540-s control days, with room to spare
