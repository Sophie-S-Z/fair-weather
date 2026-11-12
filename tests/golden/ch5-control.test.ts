// T3 control for ch5 (plan task M2.8, fix round 1): Echo's threads carry the rumor, not the carry alone.
// Its own file so vitest runs it beside ch5.test.ts.
import { expect, test } from 'vitest';
import ch5Json from '../../content/chapters/ch5.json';
import flagsJson from '../../content/flags.json';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from './carry/ch5.json';
import { firstOption } from './players.ts';
import { controlFired } from './run-chapter.ts';
import type { ScriptedPlayer } from './run-chapter.ts';

const ch5 = ChapterSchema.parse(ch5Json);
const carry: Carry = carryJson;

/** Cuts every warm thread of Echo's each tick, so the rumor has no way out through her. */
const cutsEcho = (): ScriptedPlayer => ({
  onPrompt: firstOption,
  onTick(_tick, runner, lite) {
    for (const t of lite.ties)
      if ((t.a === 'echo' || t.b === 'echo') && (t.ab > 0 || t.ba > 0))
        runner.verb({ verb: 'thread', a: t.a, b: t.b, on: false });
  },
});

// Same seeds and carry, with Echo's threads cut, first window only: the twist may fire in at most 20 of 200 runs.
test("T3 ch5 control: with Echo's threads cut, the twist fires in at most 20 of 200 seeds", async () => {
  const fired = await controlFired(ch5, cutsEcho, parseFlags(flagsJson), carry);
  console.log(`T3 ch5 control: fired ${String(fired)}`);
  expect(fired).toBeLessThanOrEqual(20);
});
