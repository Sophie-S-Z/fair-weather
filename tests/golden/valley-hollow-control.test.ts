// T3 control for Hearsay Hollow (plan task M3.9): posing, not time alone, makes the hero famous.
// Act kind, and the town forgets you (spec 7.3). Its own file so vitest runs it beside
// valley-hollow.test.ts.
import { expect, test } from 'vitest';
import hollowJson from '../../content/valleys/hollow.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { walksToSquare } from './players.ts';
import { controlFired } from './run-chapter.ts';
import { JOURNEY } from './valleys.ts';

const hollow = ChapterSchema.parse(hollowJson);

// The same walk to the square, never posing, toward and give, first window only: the hero may
// become famous in at most 20 of 200.
test('T3 hollow control: a kind hero that never poses becomes famous in at most 20 of 200 seeds', async () => {
  const fired = await controlFired(hollow, walksToSquare(false), parseFlags(flagsJson), undefined, JOURNEY);
  console.log(`T3 hollow control: fired ${String(fired)}`);
  expect(fired).toBeLessThanOrEqual(20);
}, 1_200_000);
