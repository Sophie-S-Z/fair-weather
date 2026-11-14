import { IDBDatabase, IDBFactory } from 'fake-indexeddb';
import { expect, test, vi } from 'vitest';
import type { MythPage } from '../../../src/myth/grammar.ts';
import type { Carry } from '../../../src/story/carry.ts';
import { characters } from '../../../src/story/journey.ts';
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

test('blocked storage gives an in-memory profile and the storage notice once', async () => {
  const notice = vi.fn();
  const throwing = {
    open() {
      throw new Error('SecurityError');
    },
  } as unknown as IDBFactory;
  const profile = await createProfile(throwing, notice);
  expect((await profile.keepMyth(page('pim'), 1)).year).toBe(1);
  expect(await profile.addFeather()).toBe(1);
  expect(await profile.pages()).toHaveLength(1);
  expect(await profile.feathers()).toBe(1);
  expect(notice).toHaveBeenCalledTimes(1);
});

test('a failed write or read keeps the profile in memory from the last read, with the notice once', async () => {
  const notice = vi.fn();
  const profile = await createProfile(new IDBFactory(), notice);
  expect(await profile.addFeather()).toBe(1);
  expect(notice).not.toHaveBeenCalled();
  const reading = vi.fn();
  const other = await createProfile(new IDBFactory(), reading);
  const broken = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
    throw new Error('InvalidStateError');
  });
  try {
    expect(await profile.addFeather()).toBe(2); // the write fails: kept in memory
    expect((await profile.keepMyth(page('pim'), 1)).year).toBe(1);
    expect(await profile.feathers()).toBe(2);
    expect(notice).toHaveBeenCalledTimes(1);

    expect(await other.pages()).toEqual([]); // the read fails
    expect(reading).toHaveBeenCalledTimes(1);
  } finally {
    broken.mockRestore();
  }
});

test('a damaged profile reads as empty, and the next write replaces it', async () => {
  const factory = new IDBFactory();
  await (await openDb(factory)).putAll([['profile', { pages: 'garbage' }]]);
  const profile = await createProfile(factory);
  expect(await profile.pages()).toEqual([]);
  expect((await profile.keepMyth(page('pim'), 1)).year).toBe(1);
  expect(await (await createProfile(factory)).pages()).toHaveLength(1);
});

// Two tabs on one database: each write reads and merges in one transaction, so neither erases the other.
test('two profiles on one database keep both pages and both feathers', async () => {
  const factory = new IDBFactory();
  const one = await createProfile(factory);
  const two = await createProfile(factory);
  expect((await one.keepMyth(page('pim'), 1)).year).toBe(1);
  expect((await two.keepMyth(page('krit'), 1)).year).toBe(2);
  expect(await one.addFeather()).toBe(1);
  expect(await two.addFeather()).toBe(2);
  await Promise.all([one.addFeather(), two.addFeather(), one.keepMyth(page('echo'), 1)]);
  for (const p of [one, two, await createProfile(factory)]) {
    expect((await p.pages()).map((x) => [x.year, x.narrator])).toEqual([
      [1, 'pim'],
      [2, 'krit'],
      [3, 'echo'],
    ]);
    expect(await p.feathers()).toBe(4);
  }
});

// ADR 0013 item 13: at the journey's end the sixth verse joins the year's page, once.
test('addVerse adds the sixth verse once', async () => {
  const factory = new IDBFactory();
  const profile = await createProfile(factory);
  const five: MythPage = {
    narrator: 'pim',
    verses: ['The Waking', "The Sky's Eye", 'The Bench', 'The Thread', 'The Fire'].map((title) => ({
      title,
      text: `${title}.`,
      note: null,
    })),
  };
  await profile.keepMyth(page('krit'), 1);
  await profile.keepMyth(five, 1);
  const sixth = {
    title: 'The Sky Came Down',
    text: 'The sky came down once, and walked with us.',
    note: null,
  };
  await profile.addVerse(2, sixth);
  await profile.addVerse(2, { ...sixth, text: 'A second telling.' });
  // A year with no page changes nothing.
  await profile.addVerse(3, sixth);
  for (const p of [profile, await createProfile(factory)]) {
    const pages = await p.pages();
    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({ ...page('krit'), year: 1, seed: 1 });
    expect(pages[1]?.verses).toEqual([...five.verses, sixth]);
  }
});

