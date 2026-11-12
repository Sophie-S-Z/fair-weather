import { afterEach, expect, test } from 'vitest';
import { hashWorld } from '../../../src/sim/hash.ts';
import { step } from '../../../src/sim/step.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { World } from '../../../src/sim/types.ts';
import { createWorld } from '../../../src/sim/world.ts';
import type { FromWorker, ToWorker } from '../../../src/sim-host/protocol.ts';
import { toLite } from '../../../src/sim-host/lite.ts';
import { createWorkerCore } from '../../../src/sim-host/worker-core.ts';
import { runGolden } from '../../golden/run-golden.ts';
import golden from '../../golden/m0-hash.json';
import tuningJson from '../../../content/tuning.json';
import type { Endpoint } from './harness.ts';
import {
  coreOverChannel,
  goldenLists,
  initGolden,
  manualClock,
  nextMessage,
  playGolden,
  scenario,
} from './harness.ts';

const tuning = parseTuning(tuningJson);
const open: Endpoint[] = [];
afterEach(() => {
  for (const e of open.splice(0)) e.close();
});

/** A core called directly, with every posted message collected in order. */
function directCore(dev = true): {
  send: (m: ToWorker) => void;
  got: FromWorker[];
  clock: ReturnType<typeof manualClock>;
} {
  const got: FromWorker[] = [];
  const clock = manualClock();
  const send = createWorkerCore((m) => got.push(m), clock, { dev });
  return { send, got, clock };
}

function ofType<K extends FromWorker['t']>(got: FromWorker[], t: K): Extract<FromWorker, { t: K }>[] {
  return got.filter((m): m is Extract<FromWorker, { t: K }> => m.t === t);
}

// 4,000 snapshots cross a real MessageChannel here, so this run is slow on small CI runners.
test('commands through the core give the same hash as a direct run', { timeout: 60_000 }, async () => {
  const ep = coreOverChannel();
  open.push(ep);
  const send = (m: ToWorker): void => {
    ep.port.postMessage(m);
  };
  playGolden(send, golden.ticks);
  const reply = nextMessage(ep.port, (m) => m.t === 'hash');
  send({ t: 'hash' });
  const hash = await reply;
  expect(hash).toEqual({ t: 'hash', tick: golden.ticks, value: hashWorld(runGolden()) });
  expect(hash.value).toBe(golden.hash);
});

test('the core stamps each command list with the next tick and replies accepted', () => {
  const { send, got } = directCore();
  send(initGolden);
  const a = [{ t: 'shine' as const, x: 400, y: 300 }];
  const b = [{ t: 'shine' as const, x: 500, y: 300 }];
  send({ t: 'commands', list: a });
  send({ t: 'commands', list: b });
  send({ t: 'advance', ticks: 3 });
  send({ t: 'commands', list: a });
  expect(ofType(got, 'accepted')).toEqual([
    { t: 'accepted', tick: 0, list: a },
    { t: 'accepted', tick: 0, list: b },
    { t: 'accepted', tick: 3, list: a },
  ]);
  // Both lists applied at tick 0, in order: the light ends at b's point.
  const snap = ofType(got, 'snapshot')[0];
  expect(snap?.tick).toBe(1);
  expect(snap?.lite.light).toEqual({ x: 500, y: 300 });
  expect(ofType(got, 'snapshot').map((m) => m.tick)).toEqual([1, 2, 3]);
  expect(ofType(got, 'events').map((m) => m.tick)).toEqual([0, 1, 2]);
});

test('the snapshot holds the world-lite fields only', () => {
  const { send, got } = directCore();
  send(initGolden);
  send({ t: 'advance', ticks: 1 });
  const lite = ofType(got, 'snapshot')[0]?.lite;
  const c = lite?.creatures[0];
  expect(Object.keys(c ?? {}).sort()).toEqual([
    'berries',
    'dancing',
    'dials',
    'gone',
    'id',
    'shell',
    'skyWarmth',
    'state',
    'x',
    'y',
  ]);
  expect(Object.keys(lite ?? {}).sort()).toEqual([
    'bushes',
    'creatures',
    'fog',
    'light',
    'metrics',
    'mushroom',
    'rumor',
    'structures',
    'ties',
    'water',
  ]);
  expect(lite?.fog.cells).toBeInstanceOf(Float32Array);
});

