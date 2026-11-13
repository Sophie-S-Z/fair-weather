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
  /**
   * A valley's sky at its hour (the Fen at dusk, the Hollow and Halcyon by day), from the top of
   * the scene to the horizon, which the accent tints. For a scene with depth.
   */
  sky: z.strictObject({ top: Hex, horizon: Hex }).optional(),
  /** A valley's floor, between its far and near `ground` (without them, near the viewer); the page without it. */
  land: Hex.optional(),
  /**
   * A valley's floor in depth: cooler, paler, and hazier at the horizon (`far`), `land` between,
   * warmer and more saturated at the scene's foot (`near`).
   */
  ground: z.strictObject({ far: Hex, near: Hex }).optional(),
  /** A sea valley's water, deep blue-green far out and a lighter tint in the shallows, and its sand. */
  sea: z.strictObject({ deep: Hex, shallow: Hex, sand: Hex }).optional(),
  /** Reed beds: the back stems (darker and cooler), the front stems (lighter), and the cattail heads. */
  reeds: z.strictObject({ back: Hex, front: Hex, head: Hex }).optional(),
  /** A starling's dark, glossy body, and the sheen on its wing. */
  plumage: z.strictObject({ body: Hex, sheen: Hex }).optional(),
});

export type Palette = z.output<typeof PaletteSchema>;
