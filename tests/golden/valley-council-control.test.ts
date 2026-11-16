// T3 control for Toadstool Council (plan task M5.6 to M5.8): a proposal, not time alone, makes the council hear a rule.
// Its own file so vitest runs it beside valley-council.test.ts.
import { expect, test } from 'vitest';
import councilJson from '../../content/valleys/council.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { chapterTicksPerDay } from '../../src/story/scenario.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { votesAtCouncil } from './players.ts';
import { runChapterHeadless } from './run-chapter.ts';
import { JOURNEY, VALLEY_SEEDS } from './valleys.ts';

const council = ChapterSchema.parse(councilJson);
/** The window opens on the snapshot of tick 1, and with no retries the close call comes at its end. */
const CLOSE_BY = 1 + (council.twist?.withinDays ?? 0) * chapterTicksPerDay(council);

// The same vote, never proposing. With no retries the run is the first window only: the council hears a rule in at
// most 20 of 200, and each close call comes at that window's end.
test('T3 council control: without its verb the twist comes in at most 20 of 200 seeds, and its close call in one window', async () => {
  const flags = parseFlags(flagsJson);
  let fired = 0;
  let late = 0;
  for (const seed of VALLEY_SEEDS) {
    const r = await runChapterHeadless(
      council,
      seed,
      votesAtCouncil(false)(),
      flags,
      undefined,
      undefined,
      JOURNEY,
    );
    const twist = r.log.find((e) => e.kind === 'twist');
    if (r.twistFired) fired += 1;
    else if (!twist || twist.retries !== 0 || twist.tick > CLOSE_BY) late += 1;
  }
  console.log(`T3 council control: fired ${String(fired)}, late close calls ${String(late)}`);
  expect(fired).toBeLessThanOrEqual(20);
  expect(late).toBe(0);
}, 1_200_000);
