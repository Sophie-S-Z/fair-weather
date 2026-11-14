// T3 calibration of the three sandbox challenges (ADR 0014 item 6): over seeds 1 to 20, the
// scripted player passes each in at least 16 and the idle player in at most 4.
import { expect, test } from 'vitest';
import type { ChallengeId } from '../../src/story/challenges.ts';
import { DEFAULT_SWITCHES } from '../../src/story/sandbox.ts';
import type { SandboxSetup } from '../../src/story/sandbox.ts';
import { runSandboxHeadless } from './run-sandbox.ts';
import type { SandboxPlayer } from './run-sandbox.ts';
import { bridgesTheBrook, feedsTheValley, idle, warmsKrit } from './sandbox-players.ts';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
/** Past every challenge's end at the default season length: two seasons of 7 days of 400 ticks. */
const MAX_TICKS = 2 * 7 * 400 + 400;

const setup = (challenge: ChallengeId, seed: number): SandboxSetup => ({
  seed,
  valley: 'kith',
  kith: null,
  challenge,
  knobs: {},
  switches: { ...DEFAULT_SWITCHES },
  structures: [],
  bushes: [],
});

function passes(challenge: ChallengeId, player: () => SandboxPlayer): number {
  let n = 0;
  for (const seed of SEEDS) {
    const { state } = runSandboxHeadless(setup(challenge, seed), player(), MAX_TICKS);
    expect(state, `${challenge} seed ${String(seed)} ended`).not.toBe('open');
    if (state === 'passed') n += 1;
  }
  return n;
}

const SCRIPTED: Record<ChallengeId, () => SandboxPlayer> = {
  winter: feedsTheValley,
  bell: bridgesTheBrook,
  krit: warmsKrit,
};

for (const challenge of ['winter', 'bell', 'krit'] as const) {
  test(`${challenge}: the scripted player passes in at least 16 of 20 seeds, the idle player in at most 4`, () => {
    const scripted = passes(challenge, SCRIPTED[challenge]);
    const idlePasses = passes(challenge, idle);
    const numbers = `scripted ${String(scripted)} of 20, idle ${String(idlePasses)} of 20`;
    expect(scripted, numbers).toBeGreaterThanOrEqual(16);
    expect(idlePasses, numbers).toBeLessThanOrEqual(4);
  });
}
