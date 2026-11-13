// The bridge (plan task M3.8): from the stored ch10 carry, its player names the hero and the
// interlude reaches its exit, the beat after the activity.
import { expect, test } from 'vitest';
import bridgeJson from '../../content/chapters/bridge.json';
import flagsJson from '../../content/flags.json';
import type { Carry } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import carryJson from './carry/ch10.json';
import { PLAYERS } from './players.ts';
import { runChapterHeadless } from './run-chapter.ts';

const bridge = ChapterSchema.parse(bridgeJson);
const carry: Carry = carryJson;

test('the bridge, from the ch10 carry, reaches its exit with the hero lantern:Test', async () => {
  const r = await runChapterHeadless(bridge, 1, PLAYERS.bridge(), parseFlags(flagsJson), undefined, carry);
  expect(r.log.filter((e) => e.kind === 'activity').map((e) => e.result)).toEqual(['lantern:Test']);
});
