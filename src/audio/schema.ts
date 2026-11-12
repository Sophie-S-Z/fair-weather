import { z } from 'zod';
import type { Season } from '../sim/types.ts';

const Key = z.object({ root: z.number().positive() });

/** `content/audio.json`: the pentatonic scale (semitone steps over `octaves`), the line lengths it spans, and each season's key. */
export const AudioSchema = z.object({
  lineRange: z.tuple([z.number().positive(), z.number().positive()]),
  steps: z.array(z.number().int().min(0).max(11)).min(2),
  octaves: z.number().int().min(1),
  // `satisfies` keeps one key per sim Season: a new season is a compile error here.
  seasons: z.object({
    spring: Key,
    summer: Key,
    lateSummer: Key,
    autumn: Key,
    winter: Key,
    thaw: Key,
  } satisfies Record<Season, typeof Key>),
});
