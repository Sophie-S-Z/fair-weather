// T3 control for Hearsay Hollow (plan task M3.9): posing, not time alone, makes the hero famous.
// Act kind, and the town forgets you (spec 7.3). Its own file so vitest runs it beside
// valley-hollow.test.ts.
import { expect, test } from 'vitest';
import hollowJson from '../../content/valleys/hollow.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { chapterTicksPerDay } from '../../src/story/scenario.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { walksToSquare } from './players.ts';
import { runChapterHeadless } from './run-chapter.ts';
import { JOURNEY, VALLEY_SEEDS } from './valleys.ts';

const hollow = ChapterSchema.parse(hollowJson);
/** The window opens on the snapshot of tick 1, and with no retries the close call comes at its end. */
const CLOSE_BY = 1 + (hollow.twist?.withinDays ?? 0) * chapterTicksPerDay(hollow);

// The same walk to the square, never posing, toward and give. With no retries (ADR 0013 item 17)
// the run is the first window only: the hero may become famous in at most 20 of 200, and each
// close call (the kind ending) comes at that window's end.
test('T3 hollow control: a kind hero that never poses becomes famous in at most 20 of 200 seeds, and its close call comes in one window', async () => {
  const flags = parseFlags(flagsJson);
  let fired = 0;
  let late = 0;
  for (const seed of VALLEY_SEEDS) {
    const r = await runChapterHeadless(
      hollow,
      seed,
      walksToSquare(false)(),
      flags,
      undefined,
      undefined,
      JOURNEY,
    );
    const twist = r.log.find((e) => e.kind === 'twist');
    if (r.twistFired) fired += 1;
    else if (!twist || twist.retries !== 0 || twist.tick > CLOSE_BY) late += 1;
  }
  console.log(`T3 hollow control: fired ${String(fired)}, late close calls ${String(late)}`);
  expect(fired).toBeLessThanOrEqual(20);
  expect(late).toBe(0);
}, 1_200_000);
