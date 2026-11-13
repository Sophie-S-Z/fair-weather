// T3 (spec testing, plan task M2.9): over 200 seeds from the stored carry, ch9's twist (Bell dances)
// happens honestly, so the close call plays in fewer than 10 runs.
import { expect, test } from 'vitest';
import ch9Json from '../../content/chapters/ch9.json';
import flagsJson from '../../content/flags.json';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from './carry/ch9.json';
import { PLAYERS } from './players.ts';
import { runChapterHeadless, SEEDS, summarize } from './run-chapter.ts';

const ch9 = ChapterSchema.parse(ch9Json);
const carry: Carry = carryJson;

test('T3 ch9: the close call plays in fewer than 10 of 200 seeds', async () => {
  const flags = parseFlags(flagsJson);
  const runs = [];
  for (const seed of SEEDS)
    runs.push(await runChapterHeadless(ch9, seed, PLAYERS.ch9(), flags, undefined, carry));
  const s = summarize(runs);
  console.log(`T3 ch9: ${JSON.stringify(s)}`);
  expect(s.closeCalls).toBeLessThan(10);
});
