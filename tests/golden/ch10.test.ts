// T3 (spec testing, plan task M2.9): over 200 seeds from the stored carry, ch10 reaches its exit,
// the beat that plays when the fire's story is heard.
import { expect, test } from 'vitest';
import ch10Json from '../../content/chapters/ch10.json';
import flagsJson from '../../content/flags.json';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from './carry/ch10.json';
import { PLAYERS } from './players.ts';
import { runChapterHeadless, SEEDS } from './run-chapter.ts';

const ch10 = ChapterSchema.parse(ch10Json);
const carry: Carry = carryJson;

test('T3 ch10: every one of 200 seeds reaches the exit', async () => {
  const flags = parseFlags(flagsJson);
  let exits = 0;
  for (const seed of SEEDS) {
    const r = await runChapterHeadless(ch10, seed, PLAYERS.ch10(), flags, undefined, carry);
    if (r.log.some((e) => e.kind === 'activity' && e.result === 'heard')) exits += 1;
  }
  console.log(`T3 ch10: ${String(exits)} of 200 reach the exit`);
  expect(exits).toBe(200);
});
