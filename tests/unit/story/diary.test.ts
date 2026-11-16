import { describe, expect, test } from 'vitest';
import diaryJson from '../../../content/diary.json';
import { DIARY_KEYS, DiarySchema, diaryLines, memoryText } from '../../../src/story/diary.ts';

const diary = DiarySchema.parse(diaryJson);
/** The line `writer` writes for `key` about `other`. */
const line = (key: (typeof DIARY_KEYS)[number], writer: string, other?: string): string =>
  memoryText(other === undefined ? { key } : { key, other }, diary, undefined, writer);

describe('diaryLines', () => {
  test("a bid writes the bidder's line, from the reply as the bidder saw it", () => {
    expect(
      diaryLines({ t: 'bid', from: 'pim', to: 'krit', reply: 'toward', seenAs: 'against' }, diary),
    ).toEqual([{ id: 'pim', text: line('bid.against', 'pim', 'krit') }]);
  });

  test("a gift writes the giver's own move and the receiver's view of it", () => {
    expect(diaryLines({ t: 'gift', from: 'echo', to: 'krit', move: 'give', seenAs: 'keep' }, diary)).toEqual([
      { id: 'echo', text: line('gift.gave.give', 'echo', 'krit') },
      { id: 'krit', text: line('gift.got.keep', 'krit', 'echo') },
    ]);
  });

  test('leave, return, and dance write one line; other events write none', () => {
    expect(diaryLines({ t: 'leave', who: 'wisp' }, diary)).toEqual([
      { id: 'wisp', text: line('leave', 'wisp') },
    ]);
    expect(diaryLines({ t: 'return', who: 'wisp' }, diary)).toEqual([
      { id: 'wisp', text: line('return', 'wisp') },
    ]);
    expect(diaryLines({ t: 'dance', who: 'bell' }, diary)).toEqual([
      { id: 'bell', text: line('dance', 'bell') },
    ]);
    expect(diaryLines({ t: 'arrive', who: 'wisp' }, diary)).toEqual([]);
    expect(diaryLines({ t: 'lit', a: 'pim', b: 'krit', behaviors: ['toward'] }, diary)).toEqual([]);
  });
});

describe('memoryText', () => {
  test('names the other, and a creature with a voice writes in it; everyone else in the shared lines', () => {
    const krit = line('gift.gave.keep', 'krit', 'pim');
    expect(diary.voices['krit']?.['gift.gave.keep']?.map((t) => t.replaceAll('{other}', 'Pim'))).toContain(
      krit,
    );
    const villager = line('gift.gave.keep', 'villager-3', 'pim');
    expect(diary.default['gift.gave.keep'].map((t) => t.replaceAll('{other}', 'Pim'))).toContain(villager);
  });

  test('the same writer about the same other picks the same line; the hero reads by its name', () => {
    expect(line('bid.toward', 'villager-3', 'krit')).toBe(line('bid.toward', 'villager-3', 'krit'));
    const others = ['pim', 'krit', 'echo', 'moss', 'wisp', 'bell', 'villager-1', 'villager-2'];
    const picked = new Set(others.map((o) => line('bid.toward', 'villager-3', o).replace(/^\S+|\S+$/g, '')));
    expect(picked.size).toBeGreaterThan(1);
    expect(memoryText({ key: 'bid.toward', other: 'hero' }, diary, 'Clara', 'pim')).toContain('Clara');
  });

  test('every line names the other exactly when its key has one', () => {
    const oneLine = new Set(['leave', 'return', 'dance']);
    for (const templates of [diary.default, ...Object.values(diary.voices)])
      for (const [key, texts] of Object.entries(templates))
        for (const text of texts ?? []) expect(text.includes('{other}')).toBe(!oneLine.has(key));
  });
});

test('the schema rejects a missing or unknown key', () => {
  expect(DiarySchema.safeParse({ ...diary, default: { ...diary.default, dance: undefined } }).success).toBe(
    false,
  );
  expect(DiarySchema.safeParse({ ...diary, default: { ...diary.default, wave: ['x'] } }).success).toBe(false);
  expect(DiarySchema.safeParse({ ...diary, voices: { pim: { wave: ['x'] } } }).success).toBe(false);
});
