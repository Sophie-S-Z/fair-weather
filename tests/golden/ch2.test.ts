// T3 (spec testing, plan task M1.11): over 200 seeds, ch2's twist (Krit exploits Pim) happens
// honestly, so the close call plays in fewer than 10 runs.
import { expect, test } from 'vitest';
import ch2Json from '../../content/chapters/ch2.json';
import flagsJson from '../../content/flags.json';
import { parseFlags } from '../../src/story/flags.ts';
import { ChapterSchema } from '../../src/story/schema.ts';
import { runChapterHeadless, SEEDS, summarize } from './run-chapter.ts';
import type { ScriptedPlayer } from './run-chapter.ts';

const ch2 = ChapterSchema.parse(ch2Json);

/** Answers the bet with its first option; leaves sky bids to the runner's automatic 'away'. */
const player = (onReveal: () => void): ScriptedPlayer => ({
  onPrompt(p, runner) {
    if (p.kind === 'bet' && p.options[0] !== undefined) runner.answerBet(p.options[0]);
    if (p.kind === 'reveal') onReveal();
  },
});

test('T3 ch2: the twist happens honestly in at least 95% of 200 seeds', async () => {
  const runs = [];
  let reveals = 0;
  for (const seed of SEEDS)
    runs.push(
      await runChapterHeadless(
        ch2,
        seed,
        player(() => (reveals += 1)),
        parseFlags(flagsJson),
      ),
    );
  const s = summarize(runs);
  console.log(`T3 ch2: ${JSON.stringify(s)}`);
  expect(s.closeCalls).toBeLessThan(10);
  // The twist may not end the chapter before the bet: every run reveals it.
  expect(reveals).toBe(SEEDS.length);
});