const carry = (skyWarmth: number): Carry => ({
  creatures: [
    {
      id: 'pim',
      dials: { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 },
      shell: { tightness: 0.5, bristle: 0.5, color: 0.5, softness: 0.5 },
      skyWarmth,
      away: false,
      gone: false,
      diary: ['met krit'],
    },
  ],
  ties: [{ a: 'pim', b: 'krit', ab: 0.4, ba: 0.6 }],
});

test('an M3 profile loads with its pages and feathers, no Kith, no valleys, and no sandbox', async () => {
  const factory = new IDBFactory();
  const kept = { ...page('pim'), year: 1, seed: 3 };
  await (await openDb(factory)).putAll([['profile', { pages: [kept], feathers: 2 }]]);
  const profile = await createProfile(factory);
  expect(await profile.pages()).toEqual([kept]);
  expect(await profile.feathers()).toBe(2);
  expect(await profile.kith()).toBeNull();
  expect(await profile.valleys()).toEqual([]);
  expect(await profile.sandbox()).toBeNull();
});

test('a bad new field reads as its default and keeps the pages, feathers, and other new fields', async () => {
  const factory = new IDBFactory();
  const kept = { ...page('pim'), year: 1, seed: 3 };
  await (
    await openDb(factory)
  ).putAll([
    [
      'profile',
      {
        pages: [kept],
        feathers: 2,
        kith: { creatures: 'x' },
        valleys: ['fen', 'nowhere'],
        sandbox: { link: 'v1.abc', notes: [] },
      },
    ],
  ]);
  const profile = await createProfile(factory);
  expect(await profile.kith()).toBeNull();
  expect(await profile.valleys()).toEqual([]);
  expect(await profile.sandbox()).toEqual({ link: 'v1.abc', notes: [] });
  expect(await profile.pages()).toEqual([kept]);
  expect(await profile.feathers()).toBe(2);
});

test('setKith keeps the carry; a second call replaces it', async () => {
  const factory = new IDBFactory();
  const profile = await createProfile(factory);
  await profile.setKith(carry(0.2));
  expect(await (await createProfile(factory)).kith()).toEqual(carry(0.2));
  await profile.setKith(carry(0.9));
  expect(await (await createProfile(factory)).kith()).toEqual(carry(0.9));
});

test('addValley keeps each valley once, in order', async () => {
  const factory = new IDBFactory();
  const profile = await createProfile(factory);
  for (const id of ['fen', 'kith', 'fen', 'nowhere', 'halcyon', 'kith']) await profile.addValley(id);
  expect(await (await createProfile(factory)).valleys()).toEqual(['fen', 'kith', 'halcyon']);
});

test('keepSandbox keeps the link and the notes, cutting each note to 80 characters', async () => {
  const factory = new IDBFactory();
  const profile = await createProfile(factory);
  const long = '👩‍👩‍👧é'.repeat(30); // 60 characters, several code units each
  const longer = `${long}${'x'.repeat(40)}`;
  await profile.keepSandbox({
    link: 'v1.abc',
    notes: [
      { tick: 5, text: 'a short one' },
      { tick: 9, text: longer },
    ],
  });
  const kept = await (await createProfile(factory)).sandbox();
  expect(kept?.link).toBe('v1.abc');
  expect(kept?.notes[0]).toEqual({ tick: 5, text: 'a short one' });
  expect(kept?.notes[1]?.text).toBe(`${long}${'x'.repeat(20)}`);
  expect(characters(kept?.notes[1]?.text ?? '')).toHaveLength(80);
});

test('with blocked storage the new fields live for this visit', async () => {
  const notice = vi.fn();
  const throwing = {
    open() {
      throw new Error('SecurityError');
    },
  } as unknown as IDBFactory;
  const profile = await createProfile(throwing, notice);
  await profile.setKith(carry(0.3));
  await profile.addValley('hollow');
  await profile.keepSandbox({ link: 'v1.xyz', notes: [{ tick: 1, text: 'hi' }] });
  expect(await profile.kith()).toEqual(carry(0.3));
  expect(await profile.valleys()).toEqual(['hollow']);
  expect(await profile.sandbox()).toEqual({ link: 'v1.xyz', notes: [{ tick: 1, text: 'hi' }] });
  expect(notice).toHaveBeenCalledTimes(1);
});
