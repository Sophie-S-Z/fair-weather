// T3 (plan task M3.8): over 200 seeds, Murmuration Fen's twist (Tove flies) happens honestly, so
// the close call plays in fewer than 10 runs; and joining, not time alone, brings it.
import { expect, test } from 'vitest';
import fenJson from '../../content/valleys/fen.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { PLAYERS, walksToTove } from './players.ts';
import { controlFired, runChapterHeadless, summarize } from './run-chapter.ts';
import { JOURNEY, VALLEY_SEEDS } from './valleys.ts';

const fen = ChapterSchema.parse(fenJson);

test('T3 fen: the close call plays in fewer than 10 of 200 seeds', async () => {
  const flags = parseFlags(flagsJson);
  const runs = [];
  for (const seed of VALLEY_SEEDS)
    runs.push(await runChapterHeadless(fen, seed, PLAYERS.fen(), flags, undefined, undefined, JOURNEY));
  const s = summarize(runs);
  console.log(`T3 fen: ${JSON.stringify(s)}`);
  expect(s.closeCalls).toBeLessThan(10);
});

// Control: the same walk to Tove, never joining, first window only: Tove may fly in at most 20 of 200.
test('T3 fen control: a hero that never joins sees Tove fly in at most 20 of 200 seeds', async () => {
  const fired = await controlFired(fen, walksToTove(false), parseFlags(flagsJson), undefined, JOURNEY);
  console.log(`T3 fen control: fired ${String(fired)}`);
  expect(fired).toBeLessThanOrEqual(20);
});
