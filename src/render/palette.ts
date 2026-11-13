import { z } from 'zod';

/** A `#rrggbb` color, read as a 0xrrggbb number. */
const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((s) => parseInt(s.slice(1), 16));
const Wash = z.strictObject({ color: Hex, alpha: z.number().min(0).max(1) });

/**
 * A season's or a Part 2 valley's colors (spec 11.3, 7.3), by the season or valley id: ink lines,
 * paper bodies, the accent for the focus creature, a muted warm tint for shell color on everyone
 * else (spec 5.2), a pale leaf tone for tree canopies and reeds, the page, the light and fog
 * washes, the water, and six full colors for the Soul view. Each accent is safe for color
 * blindness (it stands apart from the paper and the page in lightness, not in hue alone) and is
 * never used for text.
 */
export const PaletteSchema = z.strictObject({
  id: z.string().min(1),
  ink: Hex,
  paper: Hex,
  accent: Hex,
  warmth: Hex,
  leaf: Hex,
  background: Hex,
  light: Wash,
  fog: Wash,
  water: Hex,
  full: z.array(Hex).length(6),
});

export type Palette = z.output<typeof PaletteSchema>;
