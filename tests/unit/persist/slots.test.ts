import { IDBFactory } from 'fake-indexeddb';
import { expect, test, vi } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import scenarioJson from '../../../content/scenarios/m0.json';
import flagsJson from '../../../content/flags.json';
import { openDb } from '../../../src/persist/db.ts';
import { hashTuning } from '../../../src/persist/format.ts';
import type { SaveV1 } from '../../../src/persist/format.ts';
import { migrate } from '../../../src/persist/migrations.ts';
import { createSlots } from '../../../src/persist/slots.ts';
import { hashWorld } from '../../../src/sim/hash.ts';
import { step } from '../../../src/sim/step.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { Scenario } from '../../../src/sim/types.ts';
import { createWorld } from '../../../src/sim/world.ts';
import { parseFlags } from '../../../src/story/flags.ts';

const tuning = parseTuning(tuningJson);

function makeSave(chapterId: string, ticks = 5): SaveV1 {
  const world = createWorld(7, tuning, scenarioJson as Scenario);
  for (let i = 0; i < ticks; i++) step(world, [], tuning);
  return {
    version: 1,
    seed: 7,
    tuningHash: hashTuning(JSON.stringify(tuningJson)),
    ink: '{}',
    flags: parseFlags(flagsJson),
    chapterId,
    log: [],
    checkpoint: structuredClone(world),
  };
}

test('save then load gives a world with the same hash, and the same next steps', async () => {
  const slots = await createSlots(new IDBFactory());
  const world = createWorld(7, tuning, scenarioJson as Scenario);
  for (let i = 0; i < 20; i++) step(world, [], tuning);
  await slots.save(1, { ...makeSave('ch1'), checkpoint: structuredClone(world) });

  const loaded = (await slots.load(1))?.checkpoint;
  expect(loaded).toBeDefined();
  if (!loaded) return;
  expect(hashWorld(loaded)).toBe(hashWorld(world));
  for (let i = 0; i < 30; i++) {
    step(world, [], tuning);
    step(loaded, [], tuning);
  }
  expect(hashWorld(loaded)).toBe(hashWorld(world));
  expect(await slots.load(0)).toBeNull();
  expect(await slots.list()).toEqual([{ slot: 1, chapterId: 'ch1' }]);
});

test('the autosave keeps the one before it, and a damaged latest falls back to it', async () => {
  const factory = new IDBFactory();
  const slots = await createSlots(factory);
  await slots.save('auto', makeSave('ch0'));
  await slots.save('auto', makeSave('ch1'));
  expect((await slots.load('auto'))?.chapterId).toBe('ch1');

  const db = await openDb(factory);
  await db.putAll([['auto', { ...makeSave('ch2'), version: 99 }]]);
  expect((await slots.load('auto'))?.chapterId).toBe('ch0');

  await db.putAll([['auto', { version: 1, seed: 'not a number' }]]);
  expect((await slots.load('auto'))?.chapterId).toBe('ch0');
});

test('a damaged latest is not kept as the one before the next autosave', async () => {
  const factory = new IDBFactory();
  const slots = await createSlots(factory);
  await slots.save('auto', makeSave('ch0'));
  await slots.save('auto', makeSave('ch1'));
  await (await openDb(factory)).putAll([['auto', 'garbage']]);
  await slots.save('auto', makeSave('ch2'));
  expect((await slots.load('auto'))?.chapterId).toBe('ch2');
  await (await openDb(factory)).putAll([['auto', 'garbage']]);
  expect((await slots.load('auto'))?.chapterId).toBe('ch0');
});

test('blocked storage gives a no-save mode and one notice', async () => {
  const notice = vi.fn();
  const throwing = {
    open() {
      throw new Error('SecurityError');
    },
  } as unknown as IDBFactory;
  const slots = await createSlots(throwing, notice);
  await slots.save('auto', makeSave('ch0'));
  await slots.save(0, makeSave('ch0'));
  expect(await slots.load('auto')).toBeNull();
  expect(await slots.list()).toEqual([]);
  expect(notice).toHaveBeenCalledTimes(1);

  const failing = {
    open() {
      const req: { onerror?: () => void; error: Error } = { error: new Error('blocked') };
      setTimeout(() => req.onerror?.());
      return req;
    },
  } as unknown as IDBFactory;
  const second = vi.fn();
  await createSlots(failing, second);
  expect(second).toHaveBeenCalledTimes(1);
});

test('migrate rejects an unknown version and a damaged save, and accepts version 1', () => {
  expect(() => migrate({ ...makeSave('ch0'), version: 99 })).toThrow(/version 99/);
  expect(() => migrate(null)).toThrow();
  expect(() => migrate({ version: 1 })).toThrow();
  expect(migrate(makeSave('ch0')).chapterId).toBe('ch0');
});

test('a save made under other tuning still loads and is noted', async () => {
  const slots = await createSlots(new IDBFactory());
  await slots.save(2, { ...makeSave('ch0'), tuningHash: hashTuning('{"old":true}') });
  const s = await slots.load(2);
  expect(s?.tuningHash).toBe(hashTuning('{"old":true}'));
});

test('a damaged checkpoint fails migrate and the autosave falls back', async () => {
  const factory = new IDBFactory();
  const slots = await createSlots(factory);
  await slots.save('auto', makeSave('ch0'));
  await slots.save('auto', makeSave('ch1'));
  const bad = makeSave('ch2');
  const broken = structuredClone(bad) as unknown as {
    checkpoint: { creatures: { x: number }[]; fog?: unknown };
  };
  const first = broken.checkpoint.creatures[0];
  if (first) first.x = Number.NaN;
  expect(() => migrate(broken)).toThrow(/Damaged checkpoint/);
  delete broken.checkpoint.fog;
  expect(() => migrate(broken)).toThrow();
  await (await openDb(factory)).putAll([['auto', broken]]);
  expect((await slots.load('auto'))?.chapterId).toBe('ch0');
});

test('hasAuto sees an autosave without loading it', async () => {
  const factory = new IDBFactory();
  const slots = await createSlots(factory);
  expect(await slots.hasAuto()).toBe(false);
  await slots.save('auto', makeSave('ch0'));
  expect(await slots.hasAuto()).toBe(true);
});

test('a blocked open gives no-save mode, and a connection that opens later is closed', async () => {
  const notice = vi.fn();
  const close = vi.fn();
  const req: Record<string, unknown> = {};
  const factory = {
    open() {
      setTimeout(() => {
        (req['onblocked'] as () => void)();
        req['result'] = { close };
        (req['onsuccess'] as () => void)();
      });
      return req;
    },
  } as unknown as IDBFactory;
  const slots = await createSlots(factory, notice);
  expect(notice).toHaveBeenCalledTimes(1);
  expect(await slots.load('auto')).toBeNull();
  expect(close).toHaveBeenCalledTimes(1);
});
