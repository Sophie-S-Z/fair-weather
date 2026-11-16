import { afterEach, expect, test } from 'vitest';
import golden from '../../golden/m0-hash.json';
import type { FromWorker, ToWorker } from '../../../src/sim-host/protocol.ts';
import type { Command } from '../../../src/sim/types.ts';
import { createSimHost } from '../../../src/sim-host/host.ts';
import type { SimHost } from '../../../src/sim-host/host.ts';
import type { Endpoint } from './harness.ts';
import { coreOverChannel, goldenLists, initGolden, playGolden } from './harness.ts';

const open: Endpoint[] = [];
afterEach(() => {
  for (const e of open.splice(0)) e.close();
});

/** A spawn function over MessageChannels. `faultAt(n)` says at which tick spawn n dies, if any. */
function spawner(faultAt: (n: number) => number | null): { spawn: () => MessagePort; spawned: Endpoint[] } {
  const spawned: Endpoint[] = [];
  const spawn = (): MessagePort => {
    const at = faultAt(spawned.length);
    let dead = false;
    const ep = coreOverChannel({ dev: true }, (m: FromWorker, post) => {
      if (dead) return;
      if (at !== null && m.t === 'snapshot' && m.tick === at) {
        dead = true; // the worker stops answering, as a crashed one would
        post({ t: 'error', message: 'injected fault', lastGoodTick: at - 1 });
        return;
      }
      post(m);
    });
    spawned.push(ep);
    open.push(ep);
    return ep.port;
  };
  return { spawn, spawned };
}

function play(host: SimHost, ticks: number): void {
  playGolden((m: ToWorker) => {
    host.post(m);
  }, ticks);
}

// Fault 1700: restart from 1600, no accepted list in [1600, 1700), the later lists are in flight.
// Fault 3300: restart from 3200 replays the accepted list at the boundary tick 3200.
test.each([
  { fault: 1700, from: 1600, replayed: 0 },
  { fault: 3300, from: 3200, replayed: 1 },
])(
  'host restart from checkpoint plus replay gives the same hash as an unbroken run (fault at $fault)',
  { timeout: 60_000 },
  async ({ fault, from, replayed }) => {
    const good = spawner(() => null);
    const unbroken = createSimHost(good.spawn);
    play(unbroken, golden.ticks);
    const want = await unbroken.requestHash();
    expect(want).toEqual({ tick: golden.ticks, value: golden.hash });

    const faulty = spawner((n) => (n === 0 ? fault : null));
    const host = createSimHost(faulty.spawn);
    const seen: FromWorker[] = [];
    host.onMessage((m) => seen.push(m));
    play(host, golden.ticks);
    const got = await host.requestHash();

    expect(got).toEqual(want);
    expect(faulty.spawned).toHaveLength(2);
    const second = faulty.spawned[1]?.received ?? [];
    const reinit = second[0];
    expect(reinit?.t === 'init' ? reinit.checkpoint?.tick : null).toBe(from);
    // Accepted lists at or after the checkpoint are replayed, then the in-flight ones are re-sent.
    const lists = goldenLists();
    expect(lists.filter((e) => e.tick >= from && e.tick < fault)).toHaveLength(replayed);
    const sentLists = second.flatMap((m) => (m.t === 'commands' ? [m.list] : []));
    expect(sentLists).toEqual(lists.filter((e) => e.tick >= from).map((e) => e.list));
    // The log has each golden list once, at its tick, as in the unbroken run.
    expect(host.log()).toEqual(unbroken.log());
    expect(host.log()).toEqual(lists);
    // Listeners see the error, and each snapshot and events tick once, in order.
    expect(seen.filter((m) => m.t === 'error')).toHaveLength(1);
    const ticks = seen.flatMap((m) => (m.t === 'snapshot' ? [m.tick] : []));
    expect(ticks).toEqual(Array.from({ length: golden.ticks }, (_, i) => i + 1));
    const eventTicks = seen.flatMap((m) => (m.t === 'events' ? [m.tick] : []));
    expect(eventTicks).toEqual(Array.from({ length: golden.ticks }, (_, i) => i));
  },
);

test('host restarts on a worker error event and comes back to the same tick and hash', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  play(host, 500);
  const before = await host.requestHash();
  s.spawned[0]?.port.dispatchEvent(new Event('error'));
  const after = await host.requestHash();
  expect(s.spawned).toHaveLength(2);
  expect(after).toEqual(before);
});

test('host does not restart again when the new worker fails no later than the last one', async () => {
  const s = spawner(() => 50); // every worker fails at the same tick
  const host = createSimHost(s.spawn);
  const twoErrors = new Promise<void>((resolve) => {
    let n = 0;
    host.onMessage((m) => {
      if (m.t === 'error' && ++n === 2) resolve();
    });
  });
  play(host, 100);
  const hash = host.requestHash();
  await twoErrors;
  await expect(hash).rejects.toThrow(/not restarting/);
  await new Promise((r) => setTimeout(r, 20));
  expect(s.spawned.length).toBe(2);
  // Once the host has given up, a new hash request rejects at once instead of waiting forever.
  await expect(host.requestHash()).rejects.toThrow(/not restarting/);
});

