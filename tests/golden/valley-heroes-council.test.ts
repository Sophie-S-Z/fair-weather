// Hero balance for Toadstool Council (ADR 0015 item 11): for each hero kind, over seeds 1 to 10, the
// T3 player (proposes) brings the twist in at least 8, and the control in at most 2. Its own file so
// vitest runs it beside the other balance files.
import { expect, test } from 'vitest';
import councilJson from '../../content/valleys/council.json';
import flagsJson from '../../content/flags.json';
import { HERO_KINDS } from '../../src/sim/types.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { PLAYERS, votesAtCouncil } from './players.ts';
import { controlFired, runChapterHeadless } from './run-chapter.ts';
import { BALANCE_SEEDS, journeyFor } from './valleys.ts';

const council = ChapterSchema.parse(councilJson);
const flags = parseFlags(flagsJson);

test.each(HERO_KINDS)(
  'hero balance council: %s',
  async (kind) => {
    let fired = 0;
    for (const seed of BALANCE_SEEDS) {
      const r = await runChapterHeadless(
        council,
        seed,
        PLAYERS.council(),
        flags,
        undefined,
        undefined,
        journeyFor(kind),
      );
      if (r.twistFired) fired += 1;
    }
    const control = await controlFired(
      council,
      votesAtCouncil(false),
      flags,
      undefined,
      journeyFor(kind),
      BALANCE_SEEDS,
    );
    console.log(`hero balance council ${kind}: fired ${String(fired)}, control ${String(control)}`);
    expect(fired).toBeGreaterThanOrEqual(8);
    expect(control).toBeLessThanOrEqual(2);
  },
  600_000,
);
