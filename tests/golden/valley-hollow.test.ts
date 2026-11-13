// T3 (plan task M3.9): over 200 seeds, Hearsay Hollow's twist (the hero becomes famous) happens
// honestly, so the close call plays in fewer than 10 runs, and the postcard comes after 6 to 8
// minutes of play at the median (spec 7.3).
import { expect, test } from 'vitest';
import hollowJson from '../../content/valleys/hollow.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { tuning } from '../../src/story/tuning.ts';
import { PLAYERS } from './players.ts';
import { runChapterHeadless, summarize } from './run-chapter.ts';
import { JOURNEY, VALLEY_SEEDS } from './valleys.ts';

const hollow = ChapterSchema.parse(hollowJson);

test('T3 hollow: fewer than 10 close calls, and the postcard at 6 to 8 minutes', async () => {
  const flags = parseFlags(flagsJson);
  const runs = [];
  const seconds: number[] = [];
  for (const seed of VALLEY_SEEDS) {
    const r = await runChapterHeadless(hollow, seed, PLAYERS.hollow(), flags, undefined, undefined, JOURNEY);
    runs.push(r);
    const sent = r.log.find((e) => e.kind === 'postcard');
    if (!sent) throw new Error(`hollow seed ${String(seed)} sent no postcard`);
    seconds.push(sent.tick / tuning.sim.stepsPerSecond);
  }
  const s = summarize(runs);
  const sorted = [...seconds].sort((a, b) => a - b);
  const median = ((sorted[99] ?? 0) + (sorted[100] ?? 0)) / 2;
  console.log(`T3 hollow: ${JSON.stringify(s)}, postcard median ${String(median)} s`);
  expect(s.closeCalls).toBeLessThan(10);
  expect(median).toBeGreaterThanOrEqual(360);
  expect(median).toBeLessThanOrEqual(480);
}, 900_000); // 200 runs to the postcard near 420 s: near the t3 project's 600-s default