test('the core posts a checkpoint at each dusk', () => {
  const { send, got } = directCore();
  send(initGolden);
  const day = tuning.sim.stepsPerSecond * tuning.story.dayLengthSeconds;
  send({ t: 'advance', ticks: 2 * day + 5 });
  const cps = ofType(got, 'checkpoint');
  expect(cps.map((m) => m.tick)).toEqual([day, 2 * day]);
  // The checkpoint is the world right after dusk, and later steps do not change it.
  const w = createWorld(golden.seed, tuning, scenario);
  for (let i = 0; i < day; i++) step(w, [], tuning);
  expect(hashWorld(cps[0]?.world as World)).toBe(hashWorld(w));
});

test('speed 0 pauses stepping', () => {
  const { send, got, clock } = directCore();
  send(initGolden);
  clock.tick(100);
  expect(ofType(got, 'snapshot')).toHaveLength(0); // a new core starts paused
  send({ t: 'speed', multiplier: 1 });
  clock.tick(1000 / tuning.sim.stepsPerSecond);
  clock.tick(1000 / tuning.sim.stepsPerSecond);
  expect(ofType(got, 'snapshot').map((m) => m.tick)).toEqual([1, 2]);
  send({ t: 'speed', multiplier: 0 });
  expect(clock.timers()).toBe(0);
  clock.tick(1000);
  expect(ofType(got, 'snapshot')).toHaveLength(2);
  send({ t: 'speed', multiplier: 2 });
  clock.tick(1000 / tuning.sim.stepsPerSecond);
  expect(ofType(got, 'snapshot').map((m) => m.tick)).toEqual([1, 2, 3, 4]);
});

test('init resets the speed to 0, so a re-initialized core starts paused', () => {
  const { send, got, clock } = directCore();
  send(initGolden);
  send({ t: 'speed', multiplier: 1 });
  send(initGolden);
  clock.tick(1000);
  expect(ofType(got, 'snapshot')).toHaveLength(0);
  expect(clock.timers()).toBe(0);
});

test('a commands message whose list is not an array is ignored', () => {
  const { send, got } = directCore();
  send(initGolden);
  for (const list of [null, 'ab', { t: 'shine', x: 1, y: 1 }]) {
    send({ t: 'commands', list } as unknown as ToWorker);
  }
  send({ t: 'advance', ticks: 1 });
  expect(ofType(got, 'accepted')).toEqual([]);
  expect(ofType(got, 'error')).toEqual([]);
  expect(ofType(got, 'snapshot')).toHaveLength(1);
});

test('a thrown error posts error with lastGoodTick', () => {
  const { send, got, clock } = directCore();
  const broken = { ...createWorld(golden.seed, tuning, scenario), tick: 7 } as Partial<World>;
  delete broken.fields;
  send({ ...initGolden, checkpoint: broken as World } as ToWorker);
  send({ t: 'speed', multiplier: 1 });
  clock.tick(100);
  const errors = ofType(got, 'error');
  expect(errors).toHaveLength(1);
  expect(errors[0]?.lastGoodTick).toBe(7);
  expect(errors[0]?.message).toMatch(/\S/);
  // Stepping stops.
  clock.tick(100);
  send({ t: 'advance', ticks: 5 });
  expect(ofType(got, 'error')).toHaveLength(1);
  expect(ofType(got, 'snapshot')).toHaveLength(0);
});

