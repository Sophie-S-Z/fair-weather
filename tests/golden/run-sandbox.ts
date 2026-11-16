// T3 sandbox runs (plan task M4.5): one sandbox setup, headless, over the real worker core in this
// process, as run-chapter.ts plays a chapter. The sandbox runner sends the player's tools through a
// direct SimPort; `advance` steps one tick at a time, so the run is deterministic and needs no clock.
import councilScene from '../../content/scenes/council.json';
import fenScene from '../../content/scenes/fen.json';
import foglightScene from '../../content/scenes/foglight.json';
import shallowsScene from '../../content/scenes/shallows.json';
import halcyonScene from '../../content/scenes/halcyon.json';
import hollowScene from '../../content/scenes/hollow.json';
import kithScene from '../../content/scenes/kith-meadow.json';
import councilJson from '../../content/scenarios/council.json';
import fenJson from '../../content/scenarios/fen.json';
import foglightJson from '../../content/scenarios/foglight.json';
import shallowsJson from '../../content/scenarios/shallows.json';
import halcyonJson from '../../content/scenarios/halcyon.json';
import hollowJson from '../../content/scenarios/hollow.json';
import m0Json from '../../content/scenarios/m0.json';
import tuningJson from '../../content/tuning.json';
import type { FromWorker, SimPort, WorldLite } from '../../src/sim-host/protocol.ts';
import { createWorkerCore } from '../../src/sim-host/worker-core.ts';
import type { Scenario } from '../../src/sim/types.ts';
import type { ChallengeState } from '../../src/story/challenges.ts';
import { createSandboxRunner, sandboxScenario, sandboxTuning } from '../../src/story/sandbox.ts';
import type { SandboxRunner, SandboxSetup, SandboxValley } from '../../src/story/sandbox.ts';

/** Each valley's base scenario (Kith's is m0, ADR 0014 item 1). */
export const SANDBOX_BASES: Record<SandboxValley, Scenario> = {
  kith: m0Json as Scenario,
  fen: fenJson as Scenario,
  hollow: hollowJson as Scenario,
  foglight: foglightJson as Scenario,
  council: councilJson as Scenario,
  shallows: shallowsJson as Scenario,
  halcyon: halcyonJson as Scenario,
};
/** Each valley's bench spots, from its scene. */
const BENCH_SPOTS: Record<SandboxValley, readonly { id: string; x: number; y: number }[]> = {
  kith: kithScene.benchSpots,
  fen: fenScene.benchSpots,
  hollow: hollowScene.benchSpots,
  foglight: foglightScene.benchSpots,
  council: councilScene.benchSpots,
  shallows: shallowsScene.benchSpots,
  halcyon: halcyonScene.benchSpots,
};

/** The scenario `setup` starts from, with its valley's base and bench spots. */
export function sandboxStart(setup: SandboxSetup): Scenario {
  return sandboxScenario(setup, SANDBOX_BASES, BENCH_SPOTS[setup.valley]);
}

/** A sandbox player. Make a new one per run: it may keep state. */
export interface SandboxPlayer {
  /** Called after every step, once the runner has seen the step's snapshot `lite`. */
  onTick?(tick: number, runner: SandboxRunner, lite: WorldLite): void;
}

const NO_CLOCK = { now: () => 0, every: () => () => undefined };

/**
 * Plays the challenge of `setup` until it passes or fails, or for `maxTicks` ticks, and returns its
 * state then ('open' when the ticks ran out) and the last snapshot. Throws for a setup without a
 * challenge and on a sim error.
 */
export function runSandboxHeadless(
  setup: SandboxSetup,
  player: SandboxPlayer,
  maxTicks: number,
): { state: ChallengeState; last: WorldLite } {
  const listeners = new Set<(m: FromWorker) => void>();
  // Set from callbacks, so an object: a plain `let` would look constant to the loop below.
  const run = { error: null as string | null, tick: 0, last: null as WorldLite | null };
  const core = createWorkerCore((m) => {
    if (m.t === 'error') run.error = m.message;
    if (m.t === 'snapshot') {
      run.tick = m.tick;
      run.last = m.lite;
    }
    for (const cb of [...listeners]) cb(m);
  }, NO_CLOCK);
  const port: SimPort = {
    send: (list) => {
      core({ t: 'commands', list });
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    speed: () => undefined, // headless: `advance` sets the pace
    requestHash: () => Promise.reject(new Error('not used headless')),
  };
  const runner = createSandboxRunner(port, setup);
  core({
    t: 'init',
    seed: setup.seed,
    tuning: sandboxTuning(setup, tuningJson),
    scenario: sandboxStart(setup),
  });
  const name = `${setup.challenge ?? 'no challenge'} seed ${String(setup.seed)}`;
  if (runner.challenge() === null) throw new Error(`${name}: the setup has no challenge`);
  try {
    for (let i = 0; i < maxTicks && runner.challenge() === 'open'; i++) {
      core({ t: 'advance', ticks: 1 });
      if (run.error !== null) throw new Error(`sim error in ${name}: ${run.error}`);
      if (run.last) player.onTick?.(run.tick, runner, run.last);
    }
    const state = runner.challenge();
    if (!run.last || state === null) throw new Error(`${name} ended before its first snapshot`);
    return { state, last: run.last };
  } finally {
    runner.dispose();
  }
}
