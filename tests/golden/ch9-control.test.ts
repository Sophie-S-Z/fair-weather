// T3 control for ch9 (plan task M2.9): earlier choices decide whether the dance spreads (spec 6.2).
// Its own file so vitest runs it beside ch9.test.ts.
import { expect, test } from 'vitest';
import ch9Json from '../../content/chapters/ch9.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { PLAYERS } from './players.ts';
import { controlFired } from './run-chapter.ts';

const ch9 = ChapterSchema.parse(ch9Json);

// The same player, bridges and all, from an empty carry (no ties), first window only: the twist
// may fire in at most 20 of 200 runs.
test('T3 ch9 control: from an empty carry, Bell dances in at most 20 of 200 seeds', async () => {
  const fired = await controlFired(ch9, PLAYERS.ch9, parseFlags(flagsJson), { creatures: [], ties: [] });
  console.log(`T3 ch9 control: fired ${String(fired)}`);
  expect(fired).toBeLessThanOrEqual(20);
});
