import { expect, test } from 'vitest';
import flagsJson from '../../../content/flags.json';
import tuningJson from '../../../content/tuning.json';
import type { Behavior } from '../../../src/sim/types.ts';
import { brushShare, extractFeatures } from '../../../src/myth/features.ts';
import type { ActionLog, YearLog } from '../../../src/story/action-log.ts';
import { parseFlags } from '../../../src/story/flags.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';

const share = brushShare(parseTuning(tuningJson));

const flags = parseFlags(flagsJson);
const lit = (a: string, b: string, behaviors: Behavior[]): ActionLog[number] => ({
  kind: 'event',
  tick: 0,
  e: { t: 'lit', a, b, behaviors },
});

const year: YearLog = [
  {
    chapterId: 'ch1',
    log: [
      { kind: 'verb', tick: 1, input: { verb: 'respond', reply: 'against' } },
      { kind: 'verb', tick: 2, input: { verb: 'respond', reply: 'toward' } },
      lit('krit', 'pim', ['against', 'give']),
      lit('echo', 'krit', ['toward', 'toward']),
    ],
  },
  {
    chapterId: 'ch2',
    log: [
      { kind: 'verb', tick: 3, input: { verb: 'respond', reply: 'against' } },
      { kind: 'verb', tick: 4, input: { verb: 'blow', x: 0, y: 0, dx: 1, dy: 0 } },
      { kind: 'verb', tick: 5, input: { verb: 'fog', x: 0, y: 0, clear: false } },
      { kind: 'verb', tick: 6, input: { verb: 'fog', x: 0, y: 0, clear: false } },
      { kind: 'verb', tick: 7, input: { verb: 'fog', x: 0, y: 0, clear: true } },
      { kind: 'event', tick: 8, e: { t: 'arrive', who: 'villager-3' } },
      { kind: 'event', tick: 9, e: { t: 'leave', who: 'villager-4' } },
      lit('krit', 'moss', ['keep', 'keep']),
      lit('echo', 'pim', ['toward', 'give']),
    ],
  },
];

test('features from a hand-built year', () => {
  expect(extractFeatures(year, flags, { pim: 0.4, krit: 0.6 }, share)).toMatchObject({
    lightOnConflict: 0.5,
    lightOnKindness: 0.75,
    rumbles: 2,
    gusts: 1,
    welcomes: 1,
    mostLit: 'krit',
    narrator: 'krit',
  });
});

test('fogPainted is the painted brush area over the scene area; clearing paints nothing', () => {
  const { brushRadius, brushAmount } = tuningJson.fog;
  const { width, height } = tuningJson.scene;
  const f = extractFeatures(year, flags, {}, share);
  expect(f.fogPainted).toBeCloseTo(
    (2 * Math.PI * brushRadius * brushRadius * brushAmount) / (width * height),
  );
});

test('the flag features come from the flags', () => {
  const f = extractFeatures(
    [],
    { ...flags, winterLeft: 4, mossShared: false, festivalShare: 0.2 },
    {},
    share,
  );
  expect(f).toMatchObject({
    winterLeft: 4,
    mossShared: false,
    bellDanced: flags.bellDanced,
    festivalShare: 0.2,
    wispPushed: flags.wispPushed,
  });
});

test('an empty year: no shares, no most-lit creature, and Pim narrates', () => {
  expect(extractFeatures([], flags, {}, share)).toMatchObject({
    lightOnConflict: 0,
    lightOnKindness: 0,
    rumbles: 0,
    fogPainted: 0,
    gusts: 0,
    welcomes: 0,
    mostLit: null,
    narrator: 'pim',
  });
});

test('ties go to the lower id', () => {
  const tied: YearLog = [{ chapterId: 'ch1', log: [lit('pim', 'moss', ['give', 'give'])] }];
  const f = extractFeatures(tied, flags, { pim: 0.5, echo: 0.5, krit: -0.2 }, share);
  expect(f.mostLit).toBe('moss');
  expect(f.narrator).toBe('echo');
});
