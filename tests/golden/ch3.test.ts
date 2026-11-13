// T3 (spec testing, plan task M1.11): over 200 seeds, ch3's twist (the bench warms the village)
// happens honestly, so the close call plays in fewer than 10 runs.
import { expect, test } from 'vitest';
import ch3Json from '../../content/chapters/ch3.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { PLAYERS } from './players.ts';
import { runChapterHeadless, SEEDS, summarize } from './run-chapter.ts';

const ch3 = ChapterSchema.parse(ch3Json);

// ch3 reads pimScar, which ch2 writes: run both inputs (ch2's twist sets it in nearly every run).
for (const pimScar of [true, false]) {
  test(`T3 ch3 (pimScar ${String(pimScar)}): the close call plays in fewer than 10 of 200 seeds`, async () => {
    const flags = { ...parseFlags(flagsJson), pimScar };
    const runs = [];
    for (const seed of SEEDS) runs.push(await runChapterHeadless(ch3, seed, PLAYERS.ch3(), flags));
    const s = summarize(runs);
    console.log(`T3 ch3 pimScar=${String(pimScar)}: ${JSON.stringify(s)}`);
    expect(s.closeCalls).toBeLessThan(10);
  });
}
