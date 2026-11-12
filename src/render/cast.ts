import { z } from 'zod';
import type { Palette } from './palette.ts';

/**
 * A named cast member's data (`content/cast/<id>.json`). `scale` sizes its body over a villager's,
 * so the cast reads as the stars. `color` is its own full color: an index into the palette's six,
 * one per cast member. The object is open: later tasks add fields to the same files.
 */
export const CastSchema = z.object({
  id: z.string().min(1),
  scale: z.number().positive(),
  color: z.number().int().min(0).max(5),
});

export type Cast = z.infer<typeof CastSchema>;

/** A cast member's own full color in `palette`. */
export const castColor = (c: Cast, palette: Palette): number => palette.full[c.color] ?? palette.ink;
