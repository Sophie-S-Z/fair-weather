import { IDBFactory } from 'fake-indexeddb';
import { expect, test, vi } from 'vitest';
import tuningJson from '../../../content/tuning.json';
import scenarioJson from '../../../content/scenarios/m0.json';
import flagsJson from '../../../content/flags.json';
import versesJson from '../../../content/myth/verses.json';
import ch4Json from '../../../content/chapters/ch4.json';
import ch5Json from '../../../content/chapters/ch5.json';
import i5Json from '../../../content/chapters/i5.json';
import bridgeJson from '../../../content/chapters/bridge.json';
import fenJson from '../../../content/valleys/fen.json';
import homeJson from '../../../content/valleys/home.json';
import ch4Carry from '../../golden/carry/ch4.json';
import ch10Carry from '../../golden/carry/ch10.json';
import { brushShare, extractFeatures } from '../../../src/myth/features.ts';
import { tellMyth, VersesSchema } from '../../../src/myth/grammar.ts';
import { openDb } from '../../../src/persist/db.ts';
import { hashTuning } from '../../../src/persist/format.ts';
import type { SaveV3 } from '../../../src/persist/format.ts';
import { migrate } from '../../../src/persist/migrations.ts';
import { createProfile } from '../../../src/persist/profile.ts';
import { createSlots } from '../../../src/persist/slots.ts';
import { hashWorld } from '../../../src/sim/hash.ts';
import { step } from '../../../src/sim/step.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { Scenario } from '../../../src/sim/types.ts';
import { createWorld } from '../../../src/sim/world.ts';
import type { YearLog } from '../../../src/story/action-log.ts';
import { CarrySchema } from '../../../src/story/carry.ts';
import type { Carry } from '../../../src/story/carry.ts';
import { parseFlags } from '../../../src/story/flags.ts';
import { kithLeg, kithLegsBefore, kithScenario, newJourney } from '../../../src/story/journey.ts';
import type { Journey } from '../../../src/story/journey.ts';
import { displayName } from '../../../src/story/names.ts';
import { buildScenario, chapterStart } from '../../../src/story/scenario.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';
import type { Chapter } from '../../../src/story/schema.ts';
import { toLite } from '../../../src/sim-host/lite.ts';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import { createWorkerCore } from '../../../src/sim-host/worker-core.ts';

const tuning = parseTuning(tuningJson);
const share = brushShare(tuning);
const flags = parseFlags(flagsJson);
const base = scenarioJson as Scenario;

function makeSave(chapterId: string, ticks = 5): SaveV3 {
  const world = createWorld(7, tuning, base);
  for (let i = 0; i < ticks; i++) step(world, [], tuning);
  return {
    version: 3,
    seed: 7,
    tuningHash: hashTuning(JSON.stringify(tuningJson)),
    ink: '{}',
    flags,
    chapterId,
    year: [],
    carry: null,
    checkpoint: structuredClone(world),
    journey: null,
  };
}

/** Kith at the end of Part 1 (the stored ch10 carry), where its silent run starts. */
const kithStart: Carry = CarrySchema.parse(ch10Carry);

/** A journey two valleys in: Fen sent its first postcard, Hollow was skipped and left no page. */
function midJourney(): Journey {
  const j = newJourney('kite', 'Ash: the quiet one', kithStart, 2);
  j.record = { moves: ['give', 'keep', 'give'], answered: 2, against: 1 };
  j.rumor = { value: 0.25, strength: 0.5 };
  j.shell = { tightness: 0.4, bristle: 0.2, color: 0.7, softness: 0.6 };
  j.keepsakes = [{ id: 'starling-feather', given: true }];
  j.pages = [
    {
      valley: 'fen',
      stamp: 'welcomed',
      said: { value: 0.25, strength: 0.5 },
      keepsake: 'starling-feather',
      postcard: 'generosity',
      caption: 'Tove flew, and we flew too. 🐦',
    },
  ];
  return j;
}

/** Kith's silent run on a worker core, as main.ts's Kith host runs it. */
function kithHost(scenario: Scenario): {
  leg: (l: ReturnType<typeof kithLeg>) => void;
  lite: () => WorldLite;
} {
  const out = { lite: null as WorldLite | null, error: null as string | null };
  const core = createWorkerCore(
    (m) => {
      if (m.t === 'forwarded') out.lite = m.lite;
      if (m.t === 'error') out.error = m.message;
    },
    { now: () => 0, every: () => () => undefined },
  );
  core({ t: 'init', seed: 1, tuning: tuningJson, scenario });
  return {
    leg(l) {
      core({ t: 'commands', list: l.commands });
      core({ t: 'fastForward', ticks: l.ticks, id: 0 });
    },
    lite() {
      if (out.error !== null || !out.lite) throw new Error(`Kith did not run: ${String(out.error)}`);
      return out.lite;
    },
  };
}

