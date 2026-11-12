import { z } from 'zod';
import { bodyColor } from './line/fill.ts';
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

/** Villagers share one color: the warm tint they wear in the Meadow, deepened this far toward ink. */
const VILLAGER_DEPTH = 0.35;

/**
 * A creature's color in the Cosmos and the Soul view: a cast member's own, or the one all
 * villagers share (outside the cast's six).
 */
export function creatureColor(id: string, cast: Map<string, Cast>, palette: Palette): number {
  const member = cast.get(id);
  return member ? castColor(member, palette) : bodyColor(palette.warmth, palette.ink, VILLAGER_DEPTH);
}
