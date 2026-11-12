// T3 (spec testing, plan task M2.8): over 200 seeds from the stored carry, ch6's twist (the fog starts a revenge loop)
// happens honestly, so the close call plays in fewer than 10 runs.
import { expect, test } from 'vitest';
import ch6Json from '../../content/chapters/ch6.json';
import flagsJson from '../../content/flags.json';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from './carry/ch6.json';
import { PLAYERS } from './players.ts';
import { runChapterHeadless, SEEDS, summarize } from './run-chapter.ts';

const ch6 = ChapterSchema.parse(ch6Json);
const carry: Carry = carryJson;

test('T3 ch6: the close call plays in fewer than 10 of 200 seeds', async () => {
  const flags = parseFlags(flagsJson);
  const runs = [];
  for (const seed of SEEDS)
    runs.push(await runChapterHeadless(ch6, seed, PLAYERS.ch6(), flags, undefined, carry));
  const s = summarize(runs);
  console.log(`T3 ch6: ${JSON.stringify(s)}`);
  expect(s.closeCalls).toBeLessThan(10);
});
