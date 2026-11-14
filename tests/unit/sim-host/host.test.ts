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
