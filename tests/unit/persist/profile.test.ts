import { IDBFactory } from 'fake-indexeddb';
import { expect, test } from 'vitest';
import type { MythPage } from '../../../src/myth/grammar.ts';
import { openDb } from '../../../src/persist/db.ts';
import { createProfile } from '../../../src/persist/profile.ts';
import { createSlots } from '../../../src/persist/slots.ts';

const page = (narrator: string): MythPage => ({
  narrator,
  verses: [
    { title: 'The Waking', text: `${narrator} woke.`, note: null },
    { title: "The Sky's Eye", text: 'The sky looked.', note: 'You shone the light.' },
  ],
});

test('keepMyth numbers pages from year 1; pages survive a new profile on the same database', async () => {
  const factory = new IDBFactory();
  const profile = await createProfile(factory);
  expect(await profile.pages()).toEqual([]);
  expect(await profile.keepMyth(page('pim'), 1)).toEqual({ ...page('pim'), year: 1, seed: 1 });
  expect((await profile.keepMyth(page('krit'), 7)).year).toBe(2);

  const again = await createProfile(factory);
  expect(await again.pages()).toEqual([
    { ...page('pim'), year: 1, seed: 1 },
    { ...page('krit'), year: 2, seed: 7 },
  ]);
  expect((await again.keepMyth(page('echo'), 1)).year).toBe(3);
});

test('feathers count up and are kept; the save slots do not see the profile', async () => {
  const factory = new IDBFactory();
  const profile = await createProfile(factory);
  expect(await profile.feathers()).toBe(0);
  expect(await profile.addFeather()).toBe(1);
  expect(await profile.addFeather()).toBe(2);
  expect(await (await createProfile(factory)).feathers()).toBe(2);
  const slots = await createSlots(factory);
  expect(await slots.list()).toEqual([]);
  expect(await slots.hasAuto()).toBe(false);
});

test('blocked storage gives an in-memory profile', async () => {
  const throwing = {
    open() {
      throw new Error('SecurityError');
    },
  } as unknown as IDBFactory;
  const profile = await createProfile(throwing);
  expect((await profile.keepMyth(page('pim'), 1)).year).toBe(1);
  expect(await profile.addFeather()).toBe(1);
  expect(await profile.pages()).toHaveLength(1);
  expect(await profile.feathers()).toBe(1);
});

test('a damaged profile reads as empty, and the next write replaces it', async () => {
  const factory = new IDBFactory();
  await (await openDb(factory)).putAll([['profile', { pages: 'garbage' }]]);
  const profile = await createProfile(factory);
  expect(await profile.pages()).toEqual([]);
  expect((await profile.keepMyth(page('pim'), 1)).year).toBe(1);
  expect(await (await createProfile(factory)).pages()).toHaveLength(1);
});
