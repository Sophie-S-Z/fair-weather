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

/** A smooth line through flat x, y pairs: quadratic curves through the segment midpoints. */
export function smoothLine(g: Graphics, p: readonly number[]): Graphics {
  const at = (i: number): number => p[i] ?? 0;
  g.moveTo(at(0), at(1));
  for (let k = 2; k + 3 < p.length; k += 2) {
    g.quadraticCurveTo(at(k), at(k + 1), (at(k) + at(k + 2)) / 2, (at(k + 1) + at(k + 3)) / 2);
  }
  return g.lineTo(at(p.length - 2), at(p.length - 1));
}

/** A closed smooth shape through flat x, y pairs: quadratic curves through the segment midpoints. */
export function smoothClosed(g: Graphics, p: readonly number[]): Graphics {
  const n = p.length / 2;
  const x = (i: number): number => p[(i % n) * 2] ?? 0;
  const y = (i: number): number => p[(i % n) * 2 + 1] ?? 0;
  g.moveTo((x(0) + x(1)) / 2, (y(0) + y(1)) / 2);
  for (let i = 1; i <= n; i++) g.quadraticCurveTo(x(i), y(i), (x(i) + x(i + 1)) / 2, (y(i) + y(i + 1)) / 2);
  return g.closePath();
}
