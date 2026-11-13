// Diary lines (spec 10.5): what a sim event says in the diary of each creature it names, from the
// templates in content/diary.json. `{other}` is the other creature's display name.
import { z } from 'zod';
import type { SimEvent } from '../sim/types.ts';
import { displayName } from './names.ts';

const line = z.string().min(1);
export const DiarySchema = z.strictObject({
  'bid.toward': line,
  'bid.away': line,
  'bid.against': line,
  'gift.gave.give': line,
  'gift.gave.keep': line,
  'gift.got.give': line,
  'gift.got.keep': line,
  leave: line,
  return: line,
  dance: line,
});
export type Diary = z.infer<typeof DiarySchema>;

/**
 * A bid writes the bidder's line, from the reply as the bidder saw it; a gift writes the giver's
 * own move and the receiver's view of it; leave, return, and dance write one line. Other events
 * write none.
 */
export function diaryLines(e: SimEvent, diary: Diary): { id: string; text: string }[] {
  const fill = (key: keyof Diary, other: string): string =>
    diary[key].replaceAll('{other}', displayName(other));
  switch (e.t) {
    case 'bid':
      return [{ id: e.from, text: fill(`bid.${e.seenAs}`, e.to) }];
    case 'gift':
      return [
        { id: e.from, text: fill(`gift.gave.${e.move}`, e.to) },
        { id: e.to, text: fill(`gift.got.${e.seenAs}`, e.from) },
      ];
    case 'leave':
    case 'return':
    case 'dance':
      return [{ id: e.who, text: diary[e.t] }];
    default:
      return [];
  }
}
