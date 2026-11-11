// T3 control for ch3 (plan task M1.11, fix round 3): the bench, not time alone, warms the village.
// Its own file so vitest runs it beside ch3.test.ts.
import { expect, test } from 'vitest';
import ch3Json from '../../content/chapters/ch3.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { chapterTicksPerDay } from '../../src/story/scenario.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import type { Chapter } from '../../src/story/schema.ts';
import { runChapterHeadless, SEEDS } from './run-chapter.ts';

const ch3 = ChapterSchema.parse(ch3Json);

// Control (spec 6.2: the bench flips the village "because the same pairs meet again"). Same seeds,
// no bench, and the twist window opened at the tick the T3 player places the bench (no opensOn).
// Only the first window counts, since retries are a separate honest mechanism: the twist may fire
// in at most 20 of 200 runs.
const twist = ch3.twist ?? noTwist();
const noBench: Chapter = {
  ...ch3,
  twist: { id: twist.id, withinDays: twist.withinDays, retryArrange: twist.retryArrange },
};
// The window opens on the snapshot of tick 1 and its last check is at tick 1 + withinDays days.
const firstWindow = 1 + twist.withinDays * chapterTicksPerDay(ch3);

for (const pimScar of [true, false]) {
  test(`T3 ch3 control (pimScar ${String(pimScar)}): with no bench the twist fires in at most 20 of 200 seeds`, async () => {
    const flags = { ...parseFlags(flagsJson), pimScar };
    let fired = 0;
    for (const seed of SEEDS)
      if ((await runChapterHeadless(noBench, seed, {}, flags, firstWindow)).twistFired) fired += 1;
    console.log(`T3 ch3 control pimScar=${String(pimScar)}: fired ${String(fired)}`);
    expect(fired).toBeLessThanOrEqual(20);
  });
}

function noTwist(): never {
  throw new Error('ch3 has no twist');
}
