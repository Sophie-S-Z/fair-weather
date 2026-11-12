// T3 golden runs (plan task M1.11): one chapter, headless, over the real worker core in this process.
// The chapter runner drives the sim through a direct SimPort; `advance` steps one tick at a time as
// fast as possible, so the run is deterministic and needs no clock.
import tuningJson from '../../content/tuning.json';
import scenarioJson from '../../content/scenarios/m0.json';
import inkStory from '../../content/ink/main.ink';
import type { FromWorker, SimPort } from '../../src/sim-host/protocol.ts';
import { createWorkerCore } from '../../src/sim-host/worker-core.ts';
import type { Scenario } from '../../src/sim/types.ts';
import type { ActionLog } from '../../src/story/action-log.ts';
import { createChapterRunner } from '../../src/story/chapter-runner.ts';
import type { ChapterRunner, Prompt } from '../../src/story/chapter-runner.ts';
import type { Flags } from '../../src/story/flags.ts';
import { createInk } from '../../src/story/ink.ts';
import { buildScenario } from '../../src/story/scenario.ts';
import type { Chapter } from '../../src/story/schema.ts';

/** A player that makes the obvious choices. Make a new one per run: it may keep state. */
export interface ScriptedPlayer {
  onPrompt?(p: Prompt, runner: ChapterRunner): void;
  /** Called after every step, once the runner has seen the step's snapshot. */
  onTick?(tick: number, runner: ChapterRunner): void;
}

export interface HeadlessResult {
  twistFired: boolean;
  retries: number;
  usedCloseCall: boolean;
  /** The chapter's action log, as main.ts keeps it in the year log. */
  log: ActionLog;
}

/** A guard far past the longest legal chapter (bet days plus 1 + honestyRetries twist windows). */
const MAX_TICKS = 100_000;

const NO_CLOCK = { now: () => 0, every: () => () => undefined };

/**
 * Plays `config` to its exit. With `stopAfterTicks`, a run still going after that many ticks stops
 * there and reports the twist as not fired, with 0 retries and no close call.
 */
export async function runChapterHeadless(
  config: Chapter,
  seed: number,
  player: ScriptedPlayer,
  flags: Flags,
  stopAfterTicks?: number,
): Promise<HeadlessResult> {
  const listeners = new Set<(m: FromWorker) => void>();
  // Set from callbacks, so an object: a plain `let` would look constant to the loop below.
  const run = { error: null as string | null, tick: 0, over: false };
  const core = createWorkerCore((m) => {
    if (m.t === 'error') run.error = m.message;
    if (m.t === 'snapshot') run.tick = m.tick;
    for (const cb of [...listeners]) cb(m);
  }, NO_CLOCK);
  core({
    t: 'init',
    seed,
    tuning: tuningJson,
    scenario: buildScenario(config, flags, scenarioJson as Scenario),
  });
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

  const runner = createChapterRunner(port, createInk(inkStory), config, flags);
  runner.onPrompt((p) => player.onPrompt?.(p, runner));
  const done = runner.done.finally(() => {
    run.over = true;
  });
  for (let i = 0; !run.over; i++) {
    if (i === stopAfterTicks) return { twistFired: false, retries: 0, usedCloseCall: false, log: runner.log };
    if (run.error !== null) throw new Error(`sim error in ${config.id} seed ${String(seed)}: ${run.error}`);
    if (i >= MAX_TICKS)
      throw new Error(`${config.id} seed ${String(seed)} did not end in ${String(MAX_TICKS)} ticks`);
    core({ t: 'advance', ticks: 1 });
    player.onTick?.(run.tick, runner);
    await Promise.resolve(); // lets `done` settle
  }
  await done;

  const twist = runner.log.find((e) => e.kind === 'twist');
  // A chapter without a twist (chapters 0 and 1) reports it as not fired, with no close call.
  if (!config.twist) return { twistFired: false, retries: 0, usedCloseCall: false, log: runner.log };
  if (!twist) throw new Error(`${config.id} seed ${String(seed)} ended without a twist entry`);
  return { twistFired: twist.fired, retries: twist.retries, usedCloseCall: !twist.fired, log: runner.log };
}

/** Seeds 1 to 200. */
export const SEEDS: readonly number[] = Array.from({ length: 200 }, (_, i) => i + 1);

/** Close calls, and how many runs needed 0, 1, 2, or 3 retries. */
export function summarize(runs: readonly HeadlessResult[]): {
  closeCalls: number;
  retries: Record<number, number>;
} {
  const retries: Record<number, number> = {};
  for (const r of runs) retries[r.retries] = (retries[r.retries] ?? 0) + 1;
  return { closeCalls: runs.filter((r) => r.usedCloseCall).length, retries };
}
