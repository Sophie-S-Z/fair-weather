// The main-thread side of the worker (ADR 0009 items 1 and 5): the accepted log, the last
// checkpoint, and restart with replay.
import type { Command, World } from '../sim/types.ts';
import type { ForwardStep, FromWorker, SimPort, ToWorker, WorldLite } from './protocol.ts';

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
  /**
   * Steps `ticks` ticks silently and gives the world after them (ADR 0013 item 10), each `script`
   * list run at its tick. Once it answers, `log()` holds the script's lists in tick order, so a
   * restart replays them. Rejects, and the run and the log stay where they were, when the worker
   * fails or restarts first. Commands sent after a rejected forward replay at the tick before it.
   * With `report`, it also gives the forward's steps (ForwardStep).
   */
  fastForward(
    ticks: number,
    script?: readonly { tick: number; list: Command[] }[],
    report?: boolean,
  ): Promise<{ tick: number; lite: WorldLite; steps?: ForwardStep[] }>;
  log(): readonly { tick: number; list: Command[] }[];
  /** Calls `cb` each time the host stops restarting the worker; returns an unsubscribe. */
  onGiveUp(cb: (reason: string) => void): () => void;
}

export interface HostOptions {
  /**
   * The waits before each new try after a worker fails to load (ADR 0014 item 11); after the
   * last, the host gives up. Default `[]`: one try.
   */
  loadWaitsMs?: readonly number[];
  /** Resolves after `ms`; default `setTimeout`. */
  wait?: (ms: number) => Promise<void>;
}

type Endpoint = Worker | MessagePort;
type Init = Extract<ToWorker, { t: 'init' }>;

/**
 * Wraps a worker. On an `error` message or a worker `error` event it restarts by itself, unless
 * the failed worker got no further than the one before it (a fault that replay repeats). A worker
 * whose spawn throws, or that fires `error` before its first message, failed to load: the host
 * spawns again after each of `loadWaitsMs`, then gives up.
 */
