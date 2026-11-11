// T3 (spec testing, plan task M1.11): over 200 seeds, ch3's twist (the bench warms the village)
// happens honestly, so the close call plays in fewer than 10 runs.
import { expect, test } from 'vitest';
import ch3Json from '../../content/chapters/ch3.json';
import flagsJson from '../../content/flags.json';
import sceneJson from '../../content/scenes/kith-meadow.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { runChapterHeadless, SEEDS, summarize } from './run-chapter.ts';
import type { ScriptedPlayer } from './run-chapter.ts';

const ch3 = ChapterSchema.parse(ch3Json);
const spot = sceneJson.benchSpots.find((s) => s.id === 'under-crooked-tree');
if (!spot) throw new Error('kith-meadow has no bench spot under the crooked tree');
const bench = spot;

/** Places the bench under the crooked tree as soon as the runner takes a verb. */
const player = (): ScriptedPlayer => {
  let placed = false;
  return {
    onTick(_tick, runner) {
      if (!placed) placed = runner.verb({ verb: 'place', x: bench.x, y: bench.y });
    },
  };
};

// ch3 reads pimScar, which ch2 writes: run both inputs (ch2's twist sets it in nearly every run).
for (const pimScar of [true, false]) {
  test(`T3 ch3 (pimScar ${String(pimScar)}): the twist happens honestly in at least 95% of 200 seeds`, async () => {
    const flags = { ...parseFlags(flagsJson), pimScar };
    const runs = [];
    for (const seed of SEEDS) runs.push(await runChapterHeadless(ch3, seed, player(), flags));
    const s = summarize(runs);
    console.log(`T3 ch3 pimScar=${String(pimScar)}: ${JSON.stringify(s)}`);
    expect(s.closeCalls).toBeLessThan(10);
  });
}