/** A chapter's log with `against` sky replies, one per entry of `ticks`. */
const rumbles = (chapterId: string, ticks: number[]): YearLog[number] => ({
  chapterId,
  log: ticks.map((tick) => ({ kind: 'verb', tick, input: { verb: 'respond', reply: 'against' } })),
});

test('a save keeps the year log through save and load', async () => {
  const slots = await createSlots(new IDBFactory());
  const year: YearLog = [
    rumbles('ch1', [3]),
    {
      chapterId: 'ch2',
      log: [
        { kind: 'accepted', tick: 4, list: [{ t: 'shine', x: 1, y: 2 }] },
        { kind: 'bet', tick: 5, id: 'b1', answer: 'pim', result: 'krit' },
        { kind: 'twist', tick: 6, id: 't1', fired: true, retries: 1 },
        { kind: 'event', tick: 7, e: { t: 'lit', a: 'pim', b: 'krit', behaviors: ['give', 'keep'] } },
        { kind: 'activity', tick: 8, activity: 'rhythm', result: '2' },
      ],
    },
  ];
  await slots.save('auto', { ...makeSave('ch3'), year });
  expect((await slots.load('auto'))?.year).toEqual(year);
});

test('a v1 save migrates with an empty year and the new flags at their defaults', () => {
  const { seed, tuningHash, ink, checkpoint } = makeSave('ch2');
  // An M1 save: version 1, a command log, and only the flags M1 had.
  const m1Flags = Object.fromEntries(
    Object.entries({ ...flags, pimSkyBond: 0.9 }).filter(
      ([k]) => !['greetingSong', 'festivalShare', 'bellDanced'].includes(k),
    ),
  );
  const v1 = {
    version: 1,
    seed,
    tuningHash,
    ink,
    flags: m1Flags,
    chapterId: 'ch2',
    log: [{ tick: 3, list: [] }],
    checkpoint,
  };
  const save = migrate(v1);
  expect(save.version).toBe(3);
  expect(save.year).toEqual([]);
  expect(save.carry).toBeNull();
  expect(save.journey).toBeNull();
  expect('log' in save).toBe(false);
  expect(save.flags).toEqual({ ...flags, pimSkyBond: 0.9 });
  expect(save.chapterId).toBe('ch2');
  // IndexedDB keeps a flag stored as undefined; it takes its default too.
  expect(migrate({ ...v1, flags: { ...m1Flags, winterLeft: undefined } }).flags).toEqual({
    ...flags,
    pimSkyBond: 0.9,
  });
});

test('a v3 save keeps the journey through save and load', async () => {
  const factory = new IDBFactory();
  const slots = await createSlots(factory);
  const journey = { ...midJourney(), wisp: 'stay' as const };
  await slots.save('auto', { ...makeSave('ch10'), journey: null });
  await slots.save('auto', { ...makeSave('halcyon'), journey });
  const loaded = await slots.load('auto');
  // The hero's name, the captions, and journey.bookYear come back as they were.
  expect(loaded?.journey).toEqual(journey);
  expect(loaded?.journey?.bookYear).toBe(2);

  // A v3 save with a bad journey, or none, is damaged like any other: the autosave falls back.
  const bad = { ...makeSave('halcyon'), journey: { ...journey, wisp: 'maybe' } };
  expect(() => migrate(bad)).toThrow();
  const long = { ...journey, pages: journey.pages.map((p) => ({ ...p, caption: 'x'.repeat(81) })) };
  expect(() => migrate({ ...makeSave('halcyon'), journey: long })).toThrow();
  const missing: Partial<SaveV3> = makeSave('halcyon');
  delete missing.journey;
  expect(() => migrate(missing)).toThrow();
  await (await openDb(factory)).putAll([['auto', bad]]);
  expect((await slots.load('auto'))?.chapterId).toBe('ch10');
});

test('a v2 save migrates with a null journey and the new flags at their defaults', () => {
  const rest: Partial<SaveV3> = makeSave('hollow');
  delete rest.journey;
  // A save from before Part 2's flags (M3.6): version 2, without toveFlew, heroFamous, wispHome, kithHeld.
  const before = Object.fromEntries(
    Object.entries({ ...flags, pimSkyBond: 0.9 }).filter(
      ([k]) => !['toveFlew', 'heroFamous', 'wispHome', 'kithHeld'].includes(k),
    ),
  );
  const save = migrate({ ...rest, version: 2, flags: before });
  expect(save.version).toBe(3);
  expect(save.journey).toBeNull();
  expect(save.flags).toEqual({ ...flags, pimSkyBond: 0.9 });
  expect(save.chapterId).toBe('hollow');
  // A v2 save written with all the flags keeps them; one stored as undefined takes its default.
  const all = { ...flags, kithHeld: false, toveFlew: false };
  expect(migrate({ ...rest, version: 2, flags: all }).flags).toEqual(all);
  expect(migrate({ ...rest, version: 2, flags: { ...before, wispHome: undefined } }).flags).toEqual({
    ...flags,
    pimSkyBond: 0.9,
  });
  // The flags a v2 save always had are still required.
  const lacking = { ...before };
  delete lacking['pimScar'];
  expect(() => migrate({ ...rest, version: 2, flags: lacking })).toThrow();
});

