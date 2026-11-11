// All worker message logic (ADR 0009 item 6). worker.ts only connects it to `self`.
import { checkInvariants } from '../sim/invariants.ts';
import { hashWorld } from '../sim/hash.ts';
import { step } from '../sim/step.ts';
import { parseTuning } from '../sim/tuning.ts';
import type { Tuning } from '../sim/tuning.ts';
import type { Command, World } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { toLite } from './lite.ts';
import type { FromWorker, ToWorker } from './protocol.ts';

export interface Clock {
  now(): number;
  every(ms: number, fn: () => void): () => void;
}

export interface CoreOptions {
  /** Development build: check invariants after every step (spec 16). */
  dev: boolean;
}

/** Steps owed after a long stall are dropped beyond this many per timer call. */
const MAX_CATCH_UP = 10;

/**
 * Returns the message handler. Pacing reads only `clock`, at `sim.stepsPerSecond × multiplier`
 * steps per second; a new core is paused. After an error the core ignores every message but
 * `init`.
 */
export function createWorkerCore(
  post: (m: FromWorker) => void,
  clock: Clock,
  opts: CoreOptions = { dev: false },
): (m: ToWorker) => void {
  let world: World | null = null;
  let tuning: Tuning | null = null;
  let pending: Command[] = [];
  let multiplier = 0;
  let stopTimer: (() => void) | null = null;
  let failed = false;

  function fail(message: string, lastGoodTick: number): void {
    failed = true;
    stopTimer?.();
    stopTimer = null;
    post({ t: 'error', message, lastGoodTick });
  }

  /** Runs one step and posts its events and snapshot, and a checkpoint after dusk. False on error. */
  function stepOnce(w: World, t: Tuning): boolean {
    const tick = w.tick;
    const list = pending;
    pending = [];
    try {
      const events = step(w, list, t);
      if (opts.dev) {
        const bad = checkInvariants(w, t);
        if (bad.length > 0) {
          fail(`invariant violation after tick ${String(tick)}: ${bad.join('; ')}`, tick);
          return false;
        }
      }
      post({ t: 'events', tick, list: events });
      post({ t: 'snapshot', tick: w.tick, lite: toLite(w, t) });
      if (tick % w.ticksPerDay === w.ticksPerDay - 1) {
        post({ t: 'checkpoint', tick: w.tick, world: structuredClone(w) });
      }
      return true;
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e), tick);
      return false;
    }
  }

  function pace(): void {
    stopTimer?.();
    stopTimer = null;
    if (multiplier <= 0 || !world || !tuning || failed) return;
    const w = world;
    const t = tuning;
    const rate = t.sim.stepsPerSecond * multiplier;
    let last = clock.now();
    let owed = 0;
    stopTimer = clock.every(1000 / rate, () => {
      const now = clock.now();
      owed += ((now - last) * rate) / 1000;
      last = now;
      const n = Math.min(Math.floor(owed + 1e-9), MAX_CATCH_UP);
      owed = n === MAX_CATCH_UP ? 0 : owed - n;
      for (let i = 0; i < n; i++) if (!stepOnce(w, t)) break;
    });
  }

  function handle(m: ToWorker): void {
    if (m.t === 'init') {
      tuning = parseTuning(m.tuning);
      world = m.checkpoint ?? createWorld(m.seed, tuning, m.scenario);
      pending = [];
      multiplier = 0; // a new world starts paused (ADR 0009 item 2)
      failed = false;
      pace();
      return;
    }
    if (m.t === 'speed') {
      multiplier = m.multiplier;
      pace();
      return;
    }
    if (failed) return;
    if (!world || !tuning) throw new Error(`'${m.t}' before 'init'`);
    switch (m.t) {
      case 'commands':
        if (!Array.isArray(m.list)) return; // the list crosses the worker boundary
        pending.push(...m.list);
        post({ t: 'accepted', tick: world.tick, list: m.list });
        return;
      case 'hash':
        post({ t: 'hash', tick: world.tick, value: hashWorld(world) });
        return;
      case 'advance':
        for (let i = 0; i < m.ticks; i++) if (!stepOnce(world, tuning)) break;
        return;
    }
  }

  return (m) => {
    try {
      handle(m);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e), world?.tick ?? -1);
    }
  };
}
