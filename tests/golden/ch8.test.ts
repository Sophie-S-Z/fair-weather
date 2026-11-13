// T3 (spec testing, plan task M2.9): over 200 seeds from the stored carry, ch8's twist (Old Moss shares with Krit)
// happens honestly, so the close call plays in fewer than 10 runs.
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

test('T3 ch8: the close call plays in fewer than 10 of 200 seeds', async () => {
  const flags = parseFlags(flagsJson);
  const runs = [];
  for (const seed of SEEDS)
    runs.push(await runChapterHeadless(ch8, seed, PLAYERS.ch8(), flags, undefined, carry));
  const s = summarize(runs);
  console.log(`T3 ch8: ${JSON.stringify(s)}`);
  expect(s.closeCalls).toBeLessThan(10);
});
