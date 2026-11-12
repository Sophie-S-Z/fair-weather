// T3 control for ch8 (plan task M2.9): the culture the year built makes Old Moss share, not winter
// alone (spec 6.2). Its own file so vitest runs it beside ch8.test.ts.
import { expect, test } from 'vitest';
import ch8Json from '../../content/chapters/ch8.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { PLAYERS } from './players.ts';
import { controlFired } from './run-chapter.ts';

const ch8 = ChapterSchema.parse(ch8Json);

// The same player from an empty carry (no ties, every dial as in the base scenario), first window
// only: the twist may fire in at most 20 of 200 runs.
test('T3 ch8 control: from an empty carry, Old Moss shares in at most 20 of 200 seeds', async () => {
  const fired = await controlFired(ch8, PLAYERS.ch8, parseFlags(flagsJson), { creatures: [], ties: [] });
  console.log(`T3 ch8 control: fired ${String(fired)}`);
  expect(fired).toBeLessThanOrEqual(20);
});
