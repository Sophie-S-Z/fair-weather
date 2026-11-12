import type { Palette } from './palette.ts';

/** Alphas for the far layer (spec 11.1 depth) and for faint marks such as tufts and planks. */
export const FAR_ALPHA = 0.35;
export const TUFT_ALPHA = 0.5;

/** The bold scenery line: ink with round ends and joins. */
export const inkStroke = (palette: Palette, width: number, alpha = 1) =>
  ({ color: palette.ink, width, alpha, cap: 'round', join: 'round' }) as const;