test('init resets speed and pending hash requests, and log returns a copy', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  play(host, 300);
  host.post({ t: 'speed', multiplier: 1 });
  const stale = host.requestHash();
  play(host, 10); // a new init
  await expect(stale).rejects.toThrow(/new init/);
  // The new run starts paused: a restart sends no speed.
  host.restart();
  expect(s.spawned[2]?.received.some((m) => m.t === 'speed')).toBe(false);
  const fresh = await host.requestHash();
  expect(fresh.tick).toBe(10);
  const log = host.log() as { tick: number; list: unknown[] }[];
  log.length = 0;
  expect(host.log()).toEqual(goldenLists().filter((e) => e.tick < 10));
});

test('a pending checkpoint request is sent again to the restarted worker', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  host.post(initGolden);
  await host.requestHash(); // the worker has loaded
  const pending = host.requestCheckpoint();
  s.spawned[0]?.port.dispatchEvent(new Event('error'));
  const cp = await pending;
  expect(s.spawned).toHaveLength(2);
  expect(cp.tick).toBe(0);
});

test('requestCheckpoint resolves with its own answer, not a daily checkpoint that arrives first', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  host.post(initGolden);
  const port = s.spawned[0]?.port;
  // A dusk checkpoint (no id) reaches the host before the requested one.
  const pending = host.requestCheckpoint();
  port?.dispatchEvent(
    new MessageEvent('message', { data: { t: 'checkpoint', tick: 999, world: { tick: 999 } } }),
  );
  const cp = await pending;
  expect(cp.tick).toBe(0);
});

test('requestCheckpoint resolves with the world now', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  host.post(initGolden);
  host.post({ t: 'advance', ticks: 4 });
  const cp = await host.requestCheckpoint();
  expect(cp.tick).toBe(4);
  expect(cp.world.tick).toBe(4);
});

test('host.rewind rejects when the worker errors before answering', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  play(host, 30);
  await host.requestHash(); // the worker has loaded
  const pending = host.rewind(10);
  s.spawned[0]?.port.dispatchEvent(new Event('error'));
  await expect(pending).rejects.toThrow(/restarted/);
  // The restarted worker answers a new request.
  await expect(host.rewind(10)).resolves.toMatchObject({ tick: 10 });
});

test('host.fastForward resolves with the forwarded world, and rejects on a restart', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  const seen: FromWorker[] = [];
  host.onMessage((m) => seen.push(m));
  host.post(initGolden);
  await host.requestHash(); // the worker has loaded
  const pending = host.fastForward(100);
  s.spawned[0]?.port.dispatchEvent(new Event('error'));
  await expect(pending).rejects.toThrow(/restarted/);
  const done = await host.fastForward(100);
  expect(done.tick).toBe(100);
  expect(done.lite.creatures).toHaveLength(
    initGolden.t === 'init' ? initGolden.scenario.creatures.length : 0,
  );
  // Listeners see nothing of the forwarded ticks, and a restart replays them silently.
  const plain = createSimHost(spawner(() => null).spawn);
  plain.post(initGolden);
  plain.post({ t: 'advance', ticks: 100 });
  const want = await plain.requestHash();
  s.spawned[1]?.port.dispatchEvent(new Event('error'));
  expect(await host.requestHash()).toEqual(want);
  expect(s.spawned).toHaveLength(3);
  expect(seen.filter((m) => m.t === 'snapshot' || m.t === 'events')).toEqual([]);
});

/**
 * A spawn function whose first worker, after its first `forwarded`, answers the next `accepted`
 * with an error instead and then goes quiet, so the host restarts between the two.
 */
function failAfterForward(): { spawn: () => MessagePort; spawned: Endpoint[] } {
  const spawned: Endpoint[] = [];
  const spawn = (): MessagePort => {
    const first = spawned.length === 0;
    let forwarded = false;
    let dead = false;
    const ep = coreOverChannel({ dev: true }, (m, post) => {
      if (dead) return;
      if (first && forwarded && m.t === 'accepted') {
        dead = true;
        post({ t: 'error', message: 'injected fault', lastGoodTick: m.tick });
        return;
      }
      if (m.t === 'forwarded') forwarded = true;
      post(m);
    });
    spawned.push(ep);
    open.push(ep);
    return ep.port;
  };
  return { spawn, spawned };
}

