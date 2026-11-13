// Murmuration Fen's starlings (spec 7.3), drawn in code (ADR 0010): a small bird seen from the
// side on the ground, a bird with swept wings in the sky, and the water's flipped copy of a
// grounded bird. Each drawing adds path commands with plain numbers only, so drawing the flock
// allocates nothing of its own each frame.
import type { Graphics } from 'pixi.js';

/** Path commands as flat numbers: MOVE x y, LINE x y, QUAD cx cy x y, CLOSE. */
const MOVE = 0;
const LINE = 1;
const QUAD = 2;
const CLOSE = 3;

/**
 * A perched starling facing +x, in bird units with its feet at the origin and y down: a short
 * square tail, a plump body, a flat crown, and a long pointed beak.
 */
// prettier-ignore
const PERCHED: readonly number[] = [
  MOVE, -17, -6,
  QUAD, -10, -10, -4, -14,
  QUAD, 1, -18, 6, -19,
  QUAD, 9, -22.5, 12.5, -20,
  QUAD, 13.5, -19.5, 14, -18.5,
  LINE, 21, -17.5,
  LINE, 13.5, -16,
  QUAD, 13, -9, 7, -6,
  QUAD, 2, -3, -4, -5,
  QUAD, -9, -5, -18, -4,
  CLOSE,
];
/** The folded wing's edge, drawn in the sheen. */
const WING: readonly number[] = [MOVE, -11, -8, QUAD, -3, -15, 7, -12];
/** The legs, from the belly to the feet. */
const LEGS: readonly number[] = [MOVE, 1, -4.5, LINE, 0, 0, MOVE, 4, -5, LINE, 4.5, 0];
/** Light speckles on the body [x, y], and the eye. */
const SPECKLES: readonly number[] = [-6, -8, 0, -9, -2, -12.5, 4, -11, 7, -9, -10, -7];
const EYE: readonly [number, number] = [10.5, -19.5];
/** A perched starling's height in bird units, for picking: crown to feet. */
export const PERCHED_HEIGHT = 23;

/**
 * Adds `path` to `g` at (x, y), `k` scene units per bird unit, mirrored when `dir` is -1, and
 * flipped upside down (a reflection) when `flip` is -1.
 */
function trace(
  g: Graphics,
  path: readonly number[],
  x: number,
  y: number,
  k: number,
  dir: number,
  flip: number,
): void {
  const sx = k * dir;
  const sy = k * flip;
  let i = 0;
  while (i < path.length) {
    const op = path[i] ?? CLOSE;
    if (op === MOVE) g.moveTo(x + (path[i + 1] ?? 0) * sx, y + (path[i + 2] ?? 0) * sy);
    else if (op === LINE) g.lineTo(x + (path[i + 1] ?? 0) * sx, y + (path[i + 2] ?? 0) * sy);
    else if (op === QUAD)
      g.quadraticCurveTo(
        x + (path[i + 1] ?? 0) * sx,
        y + (path[i + 2] ?? 0) * sy,
        x + (path[i + 3] ?? 0) * sx,
        y + (path[i + 4] ?? 0) * sy,
      );
    else g.closePath();
    i += op === QUAD ? 5 : op === CLOSE ? 1 : 3;
  }
}

/** The colors and line widths a starling is drawn with, made once per palette and line width. */
export interface StarlingLook {
  body: number;
  sheen: number;
  ink: number;
  paper: number;
  /** The page behind the birds: a thin rim of it parts birds that overlap. */
  rim: number;
  /** The reflection's water tint and alpha. */
  water: number;
  waterAlpha: number;
  /** Ink line width in scene units at k 1. */
  line: number;
}

/**
 * A grounded starling with its feet at (x, y), `k` scene units per bird unit, facing `dir` (1 or
 * -1): a page rim, a dark glossy body with an ink outline, a sheen on the folded wing, a few light
 * speckles, a light eye, and two thin legs.
 */
