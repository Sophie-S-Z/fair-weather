// T3 control for ch6 (plan task M2.8, fix round 1): the fog starts the revenge loop, not the carry alone.
// Its own file so vitest runs it beside ch6.test.ts.
import { expect, test } from 'vitest';
import ch6Json from '../../content/chapters/ch6.json';
import flagsJson from '../../content/flags.json';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from './carry/ch6.json';
import { firstOption } from './players.ts';
import { controlFired } from './run-chapter.ts';

const ch6 = ChapterSchema.parse(ch6Json);
const carry: Carry = carryJson;

// Same seeds and carry, with no fog, first window only: the twist may fire in at most 20 of 200 runs.
test('T3 ch6 control: with no fog, the twist fires in at most 20 of 200 seeds', async () => {
  const fired = await controlFired(ch6, () => ({ onPrompt: firstOption }), parseFlags(flagsJson), carry);
  console.log(`T3 ch6 control: fired ${String(fired)}`);
  expect(fired).toBeLessThanOrEqual(20);
});