test('a restart between forwarded and accepted replays later commands and advances after the forward', async () => {
  const nudge: Command[] = [{ t: 'nudge', dial: 'ear', amount: 0.1 }];
  const plain = createSimHost(spawner(() => null).spawn);
  plain.post(initGolden);
  plain.post({ t: 'advance', ticks: 100 });
  plain.send(nudge);
  plain.post({ t: 'advance', ticks: 5 });
  const want = await plain.requestHash();
  expect(want.tick).toBe(105);

  const s = failAfterForward();
  const host = createSimHost(s.spawn);
  host.post(initGolden);
  const forward = host.fastForward(100);
  host.send(nudge);
  host.post({ t: 'advance', ticks: 5 });
  expect((await forward).tick).toBe(100);
  expect(await host.requestHash()).toEqual(want);
  expect(s.spawned).toHaveLength(2);
  expect(host.log()).toEqual([{ tick: 100, list: nudge }]);
});

test('a rewind and a fastForward in flight at once resolve by id, and one restart rejects both', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  play(host, 30);
  const [back, ahead] = await Promise.all([host.rewind(10), host.fastForward(20)]);
  expect(back.tick).toBe(10);
  expect(ahead.tick).toBe(50);
  const both = [host.rewind(5), host.fastForward(10)];
  s.spawned[0]?.port.dispatchEvent(new Event('error'));
  for (const p of both) await expect(p).rejects.toThrow(/restarted/);
});

const script: { tick: number; list: Command[] }[] = [
  { tick: 150, list: [{ t: 'blow', x: 200, y: 450, dx: 600, dy: 0 }] },
  { tick: 20, list: [{ t: 'shine', x: 400, y: 300 }] },
  { tick: 150, list: [{ t: 'paintFog', x: 1000, y: 500, r: 160, amount: 0.6 }] },
];
/** The script in tick order, as log() holds it. */
const scriptLog = [script[1], script[0], script[2]];

test('after a scripted forward, log() holds the script, and a restart reaches the same hash', async () => {
  const plain = createSimHost(spawner(() => null).spawn);
  plain.post(initGolden);
  let at = 0;
  for (const e of scriptLog) {
    if (!e) continue;
    if (e.tick > at) plain.post({ t: 'advance', ticks: e.tick - at });
    at = e.tick;
    plain.send(e.list);
  }
  plain.post({ t: 'advance', ticks: 200 - at });
  const want = await plain.requestHash();

  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  host.post(initGolden);
  const done = await host.fastForward(200, script);
  expect(done.tick).toBe(200);
  expect(host.log()).toEqual(scriptLog);
  expect(await host.requestHash()).toEqual(want);
  s.spawned[0]?.port.dispatchEvent(new Event('error'));
  expect(await host.requestHash()).toEqual(want);
  expect(s.spawned).toHaveLength(2);
  // The restart replayed the script as commands, and the log still holds each list once.
  const sent = s.spawned[1]?.received.flatMap((m) => (m.t === 'commands' ? [m.list] : [])) ?? [];
  expect(sent).toEqual(scriptLog.map((e) => e?.list));
  expect(host.log()).toEqual(scriptLog);
});

test('an init during a scripted forward rejects it, and the new log holds none of the script', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  host.post(initGolden);
  const forward = host.fastForward(200, script);
  play(host, 10); // a new init, then the golden lists before tick 10
  await expect(forward).rejects.toThrow(/new init/);
  expect((await host.requestHash()).tick).toBe(10);
  await new Promise((r) => setTimeout(r, 20)); // no late answer from the old worker changes the log
  expect(host.log()).toEqual(goldenLists().filter((e) => e.tick < 10));
});

test('a restart during a scripted forward rejects it and leaves the log unchanged', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  play(host, 10);
  const before = await host.requestHash();
  const forward = host.fastForward(200, script);
  s.spawned[0]?.port.dispatchEvent(new Event('error'));
  await expect(forward).rejects.toThrow(/restarted/);
  expect(await host.requestHash()).toEqual(before);
  expect(host.log()).toEqual(goldenLists().filter((e) => e.tick < 10));
});

/**
 * A spawn function whose workers listed in `failing` fail to load: the spawn throws (`'throw'`),
 * or the worker fires an `error` event before it posts anything (`'error'`).
 */
function loader(failing: Record<number, 'throw' | 'error'>): {
  spawn: () => MessagePort;
  spawned: Endpoint[];
  tries: () => number;
} {
  const spawned: Endpoint[] = [];
  let tries = 0;
  const spawn = (): MessagePort => {
    const how = failing[tries++];
    if (how === 'throw') throw new Error('injected load failure');
    const ep = coreOverChannel();
    spawned.push(ep);
    open.push(ep);
    if (how === 'error') {
      queueMicrotask(() => ep.port.dispatchEvent(new Event('error')));
    }
    return ep.port;
  };
  return { spawn, spawned, tries: () => tries };
}

