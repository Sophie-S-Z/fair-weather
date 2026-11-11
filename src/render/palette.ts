import { z } from 'zod';

/** A `#rrggbb` color, read as a 0xrrggbb number. */
const Hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((s) => parseInt(s.slice(1), 16));
const Wash = z.strictObject({ color: Hex, alpha: z.number().min(0).max(1) });

/** A season's colors (spec 11.3): ink lines, paper bodies, one accent, the page, and the light and fog washes. */
export const PaletteSchema = z.strictObject({
  id: z.string().min(1),
  ink: Hex,
  paper: Hex,
  accent: Hex,
  background: Hex,
  light: Wash,
  fog: Wash,
});

export type Palette = z.output<typeof PaletteSchema>;