// Review Focus 1 (ADR 0013 item 10): Continue in a valley runs Kith's legs again from the journey's
// kithStart, each finished valley's postcard nudge and then its days, as the unbroken run did.
test('Continue in Halcyon rebuilds Kith to the same average warmth as the run that saved', async () => {
  const bridge = ChapterSchema.parse(bridgeJson);
  const home = ChapterSchema.parse(homeJson);
  const scenario = kithScenario(bridge, home, base, kithStart);
  // The run that saved: main.ts sends each leg when its valley ends, with the postcard it sent.
  const unbroken = kithHost(scenario);
  unbroken.leg(kithLeg(0, ChapterSchema.parse(fenJson).valley?.postcards[0] ?? null, home));
  unbroken.leg(kithLeg(1, null, home)); // Hollow was skipped: no postcard, still its days
  const saved = unbroken.lite();

  // Halcyon's autosave, a reload, and Continue.
  const slots = await createSlots(new IDBFactory());
  await slots.save('auto', { ...makeSave('halcyon'), journey: midJourney() });
  const loaded = await slots.load('auto');
  const journey = loaded?.journey;
  if (!journey) throw new Error('no journey in the save');
  const legs = kithLegsBefore(journey, 'halcyon', home);
  expect(legs).toHaveLength(2);
  const rebuilt = kithHost(kithScenario(bridge, home, base, journey.kithStart));
  for (const l of legs) rebuilt.leg(l);

  expect(rebuilt.lite().metrics.averageWarmth).toBe(saved.metrics.averageWarmth);
  expect(rebuilt.lite()).toEqual(saved);
  // The nudge matters: without Fen's postcard Kith ends elsewhere.
  const unnudged = kithHost(scenario);
  for (const l of legs) unnudged.leg({ ...l, commands: [] });
  expect(unnudged.lite()).not.toEqual(saved);
  // Before the homecoming every Stage 1 valley is replayed; before Fen, none.
  expect(kithLegsBefore(journey, 'home', home)).toHaveLength(3);
  expect(kithLegsBefore(journey, 'fen', home)).toEqual([]);
});

// Review Focus 1: the year so far is in the chapter-start save, so the myth after a Continue counts it.
test('Continue in chapter 7 gives a myth built from chapters 0 to 6', async () => {
  const slots = await createSlots(new IDBFactory());
  const year: YearLog = ['ch0', 'ch1', 'ch2', 'ch3', 'i3', 'ch4', 'i4', 'ch5', 'i5', 'ch6'].map((id) =>
    id === 'ch1' ? rumbles(id, [10, 20]) : id === 'ch2' ? rumbles(id, [30]) : { chapterId: id, log: [] },
  );
  await slots.save('auto', { ...makeSave('ch7'), year });
  const loaded = await slots.load('auto');
  if (!loaded) throw new Error('no save');
  expect(loaded.chapterId).toBe('ch7');
  const features = extractFeatures(loaded.year, loaded.flags, { krit: 0.9, pim: 0.1 }, share);
  expect(features.rumbles).toBe(3);
  const page = tellMyth(features, VersesSchema.parse(versesJson), displayName);
  expect(page.verses[0]?.text).toContain('rumbled at us 3 times');
});

