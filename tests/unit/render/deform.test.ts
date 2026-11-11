import { describe, expect, it } from 'vitest';
import pimJson from '../../../content/rigs/PLACEHOLDER-pim.rig.json';
import { RIG_POINTS, RigSchema } from '../../../src/render/line/rig.ts';
import { BOIL_AMPLITUDE, boilFrameAt, deform } from '../../../src/render/line/deform.ts';
import type { Shell } from '../../../src/sim/types.ts';

const rig = RigSchema.parse(pimJson);
const zero: Shell = { tightness: 0, bristle: 0, color: 0, softness: 0 };
const run = (shell: Partial<Shell>, frame = 0): Float32Array =>
  deform(rig, { ...zero, ...shell }, frame, new Float32Array(RIG_POINTS * 2));

const at = (p: ArrayLike<number>, i: number): [number, number] => [p[2 * i] ?? NaN, p[2 * i + 1] ?? NaN];

describe('deform', () => {
  it('with an all-zero shell moves points by the boil offset only, and is deterministic', () => {
    const a = run({});
    const b = run({});
    expect(Array.from(a)).toEqual(Array.from(b));
    let moved = 0;
    for (let i = 0; i < RIG_POINTS * 2; i++) {
      const d = Math.abs((a[i] ?? 0) - (rig.points[i] ?? 0));
      expect(d).toBeLessThanOrEqual(BOIL_AMPLITUDE + 1e-6);
      if (d > 1e-6) moved++;
    }
    expect(moved).toBeGreaterThan(RIG_POINTS);
    expect(BOIL_AMPLITUDE).toBe(0.004);
  });

  it('boils differently on another frame', () => {
    expect(Array.from(run({}, 1))).not.toEqual(Array.from(run({}, 0)));
  });

  it('color does not move points', () => {
    expect(Array.from(run({ color: 1 }))).toEqual(Array.from(run({})));
  });

  it('tightness 1 moves every body point closer to the center than tightness 0', () => {
    let cx = 0;
    let cy = 0;
    let n = 0;
    rig.region.forEach((r, i) => {
      if (r === 1) {
        const [x, y] = at(rig.points, i);
        cx += x;
        cy += y;
        n++;
      }
    });
    cx /= n;
    cy /= n;
    const loose = run({ tightness: 0 });
    const tight = run({ tightness: 1 });
    rig.region.forEach((r, i) => {
      if (r !== 1) return;
      const [lx, ly] = at(loose, i);
      const [tx, ty] = at(tight, i);
      expect(Math.hypot(tx - cx, ty - cy)).toBeLessThan(Math.hypot(lx - cx, ly - cy));
    });
  });

  it('bristle 1 alternates the sign of the normal offset point by point', () => {
    const flat = run({ bristle: 0 });
    const spiky = run({ bristle: 1 });
    let prev = 0;
    for (let i = 0; i < RIG_POINTS; i++) {
      const [px, py] = at(rig.points, Math.max(0, i - 1));
      const [qx, qy] = at(rig.points, Math.min(RIG_POINTS - 1, i + 1));
      const len = Math.hypot(qx - px, qy - py);
      const nx = -(qy - py) / len;
      const ny = (qx - px) / len;
      const [ax, ay] = at(flat, i);
      const [bx, by] = at(spiky, i);
      const along = (bx - ax) * nx + (by - ay) * ny;
      expect(Math.abs(along)).toBeCloseTo(0.02, 4);
      if (i > 0) expect(Math.sign(along)).toBe(-prev);
      prev = Math.sign(along);
    }
  });

  it('softness 1 lowers the sum of squared second differences', () => {
    const roughness = (p: Float32Array): number => {
      let s = 0;
      for (let i = 1; i < RIG_POINTS - 1; i++) {
        const [ax, ay] = at(p, i - 1);
        const [bx, by] = at(p, i);
        const [cx, cy] = at(p, i + 1);
        s += (ax - 2 * bx + cx) ** 2 + (ay - 2 * by + cy) ** 2;
      }
      return s;
    };
    expect(roughness(run({ softness: 1 }))).toBeLessThan(roughness(run({ softness: 0 })));
  });

  it('writes into and returns the out buffer', () => {
    const out = new Float32Array(RIG_POINTS * 2);
    expect(deform(rig, zero, 3, out)).toBe(out);
  });
});

describe('boilFrameAt', () => {
  it('boils at 12 fps and reduced motion freezes the boil at frame 0', () => {
    expect(boilFrameAt(1, false)).toBe(12);
    expect(boilFrameAt(5, true)).toBe(0);
  });
});
