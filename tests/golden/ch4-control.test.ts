// T3 control for ch4 (plan task M2.8, fix round 1): the light grows the thorns, not the carry alone.
// Its own file so vitest runs it beside ch4.test.ts.
import { expect, test } from 'vitest';
import ch4Json from '../../content/chapters/ch4.json';
import flagsJson from '../../content/flags.json';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from './carry/ch4.json';
import { firstOption } from './players.ts';
import { controlFired } from './run-chapter.ts';

const ch4 = ChapterSchema.parse(ch4Json);
const carry: Carry = carryJson;

// Same seeds and carry, with no light, first window only: the twist may fire in at most 20 of 200 runs.
test('T3 ch4 control: with no light, the twist fires in at most 20 of 200 seeds', async () => {
  const fired = await controlFired(ch4, () => ({ onPrompt: firstOption }), parseFlags(flagsJson), carry);
  console.log(`T3 ch4 control: fired ${String(fired)}`);
  expect(fired).toBeLessThanOrEqual(20);
});
