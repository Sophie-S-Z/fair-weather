// T3 (plan task M3.10): over 200 seeds, from Kith after Part 1 and 20 silent days (carry/home.json,
// ADR 0013 item 18) with kithHeld true, the homecoming's twist (three of the cast are warm to the
// hero) happens honestly, so the close call plays in fewer than 10 runs. No length: it is not one
// of spec 7.3's six valleys.
import { expect, test } from 'vitest';
import homeJson from '../../content/valleys/home.json';
import flagsJson from '../../content/flags.json';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from './carry/home.json';
import { PLAYERS } from './players.ts';
import { runChapterHeadless, summarize } from './run-chapter.ts';
import { HOME_JOURNEY, VALLEY_SEEDS } from './valleys.ts';

const home = ChapterSchema.parse(homeJson);
const carry: Carry = carryJson;

test('T3 home: with kithHeld, fewer than 10 close calls in 200', async () => {
  const flags = { ...parseFlags(flagsJson), kithHeld: true };
  const runs = [];
  for (const seed of VALLEY_SEEDS)
    runs.push(await runChapterHeadless(home, seed, PLAYERS.home(), flags, undefined, carry, HOME_JOURNEY));
  const s = summarize(runs);
  console.log(`T3 home: ${JSON.stringify(s)}`);
  expect(s.closeCalls).toBeLessThan(10);
}, 900_000); // 200 runs of at most four 4-day windows of 40-s days: near the t3 project's 600-s default