// The real resume path: startChapter takes its start from chapterStart, with the save's carry on Continue.
test('Continue rebuilds the chapter start, its scenario, and the next carry as an unbroken run does', async () => {
  const [ch4, ch5, i5] = [ch4Json, ch5Json, i5Json].map((c) => ChapterSchema.parse(c)) as [
    Chapter,
    Chapter,
    Chapter,
  ];
  /** A short run of a chapter's scenario, as its last snapshot. */
  const run = (sc: Scenario): WorldLite => {
    const w = createWorld(1, tuning, sc);
    for (let i = 0; i < 30; i++) step(w, [], tuning);
    return toLite(w, tuning);
  };
  const start4 = chapterStart(ch4, flags, base, { saved: ch4Carry });
  const lite4 = run(buildScenario(ch4, flags, base, start4.carry));
  const diaries = new Map([['pim', ['Woke.', 'Met Krit.']]]);

  // Unbroken: ch5 starts from ch4's last snapshot.
  const start5 = chapterStart(ch5, flags, base, { lite: lite4, diaries, last: start4 });
  // Broken: ch5's autosave, a reload, and Continue.
  const slots = await createSlots(new IDBFactory());
  await slots.save('auto', { ...makeSave('ch5'), carry: start5.carry ?? null });
  const loaded = await slots.load('auto');
  if (!loaded) throw new Error('no save');
  const resumed5 = chapterStart(ch5, loaded.flags, base, { saved: loaded.carry });
  expect(resumed5).toEqual(start5);
  expect(buildScenario(ch5, loaded.flags, base, resumed5.carry)).toEqual(
    buildScenario(ch5, flags, base, start5.carry),
  );

  // The next chapter puts ch5's overridden dials back from what ch5 received, on both paths.
  const lite5 = run(buildScenario(ch5, flags, base, start5.carry));
  const next = chapterStart(i5, flags, base, { lite: lite5, diaries, last: start5 });
  expect(chapterStart(i5, flags, base, { lite: lite5, diaries, last: resumed5 })).toEqual(next);
  expect(chapterStart(i5, flags, base, { lite: lite5, diaries, last: null })).not.toEqual(next);
});

test('a save with a damaged year log entry fails to load, and the autosave falls back', async () => {
  const factory = new IDBFactory();
  const slots = await createSlots(factory);
  await slots.save('auto', { ...makeSave('ch0'), year: [rumbles('ch0', [1])] });
  await slots.save('auto', { ...makeSave('ch1'), year: [rumbles('ch0', [1])] });
  const damaged = { ...makeSave('ch2'), year: [{ chapterId: 'ch1', log: [{ kind: 'verb', tick: 3 }] }] };
  expect(() => migrate(damaged)).toThrow();
  expect(() =>
    migrate({ ...damaged, year: [{ chapterId: 'ch1', log: [{ kind: 'event', tick: 3, e: { t: 'lit' } }] }] }),
  ).toThrow();
  await (await openDb(factory)).putAll([['auto', damaged]]);
  expect((await slots.load('auto'))?.chapterId).toBe('ch0');
});

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

  await db.putAll([['auto', { version: 2, seed: 'not a number' }]]);
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

test('migrate rejects an unknown version and a damaged save, and accepts version 3', () => {
  expect(() => migrate({ ...makeSave('ch0'), version: 99 })).toThrow(/version 99/);
  expect(() => migrate(null)).toThrow();
  expect(() => migrate({ version: 1 })).toThrow();
  expect(() => migrate({ version: 2 })).toThrow();
  expect(() => migrate({ version: 3 })).toThrow();
  expect(() => migrate({ ...makeSave('ch0'), carry: { creatures: 'none' } })).toThrow();
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

// Spec 10.6 item 7: one page per finished year. When the fire ends, main.ts keeps the page and then
// marks the year kept (keepYear), so Continue cannot play the ch10 fire again for a second page.
test('after the year is kept, Continue is not offered and the Book keeps one page', async () => {
  const factory = new IDBFactory();
  const slots = await createSlots(factory);
  const profile = await createProfile(factory);
  await slots.save('auto', makeSave('ch9'));
  await slots.save('auto', makeSave('ch10'));
  expect((await slots.load('auto'))?.chapterId).toBe('ch10');
  const page = { narrator: 'pim', verses: [{ title: 'The Waking', text: 'Pim woke.', note: null }] };
  await profile.keepMyth(page, 7);
  await slots.keepYear();
  // Continue reads the autosave: there is none to continue, also after a reload.
  for (const s of [slots, await createSlots(factory)]) {
    expect(await s.hasAuto()).toBe(false);
    expect(await s.load('auto')).toBeNull();
    expect(await s.list()).toEqual([]);
  }
  expect(await profile.pages()).toHaveLength(1);
  // A new year's autosave is offered again.
  await slots.save('auto', makeSave('ch0'));
  expect((await slots.load('auto'))?.chapterId).toBe('ch0');
});

test('keepYear marks the year kept also when the latest autosave is damaged', async () => {
  const factory = new IDBFactory();
  const slots = await createSlots(factory);
  await slots.save('auto', makeSave('ch9'));
  await slots.save('auto', makeSave('ch10'));
  await (await openDb(factory)).putAll([['auto', { version: 2 }]]);
  expect((await slots.load('auto'))?.chapterId).toBe('ch9'); // the one before
  await slots.keepYear();
  expect(await slots.load('auto')).toBeNull();
});

test('hasAuto sees an autosave that loads', async () => {
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
