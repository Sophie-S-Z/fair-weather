// T3 calibration of the three sandbox challenges (ADR 0014 item 6): over seeds 1 to 20, the
// scripted player passes each in at least 16 and the idle player in at most 4.
import { expect, test } from 'vitest';
import type { ChallengeId } from '../../src/story/challenges.ts';
import { DEFAULT_SWITCHES } from '../../src/story/sandbox.ts';
import type { SandboxSetup } from '../../src/story/sandbox.ts';
import { runSandboxHeadless, sandboxStart } from './run-sandbox.ts';
import type { SandboxPlayer } from './run-sandbox.ts';
import { bridgesTheBrook, feedsTheValley, idle, warmsKrit } from './sandbox-players.ts';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
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

/** Past every challenge's end: two of the scenario's seasons and one more day. */
function maxTicks(s: SandboxSetup): number {
  const { seasonDays, ticksPerDay } = sandboxStart(s);
  if (seasonDays === undefined || ticksPerDay === undefined) throw new Error('the seasons do not turn');
  return (2 * seasonDays + 1) * ticksPerDay;
}

function passes(challenge: ChallengeId, player: () => SandboxPlayer): number {
  let n = 0;
  for (const seed of SEEDS) {
    const s = setup(challenge, seed);
    const { state } = runSandboxHeadless(s, player(), maxTicks(s));
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