test('in development builds an invariant violation posts error and stops; otherwise it does not check', () => {
  const dup = createWorld(golden.seed, tuning, scenario);
  dup.creatures.push(structuredClone(dup.creatures[0] as World['creatures'][number]));
  for (const dev of [true, false]) {
    const { send, got } = directCore(dev);
    send({ ...initGolden, checkpoint: structuredClone(dup) } as ToWorker);
    send({ t: 'advance', ticks: 3 });
    if (dev) {
      expect(ofType(got, 'error')).toEqual([
        { t: 'error', message: expect.stringContaining('duplicate creature id') as unknown, lastGoodTick: 0 },
      ]);
      expect(ofType(got, 'snapshot')).toHaveLength(0);
    } else {
      expect(ofType(got, 'error')).toHaveLength(0);
      expect(ofType(got, 'snapshot')).toHaveLength(3);
    }
  }
});

test('a checkpoint request posts the world now, and the golden hash is unchanged', () => {
  const { send, got } = directCore();
  send(initGolden);
  send({ t: 'advance', ticks: 3 });
  send({ t: 'checkpoint' });
  const [cp] = ofType(got, 'checkpoint');
  expect(cp?.tick).toBe(3);
  expect(cp?.world.tick).toBe(3);
  const fresh = directCore();
  fresh.send({ ...initGolden, checkpoint: cp?.world } as ToWorker);
  fresh.send({ t: 'hash' });
  const direct = createWorld(golden.seed, tuning, scenario);
  for (let i = 0; i < 3; i++) step(direct, [], tuning);
  expect(ofType(fresh.got, 'hash')[0]?.value).toBe(hashWorld(direct));
});

/** Plays the golden run to `ticks` on a direct core, then rewinds to `to` with id 1. */
function rewindAfter(ticks: number, to: number): { send: (m: ToWorker) => void; got: FromWorker[] } {
  const { send, got } = directCore();
  playGolden(send, ticks);
  send({ t: 'rewind', tick: to, id: 1 });
  return { got, send };
}

test.each([1_234, 3_300])('rewound lite at tick %i equals the live snapshot at that tick', (T) => {
  const { got } = rewindAfter(golden.ticks, T);
  const live = ofType(got, 'snapshot').find((m) => m.tick === T);
  expect(ofType(got, 'rewound')).toEqual([{ t: 'rewound', id: 1, tick: T, lite: live?.lite }]);
});

test('rewinding does not change the live hash', () => {
  const { send, got } = directCore();
  playGolden(send, 2_000);
  send({ t: 'hash' });
  send({ t: 'rewind', tick: 1_234, id: 1 });
  send({ t: 'hash' });
  let at = 2_000;
  for (const { tick, list } of goldenLists().filter((e) => e.tick >= at)) {
    send({ t: 'advance', ticks: tick - at });
    send({ t: 'commands', list });
    at = tick;
  }
  send({ t: 'advance', ticks: golden.ticks - at });
  send({ t: 'hash' });
  const [before, after, end] = ofType(got, 'hash');
  expect(after).toEqual(before);
  expect(end).toEqual({ t: 'hash', tick: golden.ticks, value: golden.hash });
});

test('a tick past now gives now; a tick before the first world gives the first world', () => {
  const { send, got } = rewindAfter(300, 10_000);
  send({ t: 'rewind', tick: -5, id: 2 });
  const last = ofType(got, 'snapshot').at(-1);
  expect(ofType(got, 'rewound')).toEqual([
    { t: 'rewound', id: 1, tick: 300, lite: last?.lite },
    { t: 'rewound', id: 2, tick: 0, lite: toLite(createWorld(golden.seed, tuning, scenario), tuning) },
  ]);
});

test('after a restart from a checkpoint, rewinding earlier gives the checkpoint tick', () => {
  const day = tuning.sim.stepsPerSecond * tuning.story.dayLengthSeconds;
  const first = directCore();
  playGolden(first.send, day);
  const [cp] = ofType(first.got, 'checkpoint');
  const { send, got } = directCore();
  send({ ...initGolden, checkpoint: structuredClone(cp?.world) } as ToWorker);
  send({ t: 'advance', ticks: 50 });
  send({ t: 'rewind', tick: 100, id: 7 });
  expect(ofType(got, 'rewound')).toEqual([
    { t: 'rewound', id: 7, tick: day, lite: toLite(cp?.world as World, tuning) },
  ]);
});
