import { describe, expect, test } from 'vitest';
import diaryJson from '../../../content/diary.json';
import { DiarySchema, diaryLines } from '../../../src/story/diary.ts';

const diary = DiarySchema.parse(diaryJson);

describe('diaryLines', () => {
  test("a bid writes the bidder's line, from the reply as the bidder saw it", () => {
    expect(
      diaryLines({ t: 'bid', from: 'pim', to: 'krit', reply: 'toward', seenAs: 'against' }, diary),
    ).toEqual([{ id: 'pim', text: diary['bid.against'].replaceAll('{other}', 'Krit') }]);
  });

  test("a gift writes the giver's own move and the receiver's view of it", () => {
    expect(diaryLines({ t: 'gift', from: 'echo', to: 'krit', move: 'give', seenAs: 'keep' }, diary)).toEqual([
      { id: 'echo', text: diary['gift.gave.give'].replaceAll('{other}', 'Krit') },
      { id: 'krit', text: diary['gift.got.keep'].replaceAll('{other}', 'Echo') },
    ]);
  });

  test('leave, return, and dance write one line; other events write none', () => {
    expect(diaryLines({ t: 'leave', who: 'wisp' }, diary)).toEqual([{ id: 'wisp', text: diary.leave }]);
    expect(diaryLines({ t: 'return', who: 'wisp' }, diary)).toEqual([{ id: 'wisp', text: diary.return }]);
    expect(diaryLines({ t: 'dance', who: 'bell' }, diary)).toEqual([{ id: 'bell', text: diary.dance }]);
    expect(diaryLines({ t: 'arrive', who: 'wisp' }, diary)).toEqual([]);
    expect(diaryLines({ t: 'lit', a: 'pim', b: 'krit', behaviors: ['toward'] }, diary)).toEqual([]);
  });

  test('the schema rejects a missing or unknown key', () => {
    expect(DiarySchema.safeParse({ ...diary, dance: undefined }).success).toBe(false);
    expect(DiarySchema.safeParse({ ...diary, wave: 'x' }).success).toBe(false);
  });
});
