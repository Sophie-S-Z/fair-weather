import { afterEach, expect, test } from 'vitest';
import golden from '../../golden/m0-hash.json';
import type { FromWorker, ToWorker } from '../../../src/sim-host/protocol.ts';
import { createSimHost } from '../../../src/sim-host/host.ts';
import type { SimHost } from '../../../src/sim-host/host.ts';
import type { Endpoint } from './harness.ts';
import { coreOverChannel, goldenLists, playGolden } from './harness.ts';

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

test(
  'host restart from checkpoint plus replay gives the same hash as an unbroken run',
  { timeout: 60_000 },
  async () => {
    const good = spawner(() => null);
    const unbroken = createSimHost(good.spawn);
    play(unbroken, golden.ticks);
    const want = await unbroken.requestHash();
    expect(want).toEqual({ tick: golden.ticks, value: golden.hash });

    const faulty = spawner((n) => (n === 0 ? 1700 : null));
    const host = createSimHost(faulty.spawn);
    const seen: FromWorker[] = [];
    host.onMessage((m) => seen.push(m));
    play(host, golden.ticks);
    const got = await host.requestHash();

    expect(got).toEqual(want);
    expect(faulty.spawned).toHaveLength(2);
    const reinit = faulty.spawned[1]?.received[0];
    expect(reinit?.t).toBe('init');
    expect(reinit?.t === 'init' ? reinit.checkpoint?.tick : null).toBe(1600);
    // The log has each golden list once, at its tick, as in the unbroken run.
    expect(host.log()).toEqual(unbroken.log());
    expect(host.log()).toEqual(goldenLists());
    // Listeners see the error, and each snapshot tick once, in order: 1700 comes from the replay.
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
  await twoErrors;
  await new Promise((r) => setTimeout(r, 20));
  expect(s.spawned.length).toBe(2);
});
