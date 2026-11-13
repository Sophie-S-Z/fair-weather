// T3 (spec testing, plan task M1.11): over 200 seeds, ch2's twist (Krit exploits Pim) happens
// honestly, so the close call plays in fewer than 10 runs.
import { expect, test } from 'vitest';
import ch2Json from '../../content/chapters/ch2.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { PLAYERS } from './players.ts';
import { runChapterHeadless, SEEDS, summarize } from './run-chapter.ts';
import type { ScriptedPlayer } from './run-chapter.ts';

// ch2.json sets Krit's opener to 0.02. At the pair's first meeting Krit gives with chance equal to
// his opener (ADR 0003 item 6); after a give/give first meeting neither holds a slight, both give
// from then on, and the twist can never fire. So close calls come to about 200 x Krit's opener:
// 0.1 gave 17-19, 0.05 gave 10-14, 0.02 gives 2-4 (M1.11 report, fix round 1).
const ch2 = ChapterSchema.parse(ch2Json);

test('T3 ch2: the close call plays in fewer than 10 of 200 seeds', async () => {
  const runs = [];
  let reveals = 0;
  for (const seed of SEEDS) {
    const player = PLAYERS.ch2();
    const counted: ScriptedPlayer = {
      onPrompt(p, runner) {
        player.onPrompt(p, runner);
        if (p.kind === 'reveal') reveals += 1;
      },
    };
    runs.push(await runChapterHeadless(ch2, seed, counted, parseFlags(flagsJson)));
  }
  const s = summarize(runs);
  console.log(`T3 ch2: ${JSON.stringify(s)}`);
  expect(s.closeCalls).toBeLessThan(10);
  // The twist may not end the chapter before the bet: every run reveals it.
  expect(reveals).toBe(SEEDS.length);
});
