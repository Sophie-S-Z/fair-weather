// Hero balance for Halcyon (ADR 0013 item 15): for each hero kind carrying the Fen's feather, with
// Kith at 0.3, over seeds 1 to 10, the T3 player brings Wisp home in at least 8, and the player who
// gives three gifts and no keepsake in at most 2. Its own file so vitest runs it beside the Fen and
// Hollow balance files.
import { expect, test } from 'vitest';
import halcyonJson from '../../content/valleys/halcyon.json';
import flagsJson from '../../content/flags.json';
import { HERO_KINDS } from '../../src/sim/types.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { givesToWisp } from './players.ts';
import { runChapterHeadless } from './run-chapter.ts';
import { BALANCE_SEEDS, halcyonJourney } from './valleys.ts';

const halcyon = ChapterSchema.parse(halcyonJson);
const flags = parseFlags(flagsJson);

test.each(HERO_KINDS)(
  'hero balance halcyon: %s',
  async (kind) => {
    const journey = { ...halcyonJourney(0.3), kind };
    const home = async (keepsake: boolean): Promise<number> => {
      let n = 0;
      for (const seed of BALANCE_SEEDS) {
        const r = await runChapterHeadless(
          halcyon,
          seed,
          givesToWisp(keepsake)(),
          flags,
          undefined,
          undefined,
          journey,
        );
        if (r.flags.wispHome) n += 1;
      }
      return n;
    };
    const t3 = await home(true);
    const control = await home(false);
    console.log(`hero balance halcyon ${kind}: Wisp home ${String(t3)}, three gifts only ${String(control)}`);
    expect(t3).toBeGreaterThanOrEqual(8);
    expect(control).toBeLessThanOrEqual(2);
  },
  300_000,
); // per kind: 20 runs to the third dusk at 420 s, with room to spare
