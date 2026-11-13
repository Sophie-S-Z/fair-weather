import { expect, test } from 'vitest';
import sixthJson from '../../../content/myth/sixth.json';
import { SixthSchema, sixthFeatures, tellSixth } from '../../../src/myth/sixth.ts';
import { DEFAULT_FLAGS } from '../../../src/story/flags.ts';
import { newJourney, rumorValue } from '../../../src/story/journey.ts';
import type { Journey } from '../../../src/story/journey.ts';
import { displayName } from '../../../src/story/names.ts';

const FIRST = 'The sky came down once, and walked with us.';
const verse = SixthSchema.parse(sixthJson);
const skipped = sixthFeatures(newJourney('lantern', 'Lantern-bearer', null, null), DEFAULT_FLAGS);

test('an all-skipped journey tells a whole verse with no open slot', () => {
  expect(skipped).toMatchObject({ hero: 'lantern', giftShare: 0.5, againstShare: 0 });
  const told = tellSixth(skipped, verse, 'Lantern-bearer', 'pim', displayName);
  expect(told.title).toBe('The Sky Came Down');
  expect(told.text.startsWith(`${FIRST} [PLACEHOLDER] `)).toBe(true);
  expect(`${told.text}${told.note ?? ''}`).not.toMatch(/\{|\}|undefined|null/);
});

test('the shares follow the rumor value rules', () => {
  const shares = (record: Journey['record']) => {
    const f = sixthFeatures({ ...newJourney('kite', 'K', null, null), record }, DEFAULT_FLAGS);
    expect(2 * f.giftShare - 1 - f.againstShare).toBeCloseTo(rumorValue(record));
    return [f.giftShare, f.againstShare];
  };
  expect(shares({ moves: [], answered: 0, against: 0 })).toEqual([0.5, 0]);
  expect(shares({ moves: ['give', 'keep', 'give', 'give'], answered: 4, against: 1 })).toEqual([0.75, 0.25]);
});

test('a Glassling who was famous and brought Wisp home is named in the verse', () => {
  const f = { ...skipped, hero: 'glassling', heroFamous: true, wispHome: true } as const;
  const told = tellSixth(f, verse, 'Clara', 'moss', displayName);
  expect(told.text.startsWith(`${FIRST} [PLACEHOLDER] `)).toBe(true);
  expect(told.text).toContain('Clara');
});

test('the schema refuses an unknown slot and a last template with a condition', () => {
  const last = verse.templates.length - 1;
  const swap = (i: number, t: object) => ({
    ...sixthJson,
    templates: sixthJson.templates.map((x, j) => (j === i ? t : x)),
  });
  expect(SixthSchema.safeParse(swap(0, { when: [], text: 'Hello {mostLit}.' })).success).toBe(false);
  const conditioned = { when: [{ feature: 'wispHome', op: 'eq', value: true }], text: 'x' };
  expect(SixthSchema.safeParse(swap(last, conditioned)).success).toBe(false);
});

test('the shipped templates read every feature', () => {
  const read = new Set(verse.templates.flatMap((t) => t.when.map((c) => c.feature)));
  expect([...read].sort()).toEqual(Object.keys(skipped).sort());
});
