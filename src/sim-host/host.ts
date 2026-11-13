// The main-thread side of the worker (ADR 0009 items 1 and 5): the accepted log, the last
// checkpoint, and restart with replay.
import type { Command, World } from '../sim/types.ts';
import type { FromWorker, SimPort, ToWorker, WorldLite } from './protocol.ts';

export interface SimHost extends SimPort {
  /** Sends any message. `init` starts a new run; `commands` is the same as `send`. */
  post(m: ToWorker): void;
  /** Starts a new worker from the last checkpoint and replays every accepted list after it. */
  restart(): void;
  /** Asks the worker for its world now; the answer is a structured clone. A daily checkpoint never answers it. */
  requestCheckpoint(): Promise<{ tick: number; world: World }>;
  /**
   * The world at an earlier tick, clamped to what the worker kept (ADR 0012 item 10). Rejects
   * when the worker fails or restarts first.
   */
  rewind(tick: number): Promise<{ tick: number; lite: WorldLite }>;
  log(): readonly { tick: number; list: Command[] }[];
}

type Endpoint = Worker | MessagePort;
type Init = Extract<ToWorker, { t: 'init' }>;

/**
 * Wraps a worker. On an `error` message or a worker `error` event it restarts by itself, unless
 * the failed worker got no further than the one before it (a fault that replay repeats).
 */
