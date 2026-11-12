// T6 (spec 18; ADR 0012 item 11): the myth differs in at least 900 of 1,000 random years, and a
// real headless year log reads through the myth the same way.
import { expect, test } from 'vitest';
import ch1Json from '../../../content/chapters/ch1.json';
import ch3Json from '../../../content/chapters/ch3.json';
import flagsJson from '../../../content/flags.json';
import versesJson from '../../../content/myth/verses.json';
import sceneJson from '../../../content/scenes/kith-meadow.json';
import { extractFeatures } from '../../../src/myth/features.ts';
import { tellMyth, VersesSchema } from '../../../src/myth/grammar.ts';
import { createRng } from '../../../src/sim/rng.ts';
import type { YearLog } from '../../../src/story/action-log.ts';
import { parseFlags } from '../../../src/story/flags.ts';
import { displayName } from '../../../src/story/names.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';
import { runChapterHeadless } from '../../golden/run-chapter.ts';
import { randomYear } from './random-year.ts';

const verses = VersesSchema.parse(versesJson);

test('T6: at least 900 of 1,000 random years give different myths', () => {
  const rng = createRng(6);
  const texts = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const r = randomYear(rng);
    texts.add(
      JSON.stringify(tellMyth(extractFeatures(r.year, r.flags, r.skyWarmth), verses, displayName).verses),
    );
  }
  console.log(`T6: ${String(texts.size)} different myths in 1,000 random years`);
  expect(texts.size).toBeGreaterThanOrEqual(900);
});

test('a real headless year log (chapters 1 and 3) reads through the myth', { timeout: 60_000 }, async () => {
  const flags = parseFlags(flagsJson);
  const bench = sceneJson.benchSpots[0];
  if (!bench) throw new Error('kith-meadow has no bench spot');
  const ch1 = ChapterSchema.parse(ch1Json);
  const ch3 = ChapterSchema.parse(ch3Json);
  // In ch1 the player turns against Pim's sky bid, which ends the chapter.
  let rumbles = 0;
  const ch1Run = await runChapterHeadless(
    ch1,
    1,
    {
      onTick(_tick, runner) {
        if (runner.verb({ verb: 'respond', reply: 'against' })) rumbles += 1;
      },
    },
    flags,
  );
  let placed = false;
  const ch3Run = await runChapterHeadless(
    ch3,
    1,
    {
      onTick(_tick, runner) {
        placed ||= runner.verb({ verb: 'place', x: bench.x, y: bench.y });
      },
    },
    flags,
  );
  // Kept as main.ts keeps it: one entry per chapter, in play order, holding the runner's log.
  const yearLog: YearLog = [
    { chapterId: ch1.id, log: ch1Run.log },
    { chapterId: ch3.id, log: ch3Run.log },
  ];
  const events = yearLog.flatMap((c) => c.log.flatMap((e) => (e.kind === 'event' ? [e.e] : [])));

  const f = extractFeatures(yearLog, flags, { pim: 0.1, krit: 0.3 });
  expect(rumbles).toBeGreaterThan(0);
  expect(f).toMatchObject({
    rumbles,
    welcomes: events.filter((e) => e.t === 'arrive').length,
    narrator: 'krit',
  });
  expect(f.mostLit === null).toBe(!events.some((e) => e.t === 'lit'));
  const page = tellMyth(f, verses, displayName);
  expect(page.verses).toHaveLength(5);
  for (const v of page.verses) expect(v.text).not.toMatch(/\{|\}|undefined|null/);
});
