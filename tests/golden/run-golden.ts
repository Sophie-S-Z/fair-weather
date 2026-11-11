// The M0 golden run: the m0 scenario, seed 1, and the fixed m0 command list for 4,000 ticks.
// Shared by the unit golden-hash test and the browser golden test (plan task M0.10).
import tuningJson from '../../content/tuning.json';
import scenarioJson from '../../content/scenarios/m0.json';
import { step } from '../../src/sim/step.ts';
import { parseTuning } from '../../src/sim/tuning.ts';
import type { Command, Scenario, World } from '../../src/sim/types.ts';
import { createWorld } from '../../src/sim/world.ts';
import commandsJson from './m0-commands.json';
import golden from './m0-hash.json';

export const GOLDEN_SEED = golden.seed;
export const GOLDEN_TICKS = golden.ticks;

/** Plays the golden run and returns the final world. */
export function runGolden(): World {
  const tuning = parseTuning(tuningJson);
  const commands = commandsJson as { tick: number; cmd: Command }[];
  const w = createWorld(GOLDEN_SEED, tuning, scenarioJson as Scenario);
  for (let tick = 0; tick < GOLDEN_TICKS; tick++) {
    step(
      w,
      commands.filter((c) => c.tick === tick).map((c) => c.cmd),
      tuning,
    );
  }
  return w;
}
