import type { Graphics } from 'pixi.js';
import type { Palette } from './palette.ts';

/** Alphas for the far layer (spec 11.1 depth) and for faint marks such as tufts and planks. */
export const FAR_ALPHA = 0.35;
export const TUFT_ALPHA = 0.5;
/** High contrast thickens every line by half again, on top of the bold default (spec 11.6). */
export const HIGH_CONTRAST_WIDTH = 1.5;

/** The bold scenery line: ink with round ends and joins. */
export const inkStroke = (palette: Palette, width: number, alpha = 1) =>
  ({ color: palette.ink, width, alpha, cap: 'round', join: 'round' }) as const;

/** A dashed straight path from (x1, y1) to (x2, y2): `dash` drawn, then `gap` skipped, from the start. */
export function dashedLine(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash: number,
  gap: number,
): Graphics {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len === 0) return g;
  const [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(len, d + dash);
    g.moveTo(x1 + ux * d, y1 + uy * d).lineTo(x1 + ux * e, y1 + uy * e);
  }
  return g;
}
