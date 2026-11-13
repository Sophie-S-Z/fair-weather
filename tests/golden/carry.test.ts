// The stored carries (ADR 0012 item 1): one seeded headless year, ch3 to ch10, and Kith after
// Part 2 for the homecoming (ADR 0013 item 18). Each carried chapter's T3 run starts from its file
// here; after a content change, rewrite them with `-u`.
import { expect, test } from 'vitest';
import versesJson from '../../content/myth/verses.json';
import { brushShare, extractFeatures } from '../../src/myth/features.ts';
import { tellMyth, VersesSchema } from '../../src/myth/grammar.ts';
import { YearLogSchema } from '../../src/story/action-log.ts';
import type { YearLog } from '../../src/story/action-log.ts';
import { displayName } from '../../src/story/names.ts';
import { runYear } from './year.ts';
import tuningJson from '../../content/tuning.json';
import bridgeJson from '../../content/chapters/bridge.json';
import flagsJson from '../../content/flags.json';
import m0Json from '../../content/scenarios/m0.json';
import fenJson from '../../content/valleys/fen.json';
import halcyonJson from '../../content/valleys/halcyon.json';
import homeJson from '../../content/valleys/home.json';
import hollowJson from '../../content/valleys/hollow.json';
import type { WorldLite } from '../../src/sim-host/protocol.ts';
import { createWorkerCore } from '../../src/sim-host/worker-core.ts';
import { parseTuning } from '../../src/sim/tuning.ts';
import type { Scenario } from '../../src/sim/types.ts';
import { carryFrom } from '../../src/story/carry.ts';
import { parseFlags } from '../../src/story/flags.ts';
import { kithDays } from '../../src/story/journey.ts';
import { buildScenario, chapterTicksPerDay } from '../../src/story/scenario.ts';
import { ChapterSchema, POSTCARD_DIAL } from '../../src/story/schema.ts';
import { tuning } from '../../src/story/tuning.ts';

const share = brushShare(parseTuning(tuningJson));

// Played once, at import, for both tests.
const year = runYear(1, 'ch10');

test('the seed-1 year gives the stored carries', async () => {
  const { carries } = await year;
  expect(Object.keys(carries)).toEqual([
    'i3',
    'ch4',
    'i4',
    'ch5',
    'i5',
    'ch6',
    'ch7',
    'i7',
    'ch8',
    'i8',
    'ch9',
    'ch10',
  ]);
  for (const [id, carry] of Object.entries(carries))
    await expect(`${JSON.stringify(carry, null, 2)}\n`).toMatchFileSnapshot(`carry/${id}.json`);
});

// ADR 0012 item 11: the real year log, ch3 to ch9 as main.ts keeps it, reads through the myth.
test('the seed-1 year log through ch9 tells five verses with no open slot', async () => {
  const { results } = await year;
  const log: YearLog = Object.entries(results)
    .filter(([chapterId]) => chapterId !== 'ch10')
    .map(([chapterId, r]) => ({ chapterId, log: r.log }));
  const ch9 = results.ch9;
  if (!ch9) throw new Error('the year has no ch9');
  const skyWarmth = Object.fromEntries(ch9.last.creatures.map((c) => [c.id, c.skyWarmth]));
  const page = tellMyth(
    extractFeatures(log, ch9.flags, skyWarmth, share),
    VersesSchema.parse(versesJson),
    displayName,
  );
  expect(page.verses).toHaveLength(5);
  // The save format checks every entry (spec 15.1); a real year, ch10 included, passes it unchanged.
  const all: YearLog = Object.entries(results).map(([chapterId, r]) => ({ chapterId, log: r.log }));
  expect(YearLogSchema.parse(all)).toEqual(all);
  for (const v of page.verses) expect(`${v.text} ${v.note ?? ''}`).not.toMatch(/\{|\}|undefined|null/);
});

// ADR 0013 items 10 and 18: Kith from the year's end (the bridge's base: spring, the first bench,
// Wisp gone), counting the homecoming's days, runs silently through the three valleys in order.
// Each valley's leg starts with the nudge of the T3 player's postcard, its first.
test('Kith after Part 2 gives the stored home carry, and it held', async () => {
  const { results } = await year;
  const ch10 = results.ch10;
  if (!ch10) throw new Error('the year has no ch10');
  const kithStart = carryFrom(ch10.last, ch10.diaries);
  const home = ChapterSchema.parse(homeJson);
  const scenario = buildScenario(
    { ...ChapterSchema.parse(bridgeJson), dayLengthSeconds: home.dayLengthSeconds },
    parseFlags(flagsJson),
    m0Json as Scenario,
    kithStart,
  );
  const out = { lite: null as WorldLite | null, error: null as string | null };
  const core = createWorkerCore(
    (m) => {
      if (m.t === 'forwarded') out.lite = m.lite;
      if (m.t === 'error') out.error = m.message;
    },
    { now: () => 0, every: () => () => undefined },
  );
  core({ t: 'init', seed: 1, tuning: tuningJson, scenario });
  for (const [i, valley] of [fenJson, hollowJson, halcyonJson].entries()) {
    const card = ChapterSchema.parse(valley).valley?.postcards[0];
    if (!card) throw new Error(`${valley.id} has no postcard`);
    core({ t: 'commands', list: [{ t: 'nudge', dial: POSTCARD_DIAL[card], amount: tuning.postcard.nudge }] });
    core({ t: 'fastForward', ticks: kithDays(i) * chapterTicksPerDay(home), id: i });
  }
  if (out.error !== null || !out.lite) throw new Error(`Kith did not run: ${String(out.error)}`);
  const diaries = new Map(kithStart.creatures.map((c) => [c.id, c.diary]));
  const carry = carryFrom(out.lite, diaries);
  await expect(`${JSON.stringify(carry, null, 2)}\n`).toMatchFileSnapshot('carry/home.json');
  console.log(`Kith after Part 2: averageWarmth ${String(out.lite.metrics.averageWarmth)}`);
  // valley-home.test.ts plays with kithHeld true, so Kith must hold here.
  expect(out.lite.metrics.averageWarmth).toBeGreaterThanOrEqual(tuning.wisp.minKithWarmth);
});
