// Diary lines (spec 10.5): what a sim event says in the diary of each creature it names, from the
// templates in content/diary.json. `{other}` is the other creature's display name, and for the
// hero the player's name.
import { z } from 'zod';
import diaryJson from '../../content/diary.json' with { type: 'json' };
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
/** The diary templates in content/diary.json. */
export const DIARY: Diary = DiarySchema.parse(diaryJson);

/** A diary line as its template key and the other creature it names, if any (ADR 0015 item 9). */
export interface Memory {
  key: keyof Diary;
  other?: string;
}

/**
 * The memories `e` writes, each with the creature whose diary takes it. A bid writes the bidder's,
 * from the reply as the bidder saw it; a gift writes the giver's own move and the receiver's view
 * of it; leave, return, and dance write one memory with no other. Other events write none.
 */
export function diaryMemories(e: SimEvent): (Memory & { id: string })[] {
  switch (e.t) {
    case 'bid':
      return [{ id: e.from, key: `bid.${e.seenAs}`, other: e.to }];
    case 'gift':
      return [
        { id: e.from, key: `gift.gave.${e.move}`, other: e.to },
        { id: e.to, key: `gift.got.${e.seenAs}`, other: e.from },
      ];
    case 'leave':
    case 'return':
    case 'dance':
      return [{ id: e.who, key: e.t }];
    default:
      return [];
  }
}

/** `m`'s line: `{other}` is the other's display name, and the hero's `heroName` when given. */
export const memoryText = (m: Memory, diary: Diary, heroName?: string): string =>
  m.other === undefined
    ? diary[m.key]
    : diary[m.key].replaceAll('{other}', m.other === 'hero' && heroName ? heroName : displayName(m.other));

/** The lines `e` writes (diaryMemories), each with the creature whose diary takes it. */
export const diaryLines = (e: SimEvent, diary: Diary, heroName?: string): { id: string; text: string }[] =>
  diaryMemories(e).map((m) => ({ id: m.id, text: memoryText(m, diary, heroName) }));