export function createSimHost(spawn: () => Endpoint, opts: HostOptions = {}): SimHost {
  const loadWaitsMs = opts.loadWaitsMs ?? [];
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const listeners = new Set<(m: FromWorker) => void>();
  const giveUpListeners = new Set<(reason: string) => void>();
  let hashWaiters: { resolve(h: { tick: number; value: string }): void; reject(e: Error): void }[] = [];
  let checkpointWaiters: {
    id: number;
    resolve(c: { tick: number; world: World }): void;
    reject(e: Error): void;
  }[] = [];
  let nextCheckpointId = 1;
  /**
   * Rewinds and fast-forwards waiting for their answer, by id, with the ticks each moves the run
   * and a forward's script (a copy only the waiter holds).
   */
  let liteWaiters = new Map<
    number,
    {
      ticks: number;
      script: { tick: number; list: Command[] }[] | undefined;
      resolve(r: { tick: number; lite: WorldLite; steps?: ForwardStep[] }): void;
      reject(e: Error): void;
    }
  >();
  let nextLiteId = 1;
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
  /** Failed loads since the last worker that posted a message, or since init. */
  let failedLoads = 0;
  /** Counts spawns, so a wait to retry a load does nothing once another spawn replaced it. */
  let spawns = 0;

  /** Rejects every pending hash request, so no caller waits on a worker that will not answer. */
  function rejectHashes(reason: string): void {
    const waiters = hashWaiters;
    hashWaiters = [];
    for (const h of waiters) h.reject(new Error(reason));
    const cps = checkpointWaiters;
    checkpointWaiters = [];
    for (const c of cps) c.reject(new Error(reason));
    rejectLites(reason);
  }

  /**
   * A restarted worker does not know the old requests, so rewinds and fast-forwards reject instead
   * of resending.
   */
  function rejectLites(reason: string): void {
    const waiters = liteWaiters;
    liteWaiters = new Map();
    for (const r of waiters.values()) r.reject(new Error(reason));
  }

  /** Stops restarting: every pending and new request rejects with `reason` until init or restart. */
  function giveUp(reason: string): void {
    if (gaveUp !== null) return; // already stopped; nothing is waiting
    gaveUp = reason;
    rejectHashes(reason);
    for (const cb of giveUpListeners) cb(reason);
  }

  function onFailure(lastGoodTick: number): void {
    if (lastGoodTick <= lastFailure) {
      giveUp(`the worker failed again at tick ${String(lastGoodTick)}; not restarting`);
      return;
    }
    lastFailure = lastGoodTick;
    restart();
  }

  /** A worker that never posted a message: spawn again after the next wait, or give up. */
  function onLoadFailure(): void {
    disconnect();
    const ms = loadWaitsMs[failedLoads];
    if (ms === undefined) {
      giveUp('the worker failed to load on every try; not restarting');
      return;
    }
    failedLoads += 1;
    const at = spawns;
    void wait(ms).then(
      () => {
        if (at === spawns) restart();
      },
      () => {
        if (at === spawns) giveUp('the wait to load the worker again failed; not restarting');
      },
    );
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
      case 'forwarded': {
        // Listeners never see the forwarded ticks, and a restart replays them silently. The lists
        // still in flight were sent after the forward, so they run after it. The script's lists
        // ran in the forwarded ticks, so the log holds them there, in tick order.
        const forward = liteWaiters.get(m.id);
        seenTick = Math.max(seenTick, m.tick);
        seenEventsTick = Math.max(seenEventsTick, m.tick - 1);
        if (forward) {
          targetTick += forward.ticks;
          const from = m.tick - forward.ticks;
          // The core runs a list only at a whole tick it steps through.
          const ran = (forward.script ?? []).filter(
            (e) => Number.isInteger(e.tick) && e.tick >= from && e.tick < m.tick,
          );
          log.push(...ran.sort((a, b) => a.tick - b.tick));
        }
        for (const e of inFlight) e.tick = Math.max(e.tick, m.tick);
      }
      // falls through
      case 'rewound':
        liteWaiters.get(m.id)?.resolve({
          tick: m.tick,
          lite: m.lite,
          ...(m.t === 'forwarded' && m.steps ? { steps: m.steps } : {}),
        });
        liteWaiters.delete(m.id);
        return;
      case 'error':
        for (const cb of listeners) cb(m);
        onFailure(m.lastGoodTick);
        return;
    }
    for (const cb of listeners) cb(m);
  }

  /** Spawns a worker, or returns null after a spawn that throws (a failed load). */
  function connect(): Endpoint | null {
    spawns += 1;
    let w: Endpoint;
    try {
      w = spawn();
    } catch {
      onLoadFailure();
      return null;
    }
    let loaded = false;
    w.addEventListener('message', (e: Event) => {
      if (w !== worker) return;
      loaded = true;
      failedLoads = 0;
      receive((e as MessageEvent<FromWorker>).data);
    });
    w.addEventListener('error', () => {
      if (w !== worker) return;
      if (loaded) onFailure(seenTick);
      else onLoadFailure();
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
    rejectLites('the worker restarted before answering');
    disconnect();
    worker = connect();
    const w = worker;
    if (!w) return;
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

  /**
   * Sends a request answered by a world-lite, under a new id; `ticks` is how far it moves the run,
   * and `script` the lists a forward runs.
   */
  function askLite(
    make: (id: number) => ToWorker,
    ticks = 0,
    script?: { tick: number; list: Command[] }[],
  ): Promise<{ tick: number; lite: WorldLite; steps?: ForwardStep[] }> {
    return new Promise((resolve, reject) => {
      if (gaveUp !== null) {
        reject(new Error(gaveUp));
        return;
      }
      const id = nextLiteId++;
      liteWaiters.set(id, { ticks, script, resolve, reject });
      worker?.postMessage(make(id));
    });
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
        failedLoads = 0;
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
      case 'fastForward':
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
      return askLite((id) => ({ t: 'rewind', tick, id }));
    },
    fastForward(ticks, script, report = false) {
      const lists = script?.map((e) => ({ tick: e.tick, list: [...e.list] }));
      return askLite(
        (id) => ({
          t: 'fastForward',
          ticks,
          id,
          ...(lists ? { script: lists } : {}),
          ...(report ? { report: true as const } : {}),
        }),
        ticks,
        lists,
      );
    },
    restart,
    log: () => log.map((e) => ({ tick: e.tick, list: [...e.list] })),
    onGiveUp(cb) {
      giveUpListeners.add(cb);
      return () => giveUpListeners.delete(cb);
    },
  };
}