test('a worker that fails before its first message is spawned again after 1000 and 2000 ms, then onGiveUp fires', async () => {
  const s = loader({ 0: 'error', 1: 'throw', 2: 'error' });
  const waits: number[] = [];
  const host = createSimHost(s.spawn, {
    loadWaitsMs: [1000, 2000],
    wait: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  });
  const reasons: string[] = [];
  const gaveUp = new Promise<void>((resolve) => {
    host.onGiveUp((reason) => {
      reasons.push(reason);
      resolve();
    });
  });
  play(host, 30);
  const hash = host.requestHash();
  await gaveUp;
  await expect(hash).rejects.toThrow(/load/);
  await new Promise((r) => setTimeout(r, 20));
  expect(waits).toEqual([1000, 2000]);
  expect(s.tries()).toBe(3);
  expect(reasons).toHaveLength(1);
  await expect(host.requestHash()).rejects.toThrow(/load/);
});

test('a load that works on the second try plays on, and onGiveUp never fires', async () => {
  const s = loader({ 0: 'error' });
  const waits: number[] = [];
  const host = createSimHost(s.spawn, {
    loadWaitsMs: [1000, 2000],
    wait: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
  });
  const reasons: string[] = [];
  host.onGiveUp((reason) => reasons.push(reason));
  play(host, 30);
  const plain = createSimHost(spawner(() => null).spawn);
  play(plain, 30);
  expect(await host.requestHash()).toEqual(await plain.requestHash());
  expect(host.log()).toEqual(goldenLists().filter((e) => e.tick < 30));
  expect(waits).toEqual([1000]);
  expect(s.tries()).toBe(2);
  expect(reasons).toEqual([]);
});

test('onGiveUp fires once when the host gives up on a repeated fault', async () => {
  const s = spawner(() => 50);
  const host = createSimHost(s.spawn);
  const reasons: string[] = [];
  host.onGiveUp((reason) => reasons.push(reason));
  play(host, 100);
  await expect(host.requestHash()).rejects.toThrow(/not restarting/);
  expect(reasons).toEqual([expect.stringMatching(/not restarting/)]);
  // A second error from the worker it gave up on does not stop the host again.
  s.spawned[1]?.port.dispatchEvent(new Event('error'));
  expect(s.spawned).toHaveLength(2);
  expect(reasons).toHaveLength(1);
});

test('a spawn that throws on the first connect is tried again after the wait, and the run plays on', async () => {
  const s = loader({ 0: 'throw' });
  const host = createSimHost(s.spawn, { loadWaitsMs: [1000], wait: () => Promise.resolve() });
  const reasons: string[] = [];
  host.onGiveUp((reason) => reasons.push(reason));
  play(host, 30);
  const plain = createSimHost(spawner(() => null).spawn);
  play(plain, 30);
  expect(await host.requestHash()).toEqual(await plain.requestHash());
  expect(s.tries()).toBe(2);
  expect(reasons).toEqual([]);
});

test('a wait that rejects gives up instead of leaving the host waiting', async () => {
  const s = loader({ 0: 'error' });
  const host = createSimHost(s.spawn, {
    loadWaitsMs: [1000],
    wait: () => Promise.reject(new Error('no timer')),
  });
  const gaveUp = new Promise<string>((resolve) => host.onGiveUp(resolve));
  host.post(initGolden);
  const hash = host.requestHash();
  expect(await gaveUp).toMatch(/not restarting/);
  await expect(hash).rejects.toThrow(/not restarting/);
  expect(s.tries()).toBe(1);
});

test('a script entry whose tick is not a whole number is not logged, as the core does not run it', async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  host.post(initGolden);
  const odd = { tick: 20.5, list: [{ t: 'shine', x: 100, y: 100 }] as Command[] };
  await host.fastForward(200, [...script, odd]);
  expect(host.log()).toEqual(scriptLog);
  const want = await host.requestHash();
  s.spawned[0]?.port.dispatchEvent(new Event('error'));
  expect(await host.requestHash()).toEqual(want);
});

test("a reported fastForward resolves with the worker's steps, and an unreported one with none", async () => {
  const s = spawner(() => null);
  const host = createSimHost(s.spawn);
  const seen: FromWorker[] = [];
  host.onMessage((m) => seen.push(m));
  host.post(initGolden);
  const plain = await host.fastForward(50);
  expect(plain.steps).toBeUndefined();
  const done = await host.fastForward(50, undefined, true);
  expect(done.tick).toBe(100);
  // Its first step is tick 50, with the world after it; every other step has events.
  expect(done.steps?.[0]?.tick).toBe(50);
  expect(done.steps?.[0]?.lite?.creatures).toHaveLength(plain.lite.creatures.length);
  expect(done.steps?.slice(1).every((st) => st.lite === undefined && st.events.length > 0)).toBe(true);
  expect(seen).toEqual([]);
});
