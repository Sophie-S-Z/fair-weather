// The stored carries (ADR 0012 item 1): one seeded headless year, ch3 to ch10. Each carried
// chapter's T3 run starts from its file here; after a content change, rewrite them with `-u`.
import { expect, test } from 'vitest';
import versesJson from '../../content/myth/verses.json';
import { brushShare, extractFeatures } from '../../src/myth/features.ts';
import { tellMyth, VersesSchema } from '../../src/myth/grammar.ts';
import { YearLogSchema } from '../../src/story/action-log.ts';
import type { YearLog } from '../../src/story/action-log.ts';
import { displayName } from '../../src/story/names.ts';
import { runYear } from './year.ts';
import tuningJson from '../../content/tuning.json';
import { parseTuning } from '../../src/sim/tuning.ts';

const share = brushShare(parseTuning(tuningJson));

// Played once, at import, for both tests.
const year = runYear(1, 'ch10');

test('the seed-1 year gives the stored carries', async () => {
  const { carries } = await year;
  expect(Object.keys(carries)).toEqual([
    'i3',
    'ch4',
    'i4',
    'ch5',
    'i5',
    'ch6',
    'ch7',
    'i7',
    'ch8',
    'i8',
    'ch9',
    'ch10',
  ]);
  for (const [id, carry] of Object.entries(carries))
    await expect(`${JSON.stringify(carry, null, 2)}\n`).toMatchFileSnapshot(`carry/${id}.json`);
});

// ADR 0012 item 11: the real year log, ch3 to ch9 as main.ts keeps it, reads through the myth.
test('the seed-1 year log through ch9 tells five verses with no open slot', async () => {
  const { results } = await year;
  const log: YearLog = Object.entries(results)
    .filter(([chapterId]) => chapterId !== 'ch10')
    .map(([chapterId, r]) => ({ chapterId, log: r.log }));
  const ch9 = results.ch9;
  if (!ch9) throw new Error('the year has no ch9');
  const skyWarmth = Object.fromEntries(ch9.last.creatures.map((c) => [c.id, c.skyWarmth]));
  const page = tellMyth(
    extractFeatures(log, ch9.flags, skyWarmth, share),
    VersesSchema.parse(versesJson),
    displayName,
  );
  expect(page.verses).toHaveLength(5);
  // The save format checks every entry (spec 15.1); a real year, ch10 included, passes it unchanged.
  const all: YearLog = Object.entries(results).map(([chapterId, r]) => ({ chapterId, log: r.log }));
  expect(YearLogSchema.parse(all)).toEqual(all);
  for (const v of page.verses) expect(`${v.text} ${v.note ?? ''}`).not.toMatch(/\{|\}|undefined|null/);
});
