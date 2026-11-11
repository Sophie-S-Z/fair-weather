import type { Shell } from '../../sim/types.ts';
import { RIG_POINTS, type Rig } from './rig.ts';

/** Boil offset per axis, in rig units. */
export const BOIL_AMPLITUDE = 0.004;
/** Boil frames per second (spec 11.2). */
export const BOIL_FPS = 12;
const TIGHTNESS_PULL = 0.15;
/** Bristle zigzag height at bristle 1, in rig units: a fine zigzag (spec 5.2). */
export const BRISTLE_AMPLITUDE = 0.006;
const SOFTNESS_MAX_PASSES = 3;

const scratch = new Float32Array(RIG_POINTS * 2);

/** A value in [-1, 1] from an integer hash of (frame, index, axis). */
function hashUnit(frame: number, index: number, axis: number): number {
  let h =
    Math.imul(frame | 0, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca77) ^ Math.imul(axis + 1, 0xc2b2ae3d);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/**
 * Bends the rig by the shell values and the boil frame, writing x, y pairs into `out` (spec 5.2, 11.2).
 * Order: tightness, softness, bristle, boil. Color does not move points.
 */
export function deform(rig: Rig, shell: Shell, boilFrame: number, out: Float32Array): Float32Array {
  const n = RIG_POINTS;
  const src = rig.points;
  for (let k = 0; k < n * 2; k++) out[k] = src[k] ?? 0;

  // Tightness: pull every point toward the mean of the body points.
  if (shell.tightness > 0) {
    let cx = 0;
    let cy = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (rig.region[i] !== 1) continue;
      cx += out[2 * i] ?? 0;
      cy += out[2 * i + 1] ?? 0;
      count++;
    }
    if (count > 0) {
      cx /= count;
      cy /= count;
      const pull = TIGHTNESS_PULL * shell.tightness;
      for (let i = 0; i < n; i++) {
        const x = out[2 * i] ?? 0;
        const y = out[2 * i + 1] ?? 0;
        out[2 * i] = x + (cx - x) * pull;
        out[2 * i + 1] = y + (cy - y) * pull;
      }
    }
  }

  // Softness: neighbor averaging passes; the ends stay put.
  const passes = Math.round(shell.softness * SOFTNESS_MAX_PASSES);
  for (let pass = 0; pass < passes; pass++) {
    scratch.set(out);
    for (let i = 1; i < n - 1; i++) {
      for (let c = 0; c < 2; c++) {
        const k = 2 * i + c;
        out[k] = ((scratch[k - 2] ?? 0) + 2 * (scratch[k] ?? 0) + (scratch[k + 2] ?? 0)) / 4;
      }
    }
  }

  // Bristle: a zigzag along the normal, alternating sign point by point.
  if (shell.bristle > 0) {
    scratch.set(out);
    const amp = shell.bristle * BRISTLE_AMPLITUDE;
    for (let i = 0; i < n; i++) {
      // Unit normal by central difference, one-sided at the ends.
      const a = i > 0 ? i - 1 : i;
      const b = i < n - 1 ? i + 1 : i;
      const tx = (scratch[2 * b] ?? 0) - (scratch[2 * a] ?? 0);
      const ty = (scratch[2 * b + 1] ?? 0) - (scratch[2 * a + 1] ?? 0);
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny = tx / len;
      const s = (i & 1) === 0 ? amp : -amp;
      out[2 * i] = (scratch[2 * i] ?? 0) + nx * s;
      out[2 * i + 1] = (scratch[2 * i + 1] ?? 0) + ny * s;
    }
  }

  // Boil: a small hashed offset per point and frame.
  for (let i = 0; i < n; i++) {
    out[2 * i] = (out[2 * i] ?? 0) + hashUnit(boilFrame, i, 0) * BOIL_AMPLITUDE;
    out[2 * i + 1] = (out[2 * i + 1] ?? 0) + hashUnit(boilFrame, i, 1) * BOIL_AMPLITUDE;
  }
  return out;
}

/** The boil frame for a time in seconds; reduced motion freezes it at 0 (spec 11.6). */
export function boilFrameAt(seconds: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : Math.floor(seconds * BOIL_FPS);
}