export function createSimHost(spawn: () => Endpoint): SimHost {
  const listeners = new Set<(m: FromWorker) => void>();
  let hashWaiters: { resolve(h: { tick: number; value: string }): void; reject(e: Error): void }[] = [];
  let checkpointWaiters: {
    id: number;
    resolve(c: { tick: number; world: World }): void;
    reject(e: Error): void;
  }[] = [];
  let nextCheckpointId = 1;
  let rewindWaiters = new Map<
    number,
    { resolve(r: { tick: number; lite: WorldLite }): void; reject(e: Error): void }
  >();
  let nextRewindId = 1;
  let log: { tick: number; list: Command[] }[] = [];
  /** Lists sent but not yet accepted, with the tick they are expected to run at. */
  let inFlight: { tick: number; list: Command[] }[] = [];
  let init: Init | null = null;
  let checkpoint: { tick: number; world: World } | null = null;
  let multiplier = 0;
  /** The last ticks listeners saw a snapshot and events for; the tick the sent advances reach. */
  let seenTick = 0;
  let seenEventsTick = -1;
  let targetTick = 0;
  /** Replayed lists whose `accepted` the new worker will post again. */
  let skipAccepted = 0;
  let lastFailure = -Infinity;
  /** Set once the host gives up restarting; new hash requests reject with it until init or restart. */
  let gaveUp: string | null = null;
  let worker: Endpoint | null = null;

  /** Rejects every pending hash request, so no caller waits on a worker that will not answer. */
  function rejectHashes(reason: string): void {
    const waiters = hashWaiters;
    hashWaiters = [];
    for (const h of waiters) h.reject(new Error(reason));
    const cps = checkpointWaiters;
    checkpointWaiters = [];
    for (const c of cps) c.reject(new Error(reason));
    rejectRewinds(reason);
  }

  /** A restarted worker does not know the old requests, so rewinds reject instead of resending. */
  function rejectRewinds(reason: string): void {
    const waiters = rewindWaiters;
    rewindWaiters = new Map();
    for (const r of waiters.values()) r.reject(new Error(reason));
  }

  function onFailure(lastGoodTick: number): void {
    if (lastGoodTick <= lastFailure) {
      gaveUp = `the worker failed again at tick ${String(lastGoodTick)}; not restarting`;
      rejectHashes(gaveUp);
      return;
    }
    lastFailure = lastGoodTick;
    restart();
  }

  function receive(m: FromWorker): void {
    switch (m.t) {
      case 'accepted':
        if (skipAccepted > 0) {
          skipAccepted -= 1;
          return;
        }
        inFlight.shift();
        log.push({ tick: m.tick, list: m.list });
        break;
      case 'snapshot':
        if (m.tick <= seenTick) return; // a replayed step the listeners already saw
        seenTick = m.tick;
        targetTick = Math.max(targetTick, m.tick);
        break;
      case 'events':
        if (m.tick <= seenEventsTick) return;
        seenEventsTick = m.tick;
        break;
      case 'checkpoint':
        if (m.id !== undefined) {
          const i = checkpointWaiters.findIndex((c) => c.id === m.id);
          if (i >= 0) checkpointWaiters.splice(i, 1)[0]?.resolve({ tick: m.tick, world: m.world });
        }
        if (checkpoint && m.tick <= checkpoint.tick) return;
        checkpoint = { tick: m.tick, world: m.world };
        break;
      case 'hash':
        hashWaiters.shift()?.resolve({ tick: m.tick, value: m.value });
        return;
      case 'rewound':
        rewindWaiters.get(m.id)?.resolve({ tick: m.tick, lite: m.lite });
        rewindWaiters.delete(m.id);
        return;
      case 'error':
        for (const cb of listeners) cb(m);
        onFailure(m.lastGoodTick);
        return;
    }
    for (const cb of listeners) cb(m);
  }

  function connect(): Endpoint {
    const w = spawn();
    w.addEventListener('message', (e: Event) => {
      if (w === worker) receive((e as MessageEvent<FromWorker>).data);
    });
    w.addEventListener('error', () => {
      if (w === worker) onFailure(seenTick);
    });
    if ('start' in w) w.start();
    return w;
  }

  function disconnect(): void {
    if (!worker) return;
    if ('terminate' in worker) worker.terminate();
    else worker.close();
    worker = null;
  }

  function restart(): void {
    if (!init) return;
    gaveUp = null;
    rejectRewinds('the worker restarted before answering the rewind');
    disconnect();
    worker = connect();
    const w = worker;
    const from = checkpoint?.tick ?? 0;
    w.postMessage(checkpoint ? { ...init, checkpoint: checkpoint.world } : init);
    const replay = log.filter((e) => e.tick >= from);
    skipAccepted = replay.length;
    let at = from;
    for (const e of [...replay, ...inFlight]) {
      if (e.tick > at) w.postMessage({ t: 'advance', ticks: e.tick - at } satisfies ToWorker);
      at = Math.max(at, e.tick);
      w.postMessage({ t: 'commands', list: e.list } satisfies ToWorker);
    }
    if (targetTick > at) w.postMessage({ t: 'advance', ticks: targetTick - at } satisfies ToWorker);
    for (let i = 0; i < hashWaiters.length; i++) w.postMessage({ t: 'hash' } satisfies ToWorker);
    for (const c of checkpointWaiters) w.postMessage({ t: 'checkpoint', id: c.id } satisfies ToWorker);
    if (multiplier > 0) w.postMessage({ t: 'speed', multiplier } satisfies ToWorker);
  }

  function post(m: ToWorker): void {
    switch (m.t) {
      case 'init': {
        const { checkpoint: cp, ...rest } = m;
        init = rest;
        checkpoint = cp ? { tick: cp.tick, world: cp } : null;
        log = [];
        inFlight = [];
        seenTick = targetTick = cp?.tick ?? 0;
        seenEventsTick = seenTick - 1;
        lastFailure = -Infinity;
        gaveUp = null;
        multiplier = 0;
        skipAccepted = 0;
        rejectHashes('a new init replaced the run');
        disconnect();
        worker = connect();
        break;
      }
      case 'commands':
        inFlight.push({ tick: targetTick, list: m.list });
        break;
      case 'speed':
        multiplier = m.multiplier;
        break;
      case 'advance':
        targetTick += m.ticks;
        break;
      case 'hash':
      case 'checkpoint':
      case 'rewind':
        break;
    }
    worker?.postMessage(m);
  }

  return {
    post,
    send(list) {
      post({ t: 'commands', list });
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    speed(multiplier) {
      post({ t: 'speed', multiplier });
    },
    requestHash() {
      return new Promise((resolve, reject) => {
        if (gaveUp !== null) {
          reject(new Error(gaveUp));
          return;
        }
        hashWaiters.push({ resolve, reject });
        worker?.postMessage({ t: 'hash' } satisfies ToWorker);
      });
    },
    requestCheckpoint() {
      return new Promise((resolve, reject) => {
        if (gaveUp !== null) {
          reject(new Error(gaveUp));
          return;
        }
        const id = nextCheckpointId++;
        checkpointWaiters.push({ id, resolve, reject });
        worker?.postMessage({ t: 'checkpoint', id } satisfies ToWorker);
      });
    },
    rewind(tick) {
      return new Promise((resolve, reject) => {
        if (gaveUp !== null) {
          reject(new Error(gaveUp));
          return;
        }
        const id = nextRewindId++;
        rewindWaiters.set(id, { resolve, reject });
        worker?.postMessage({ t: 'rewind', tick, id } satisfies ToWorker);
      });
    },
    restart,
    log: () => log.map((e) => ({ tick: e.tick, list: [...e.list] })),
  };
}
