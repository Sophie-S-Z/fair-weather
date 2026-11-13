// T3 for ch8's Krit-away variant (plan task M2.9, fix round 1). The year's own ch4 and ch5 runs
// write litConflict 0.51 and rumorStuck true, so Krit spends the winter away (spec P6). Krit comes
// back only by the weekly return (spec 9.4), and arranging a meeting with an away creature does
// nothing, so this path's close call is the earned "ache" of earlier choices: it is exempt from the
// fewer-than-10 limit (ADR 0012 item 16). The test records its rate. Its own file so vitest runs it
// beside ch8.test.ts.
import { expect, test } from 'vitest';
import ch8Json from '../../content/chapters/ch8.json';
import flagsJson from '../../content/flags.json';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from './carry/ch8.json';
import { PLAYERS } from './players.ts';
import { runChapterHeadless, SEEDS, summarize } from './run-chapter.ts';

const ch8 = ChapterSchema.parse(ch8Json);
const carry: Carry = carryJson;

test('T3 ch8 (Krit away): the close call is the minority outcome of 200 seeds', async () => {
  const flags = { ...parseFlags(flagsJson), litConflict: 0.51, rumorStuck: true };
  const runs = [];
  for (const seed of SEEDS)
    runs.push(await runChapterHeadless(ch8, seed, PLAYERS.ch8(), flags, undefined, carry));
  const s = summarize(runs);
  console.log(`T3 ch8 Krit away: ${JSON.stringify(s)}`);
  expect(s.closeCalls).toBeLessThan(100);
  // Most seeds here retry the twist up to three times, so this is the slowest T3 file: about 10
  // minutes alone and 16 on a CI runner beside the other files. It gets 30 minutes.
}, 1_800_000);
