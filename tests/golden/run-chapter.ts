// T3 golden runs (plan task M1.11): one chapter, headless, over the real worker core in this process.
// The chapter runner drives the sim through a direct SimPort; `advance` steps one tick at a time as
// fast as possible, so the run is deterministic and needs no clock.
import tuningJson from '../../content/tuning.json';
import scenarioJson from '../../content/scenarios/m0.json';
import inkStory from '../../content/ink/main.ink';
import type { FromWorker, SimPort, WorldLite } from '../../src/sim-host/protocol.ts';
import { createWorkerCore } from '../../src/sim-host/worker-core.ts';
import type { Scenario } from '../../src/sim/types.ts';
import type { ActionLog } from '../../src/story/action-log.ts';
import { carriedDiaries } from '../../src/story/carry.ts';
import type { Carry } from '../../src/story/carry.ts';
import { createChapterRunner } from '../../src/story/chapter-runner.ts';
import type { ChapterRunner, Prompt } from '../../src/story/chapter-runner.ts';
import type { Flags } from '../../src/story/flags.ts';
import { createInk } from '../../src/story/ink.ts';
import { buildScenario, chapterTicksPerDay } from '../../src/story/scenario.ts';
import type { Chapter } from '../../src/story/schema.ts';

/** A player that makes the obvious choices. Make a new one per run: it may keep state. */
export interface ScriptedPlayer {
  onPrompt?(p: Prompt, runner: ChapterRunner): void;
  /** Called after every step, once the runner has seen the step's snapshot `lite`. */
  onTick?(tick: number, runner: ChapterRunner, lite: WorldLite): void;
}

export interface HeadlessResult {
  /** Null for a chapter without a twist. */
  twistFired: boolean | null;
  retries: number;
  usedCloseCall: boolean;
  /** The last snapshot: the next chapter's carry starts from it, as in main.ts. */
  last: WorldLite;
  /** The flags the chapter wrote; the flags it was given when stopped early. */
  flags: Flags;
  /** The chapter's action log, as main.ts keeps it in the year log. */
  log: ActionLog;
  /** Each creature's diary event lines, for the carry. */
  diaries: ReadonlyMap<string, readonly string[]>;
}

/** A guard far past the longest legal chapter (bet days plus 1 + honestyRetries twist windows). */
const MAX_TICKS = 100_000;

const NO_CLOCK = { now: () => 0, every: () => () => undefined };

/**
 * Plays `config` to its exit, from `carry` when given (as main.ts starts a carried chapter). With
 * `stopAfterTicks`, a run still going after that many ticks stops there and reports the twist as
 * not fired, with 0 retries and no close call.
 */
export async function runChapterHeadless(
  config: Chapter,
  seed: number,
  player: ScriptedPlayer,
  flags: Flags,
  stopAfterTicks?: number,
  carry?: Carry,
): Promise<HeadlessResult> {
  const listeners = new Set<(m: FromWorker) => void>();
  // Set from callbacks, so an object: a plain `let` would look constant to the loop below.
  const run = { error: null as string | null, tick: 0, last: null as WorldLite | null, over: false };
  const core = createWorkerCore((m) => {
    if (m.t === 'error') run.error = m.message;
    if (m.t === 'snapshot') {
      run.tick = m.tick;
      run.last = m.lite;
    }
    for (const cb of [...listeners]) cb(m);
  }, NO_CLOCK);
  const base = scenarioJson as Scenario;
  core({ t: 'init', seed, tuning: tuningJson, scenario: buildScenario(config, flags, base, carry) });
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

  const runner = createChapterRunner(
    port,
    createInk(inkStory),
    config,
    flags,
    carry && carriedDiaries(carry, base),
  );
  runner.onPrompt((p) => player.onPrompt?.(p, runner));
  const done = runner.done.finally(() => {
    run.over = true;
  });
  const result = (
    twistFired: boolean | null,
    retries: number,
    usedCloseCall: boolean,
    out: Flags,
  ): HeadlessResult => ({
    twistFired,
    retries,
    usedCloseCall,
    last: snapshot(run.last),
    flags: out,
    log: runner.log,
    diaries: runner.diaries,
  });
  for (let i = 0; !run.over; i++) {
    if (i === stopAfterTicks) return result(false, 0, false, flags);
    if (run.error !== null) throw new Error(`sim error in ${config.id} seed ${String(seed)}: ${run.error}`);
    if (i >= MAX_TICKS)
      throw new Error(`${config.id} seed ${String(seed)} did not end in ${String(MAX_TICKS)} ticks`);
    core({ t: 'advance', ticks: 1 });
    if (run.last) player.onTick?.(run.tick, runner, run.last);
    await Promise.resolve(); // lets `done` settle
  }
  const written = await done;

  // A chapter without a twist (chapters 0 and 1, the interludes) reports null, with no close call.
  if (!config.twist) return result(null, 0, false, written);
  const twist = runner.log.find((e) => e.kind === 'twist');
  if (!twist) throw new Error(`${config.id} seed ${String(seed)} ended without a twist entry`);
  return result(twist.fired, twist.retries, !twist.fired, written);
}

function snapshot(lite: WorldLite | null): WorldLite {
  if (!lite) throw new Error('the run ended before its first snapshot');
  return lite;
}

/**
 * The control form of ch3-control.test.ts: `config` from `carry`, with its twist window opened at
 * tick 1 instead of on a verb, played by `player` (made anew per seed) through that first window
 * only, since retries are a separate honest mechanism. Returns how many of the 200 seeds fired.
 */
export async function controlFired(
  config: Chapter,
  player: () => ScriptedPlayer,
  flags: Flags,
  carry: Carry,
): Promise<number> {
  const twist = config.twist;
  if (!twist) throw new Error(`${config.id} has no twist`);
  const control: Chapter = {
    ...config,
    twist: { id: twist.id, withinDays: twist.withinDays, retryArrange: twist.retryArrange },
  };
  // The window opens on the snapshot of tick 1 and its last check is at tick 1 + withinDays days.
  const firstWindow = 1 + twist.withinDays * chapterTicksPerDay(config);
  let fired = 0;
  for (const seed of SEEDS)
    if ((await runChapterHeadless(control, seed, player(), flags, firstWindow, carry)).twistFired) fired += 1;
  return fired;
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
