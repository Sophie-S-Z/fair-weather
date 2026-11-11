// Test harness for sim-host: a manual clock, the golden inputs, and a core behind a MessageChannel.
import tuningJson from '../../../content/tuning.json';
import scenarioJson from '../../../content/scenarios/m0.json';
import commandsJson from '../../golden/m0-commands.json';
import golden from '../../golden/m0-hash.json';
import type { FromWorker, ToWorker } from '../../../src/sim-host/protocol.ts';
import { createWorkerCore } from '../../../src/sim-host/worker-core.ts';
import type { CoreOptions } from '../../../src/sim-host/worker-core.ts';
import type { Command, Scenario } from '../../../src/sim/types.ts';

export const scenario = scenarioJson as Scenario;
export const goldenCommands = commandsJson as { tick: number; cmd: Command }[];
export const initGolden: ToWorker = { t: 'init', seed: golden.seed, tuning: tuningJson, scenario };

/** A clock that only moves when the test calls `tick(ms)`, which fires every live timer once. */
export function manualClock(): {
  now(): number;
  every(ms: number, fn: () => void): () => void;
  tick(ms: number): void;
  timers(): number;
} {
  let t = 0;
  const live = new Set<() => void>();
  return {
    now: () => t,
    every(_ms, fn) {
      const entry = (): void => {
        fn();
      };
      live.add(entry);
      return () => live.delete(entry);
    },
    tick(ms) {
      t += ms;
      for (const fn of [...live]) fn();
    },
    timers: () => live.size,
  };
}

/** The golden commands grouped by tick, in file order. */
export function goldenLists(): { tick: number; list: Command[] }[] {
  const out: { tick: number; list: Command[] }[] = [];
  for (const { tick, cmd } of goldenCommands) {
    const last = out[out.length - 1];
    if (last?.tick === tick) last.list.push(cmd);
    else out.push({ tick, list: [cmd] });
  }
  return out;
}

/** Sends `init`, then each golden list at its tick by `advance`, then advances to `ticks`. */
export function playGolden(send: (m: ToWorker) => void, ticks: number): void {
  send(initGolden);
  let at = 0;
  for (const { tick, list } of goldenLists()) {
    if (tick >= ticks) break;
    if (tick > at) send({ t: 'advance', ticks: tick - at });
    at = tick;
    send({ t: 'commands', list });
  }
  if (ticks > at) send({ t: 'advance', ticks: ticks - at });
}

export interface Endpoint {
  port: MessagePort;
  /** Every message the core received, in order. */
  received: ToWorker[];
  close(): void;
}

/**
 * A worker stand-in: a core behind a MessageChannel. Returns the main-thread end. `filter` may
 * rewrite or drop each message the core posts (for fault injection).
 */
export function coreOverChannel(
  opts: CoreOptions = { dev: true },
  filter: (m: FromWorker, post: (m: FromWorker) => void) => void = (m, post) => {
    post(m);
  },
): Endpoint {
  const { port1, port2 } = new MessageChannel();
  const post = (m: FromWorker): void => {
    port2.postMessage(m);
  };
  const core = createWorkerCore(
    (m) => {
      filter(m, post);
    },
    manualClock(),
    opts,
  );
  const received: ToWorker[] = [];
  port2.onmessage = (e: MessageEvent<ToWorker>) => {
    received.push(structuredClone(e.data)); // the core steps the checkpoint it is given
    core(e.data);
  };
  return {
    port: port1,
    received,
    close() {
      port1.close();
      port2.close();
    },
  };
}

/** Resolves with the first message from `port` that matches `pred`. */
export function nextMessage<T extends FromWorker>(
  port: MessagePort,
  pred: (m: FromWorker) => m is T,
): Promise<T> {
  return new Promise((resolve) => {
    const on = (e: MessageEvent<FromWorker>): void => {
      if (pred(e.data)) {
        port.removeEventListener('message', on);
        resolve(e.data);
      }
    };
    port.addEventListener('message', on);
    port.start();
  });
}
