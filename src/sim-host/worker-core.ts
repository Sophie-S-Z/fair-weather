// All worker message logic (ADR 0009 item 6). worker.ts only connects it to `self`.
import { checkInvariants } from '../sim/invariants.ts';
import { hashWorld } from '../sim/hash.ts';
import { step } from '../sim/step.ts';
import { parseTuning } from '../sim/tuning.ts';
import type { Tuning } from '../sim/tuning.ts';
import type { Command, SimEvent, World } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { toLite } from './lite.ts';
import type { ForwardStep, FromWorker, ToWorker, WorldLite } from './protocol.ts';

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
  /** For rewind: copies of the first world and of the world after each dusk, in tick order. */
  let kept: World[] = [];
  /** For rewind: every accepted list since init. */
  let accepted: { tick: number; list: Command[] }[] = [];

  function fail(message: string, lastGoodTick: number): void {
    failed = true;
    stopTimer?.();
    stopTimer = null;
    post({ t: 'error', message, lastGoodTick });
  }

  /**
   * Runs one step and posts its events and snapshot, and a checkpoint after dusk, unless `quiet`;
   * keeps the dusk copy either way. Returns the step's events, or null on error.
   */
  function stepOnce(w: World, t: Tuning, quiet = false): SimEvent[] | null {
    const tick = w.tick;
    const list = pending;
    pending = [];
    try {
      const events = step(w, list, t);
      if (opts.dev) {
        const bad = checkInvariants(w, t);
        if (bad.length > 0) {
          fail(`invariant violation after tick ${String(tick)}: ${bad.join('; ')}`, tick);
          return null;
        }
      }
      const dusk = tick % w.ticksPerDay === w.ticksPerDay - 1;
      if (dusk) kept.push(structuredClone(w));
      if (quiet) return events;
      post({ t: 'events', tick, list: events });
      post({ t: 'snapshot', tick: w.tick, lite: toLite(w, t) });
      if (dusk) post({ t: 'checkpoint', tick: w.tick, world: structuredClone(w) });
      return events;
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e), tick);
      return null;
    }
  }

  /** The steps the clock owes the running world, and when it last counted them. */
  let owed = 0;
  let last = 0;
  /** Adds the steps owed since the last count, at `sim.stepsPerSecond × multiplier` a second. */
  function count(t: Tuning): void {
    const now = clock.now();
    owed += ((now - last) * t.sim.stepsPerSecond * multiplier) / 1000;
    last = now;
  }

  function pace(): void {
    stopTimer?.();
    stopTimer = null;
    if (multiplier <= 0 || !world || !tuning || failed) return;
    const w = world;
    const t = tuning;
    last = clock.now();
    owed = 0;
    stopTimer = clock.every(1000 / (t.sim.stepsPerSecond * multiplier), () => {
      count(t);
      const n = Math.min(Math.floor(owed + 1e-9), MAX_CATCH_UP);
      owed = n === MAX_CATCH_UP ? 0 : owed - n;
      for (let i = 0; i < n; i++) if (!stepOnce(w, t)) break;
    });
  }

  /**
   * While the world runs, a player's command steps at once and not at the next timer call, so its
   * answer comes one step sooner. The step is taken from the steps owed (down to -1), so the
   * pace stays the same: the timer skips the step that it would have taken.
   */
  function stepEarly(w: World, t: Tuning): void {
    if (!stopTimer) return;
    count(t);
    if (owed < 0) return;
    owed -= 1;
    stepOnce(w, t);
  }

  /**
   * The world at `tick`, clamped to [first world, `live`]: the latest kept copy at or before it,
   * cloned and stepped with the accepted lists. `live` and the kept copies do not change. `kept`
   * is never empty once a world exists, so the fallbacks only satisfy the types.
   */
  function rewound(tick: number, live: World, t: Tuning): { tick: number; lite: WorldLite } {
    const target = Math.min(Math.max(tick, kept[0]?.tick ?? live.tick), live.tick);
    const base = kept.findLast((k) => k.tick <= target) ?? live;
    const w = structuredClone(base);
    while (w.tick < target) {
      const at = w.tick;
      const list = accepted.filter((e) => e.tick === at).flatMap((e) => e.list);
      step(w, list, t);
    }
    return { tick: w.tick, lite: toLite(w, t) };
  }

  function handle(m: ToWorker): void {
    if (m.t === 'init') {
      tuning = parseTuning(m.tuning);
      world = m.checkpoint ?? createWorld(m.seed, tuning, m.scenario);
      kept = [structuredClone(world)];
      accepted = [];
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
        accepted.push({ tick: world.tick, list: m.list });
        post({ t: 'accepted', tick: world.tick, list: m.list });
        stepEarly(world, tuning);
        return;
      case 'hash':
        post({ t: 'hash', tick: world.tick, value: hashWorld(world) });
        return;
      case 'checkpoint':
        post({
          t: 'checkpoint',
          tick: world.tick,
          world: structuredClone(world),
          ...(m.id === undefined ? {} : { id: m.id }),
        });
        return;
      case 'advance':
        for (let i = 0; i < m.ticks; i++) if (!stepOnce(world, tuning)) break;
        return;
      case 'rewind':
        post({ t: 'rewound', id: m.id, ...rewound(m.tick, world, tuning) });
        return;
      case 'fastForward': {
        const script = Array.isArray(m.script) ? m.script : []; // it crosses the worker boundary
        const steps: ForwardStep[] | null = m.report === true ? [] : null;
        for (let i = 0; i < m.ticks; i++) {
          const at = world.tick;
          const season = world.season;
          for (const e of script) {
            if (e.tick !== at || !Array.isArray(e.list)) continue;
            pending.push(...e.list);
            accepted.push({ tick: at, list: e.list });
          }
          const events = stepOnce(world, tuning, true);
          if (!events) return;
          const shown = i === 0 || world.season !== season;
          if (steps && (shown || events.length > 0))
            steps.push({ tick: at, events, ...(shown ? { lite: toLite(world, tuning) } : {}) });
        }
        post({
          t: 'forwarded',
          id: m.id,
          tick: world.tick,
          lite: toLite(world, tuning),
          ...(steps ? { steps } : {}),
        });
        return;
      }
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