export function drawPerched(
  g: Graphics,
  x: number,
  y: number,
  k: number,
  dir: number,
  look: StarlingLook,
): void {
  trace(g, PERCHED, x, y, k, dir, 1);
  g.stroke({ color: look.rim, width: 2.4 * k, alpha: 0.85, join: 'round' })
    .fill(look.body)
    .stroke({ color: look.ink, width: look.line * k, join: 'round' });
  trace(g, WING, x, y, k, dir, 1);
  g.stroke({ color: look.sheen, width: 1.4 * k, cap: 'round' });
  for (let i = 0; i + 1 < SPECKLES.length; i += 2)
    g.circle(x + (SPECKLES[i] ?? 0) * k * dir, y + (SPECKLES[i + 1] ?? 0) * k, 0.75 * k);
  g.circle(x + EYE[0] * k * dir, y + EYE[1] * k, 1.1 * k).fill({ color: look.paper, alpha: 0.85 });
  trace(g, LEGS, x, y, k, dir, 1);
  g.stroke({ color: look.ink, width: 1.1 * k, cap: 'round' });
}

/** A grounded starling's reflection: its body flipped under its feet, faint and water-tinted. */
export function drawPerchedReflection(
  g: Graphics,
  x: number,
  y: number,
  k: number,
  dir: number,
  look: StarlingLook,
): void {
  trace(g, PERCHED, x, y + 2 * k, k, dir, -1);
  g.fill({ color: look.water, alpha: look.waterAlpha });
}

/**
 * A flying starling at (x, y), `k` scene units per bird unit: a small body with two swept wings,
 * their tips raised by `lift` (0 level, like an "m", to 1 high, like a "v").
 */
export function drawFlier(
  g: Graphics,
  x: number,
  y: number,
  k: number,
  lift: number,
  look: StarlingLook,
): void {
  const tip = -1 - 8 * lift;
  g.moveTo(x - 17 * k, y + tip * k)
    .quadraticCurveTo(x - 9 * k, y + (tip - 5) * k, x - 2.5 * k, y - 1.5 * k)
    .quadraticCurveTo(x, y - 3.5 * k, x + 2.5 * k, y - 1.5 * k)
    .quadraticCurveTo(x + 9 * k, y + (tip - 5) * k, x + 17 * k, y + tip * k)
    .quadraticCurveTo(x + 8 * k, y + (tip + 1) * k, x + 2.5 * k, y + 2 * k)
    .lineTo(x + 1.5 * k, y + 5 * k)
    .lineTo(x - 1.5 * k, y + 5 * k)
    .lineTo(x - 2.5 * k, y + 2 * k)
    .quadraticCurveTo(x - 8 * k, y + (tip + 1) * k, x - 17 * k, y + tip * k)
    .closePath()
    .fill(look.body)
    .stroke({ color: look.ink, width: look.line * k * 0.8, join: 'round' });
}

/**
 * The reflection of a body drawn from a rig outline (flat x, y pairs in rig units, y up, the base
 * at the origin): flipped about its lowest point so it hangs from (x, y), `height` scene units
 * tall, faint and water-tinted.
 */
export function drawOutlineReflection(
  g: Graphics,
  outline: readonly number[],
  x: number,
  y: number,
  height: number,
  look: StarlingLook,
): void {
  if (outline.length < 6) return;
  let low = Infinity;
  for (let i = 1; i < outline.length; i += 2) low = Math.min(low, outline[i] ?? 0);
  const top = y - low * height;
  g.moveTo(x + (outline[0] ?? 0) * height, top + (outline[1] ?? 0) * height);
  for (let i = 2; i + 1 < outline.length; i += 2)
    g.lineTo(x + (outline[i] ?? 0) * height, top + (outline[i + 1] ?? 0) * height);
  g.closePath().fill({ color: look.water, alpha: look.waterAlpha });
}
