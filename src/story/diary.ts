// Diary lines (spec 10.5): what a sim event says in the diary of each creature it names, from the
// templates in content/diary.json. `{other}` is the other creature's display name, and for the
// hero the player's name. Each key holds a few lines; a creature with a voice of its own (the Kith
// cast and the valley guides) has its own lines for some keys.
import { z } from 'zod';
import diaryJson from '../../content/diary.json' with { type: 'json' };
import type { SimEvent } from '../sim/types.ts';
import { displayName } from './names.ts';

export const DIARY_KEYS = [
  'bid.toward',
  'bid.away',
  'bid.against',
  'gift.gave.give',
  'gift.gave.keep',
  'gift.got.give',
  'gift.got.keep',
  'leave',
  'return',
  'dance',
] as const;
export type DiaryKey = (typeof DIARY_KEYS)[number];

const lines = z.array(z.string().min(1)).min(1);
const Templates = z.strictObject(
  Object.fromEntries(DIARY_KEYS.map((k) => [k, lines])) as Record<DiaryKey, typeof lines>,
);
export const DiarySchema = z.strictObject({
  /** Every creature's lines. */
  default: Templates,
  /** A creature's own lines by its id, for some keys. */
  voices: z.record(z.string(), Templates.partial()),
});
export type Diary = z.infer<typeof DiarySchema>;
/** The diary templates in content/diary.json. */
export const DIARY: Diary = DiarySchema.parse(diaryJson);

/** A diary line as its template key and the other creature it names, if any (ADR 0015 item 9). */
export interface Memory {
  key: DiaryKey;
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

/** A small, stable string hash (FNV-1a), so a writer picks the same line about the same other every time. */
function pickIndex(s: string, n: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h % n;
}

/**
 * `m`'s line in `writer`'s diary: one of the writer's own lines for the key, else one of everyone's.
 * `{other}` is the other's display name, and the hero's `heroName` when given.
 */
export function memoryText(m: Memory, diary: Diary, heroName?: string, writer = ''): string {
  const options = diary.voices[writer]?.[m.key] ?? diary.default[m.key];
  const text = options[pickIndex(`${writer}|${m.other ?? ''}`, options.length)] ?? '';
  if (m.other === undefined) return text;
  return text.replaceAll('{other}', m.other === 'hero' && heroName ? heroName : displayName(m.other));
}

/** The lines `e` writes (diaryMemories), each with the creature whose diary takes it. */
export const diaryLines = (e: SimEvent, diary: Diary, heroName?: string): { id: string; text: string }[] =>
  diaryMemories(e).map((m) => ({ id: m.id, text: memoryText(m, diary, heroName, m.id) }));
