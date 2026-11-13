// T3 control for ch7 (plan task M2.8, fix round 1): the gust sends Wisp over the ridge, not the carry alone.
// Its own file so vitest runs it beside ch7.test.ts.
import { expect, test } from 'vitest';
import ch7Json from '../../content/chapters/ch7.json';
import flagsJson from '../../content/flags.json';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from './carry/ch7.json';
import { controlFired } from './run-chapter.ts';

const ch7 = ChapterSchema.parse(ch7Json);
const carry: Carry = carryJson;

// Same seeds and carry, with no gust, first window only: the twist may fire in at most 20 of 200 runs.
test('T3 ch7 control: with no gust, the twist fires in at most 20 of 200 seeds', async () => {
  const fired = await controlFired(ch7, () => ({}), parseFlags(flagsJson), carry);
  console.log(`T3 ch7 control: fired ${String(fired)}`);
  expect(fired).toBeLessThanOrEqual(20);
});
