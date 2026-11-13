import { expect, test } from 'vitest';
import flagsJson from '../../../content/flags.json';
import versesJson from '../../../content/myth/verses.json';
import { brushShare, extractFeatures } from '../../../src/myth/features.ts';
import type { MythFeatures } from '../../../src/myth/features.ts';
import { tellMyth, VersesSchema } from '../../../src/myth/grammar.ts';
import { parseFlags } from '../../../src/story/flags.ts';
import { displayName } from '../../../src/story/names.ts';
import tuningJson from '../../../content/tuning.json';
import { parseTuning } from '../../../src/sim/tuning.ts';

const share = brushShare(parseTuning(tuningJson));

const defaultFlags = parseFlags(flagsJson);
const verses = VersesSchema.parse(versesJson);
const skipped = extractFeatures([], defaultFlags, {}, share);

/** verses.json with one verse's templates swapped out. */
const withTemplates = (index: number, templates: unknown[]): unknown => ({
  verses: versesJson.verses.map((v, i) => (i === index ? { ...v, templates } : v)),
});
const fallback = { when: [], text: 'The end.' };
const filler = (n: number): unknown[] =>
  Array.from({ length: n }, (_, i) => ({
    when: [{ feature: 'rumbles', op: 'eq', value: 100 + i }],
    text: 'x',
  }));

test('an all-skipped year gives five whole verses with no open slot', () => {
  const page = tellMyth(skipped, verses, displayName);
  expect(page.verses.map((v) => v.title)).toEqual([
    'The Waking',
    "The Sky's Eye",
    "The Sky's Moods",
    'The Long Winter',
    'The Asking',
  ]);
  for (const v of page.verses) expect(v.text).not.toMatch(/\{|\}|undefined|null/);
  expect(page.narrator).toBe('pim');
});

test('fog near fights reads as the sky sulking, with a margin note', () => {
  const f: MythFeatures = { ...skipped, fogPainted: 0.2, lightOnConflict: 0.6 };
  const moods = tellMyth(f, verses, displayName).verses[2];
  expect(moods?.note).not.toBeNull();
  expect(moods?.text).toMatch(/sulk/);
});

test('the first template whose every condition holds is told, with its slots filled', () => {
  const v = VersesSchema.parse(
    withTemplates(0, [
      {
        when: [
          { feature: 'rumbles', op: 'gte', value: 2 },
          { feature: 'narrator', op: 'eq', value: 'krit' },
        ],
        text: 'I, Krit, heard {rumbles} rumbles.',
        note: 'You turned against {rumbles} bids.',
      },
      { when: [{ feature: 'rumbles', op: 'gte', value: 2 }], text: '{narrator} heard {rumbles} rumbles.' },
      ...filler(4),
      fallback,
    ]),
  );
  const tell = (f: Partial<MythFeatures>) => tellMyth({ ...skipped, ...f }, v, displayName).verses[0];
  expect(tell({ rumbles: 3, narrator: 'krit' })).toEqual({
    title: 'The Waking',
    text: 'I, Krit, heard 3 rumbles.',
    note: 'You turned against 3 bids.',
  });
  expect(tell({ rumbles: 3, narrator: 'villager-2' })?.text).toBe('Villager 2 heard 3 rumbles.');
  expect(tell({ rumbles: 1 })).toEqual({ title: 'The Waking', text: 'The end.', note: null });
});

test('a template that names the most-lit creature is passed over when nobody was lit', () => {
  const v = VersesSchema.parse(
    withTemplates(1, [
      { when: [{ feature: 'lightOnKindness', op: 'lte', value: 1 }], text: 'The eye found {mostLit}.' },
      ...filler(4),
      fallback,
    ]),
  );
  expect(tellMyth(skipped, v, displayName).verses[1]?.text).toBe('The end.');
  expect(tellMyth({ ...skipped, mostLit: 'moss' }, v, displayName).verses[1]?.text).toBe(
    'The eye found Moss.',
  );
});

test('a template with an unknown slot or a verse with 5 templates fails the schema', () => {
  expect(VersesSchema.safeParse(versesJson).success).toBe(true);
  const unknownSlot = withTemplates(0, [{ when: [], text: 'Hello {hero}.' }, ...filler(4), fallback]);
  expect(VersesSchema.safeParse(unknownSlot).success).toBe(false);
  expect(VersesSchema.safeParse(withTemplates(0, [...filler(4), fallback])).success).toBe(false);
});

test('the schema wants the verses in spec order, a last template for any year, and matching value types', () => {
  const swapped = { verses: [versesJson.verses[1], versesJson.verses[0], ...versesJson.verses.slice(2)] };
  expect(VersesSchema.safeParse(swapped).success).toBe(false);
  expect(VersesSchema.safeParse(withTemplates(0, filler(6))).success).toBe(false);
  const lastNamesMostLit = withTemplates(0, [...filler(5), { when: [], text: '{mostLit}' }]);
  expect(VersesSchema.safeParse(lastNamesMostLit).success).toBe(false);
  const badType = withTemplates(0, [
    { when: [{ feature: 'mossShared', op: 'gte', value: 1 }], text: 'x' },
    ...filler(4),
    fallback,
  ]);
  expect(VersesSchema.safeParse(badType).success).toBe(false);
});

test('the shipped templates read every feature, misread at least twice with a note, and use narrator voices', () => {
  const templates = verses.verses.flatMap((v) => v.templates);
  const read = new Set(templates.flatMap((t) => t.when.map((c) => c.feature)));
  expect([...read].sort()).toEqual(Object.keys(skipped).sort());
  expect(templates.filter((t) => t.note !== undefined).length).toBeGreaterThanOrEqual(2);
  expect(templates.some((t) => t.when.some((c) => c.feature === 'narrator'))).toBe(true);
});
