import { describe, expect, it } from 'vitest';
import pimJson from '../../../content/rigs/PLACEHOLDER-pim.rig.json';
import { RIG_POINTS, RigSchema } from '../../../src/render/line/rig.ts';
import { buildStrip, taperedWidth } from '../../../src/render/line/strip.ts';

const rig = RigSchema.parse(pimJson);

describe('buildStrip', () => {
  it('writes 2 vertices per point, each pair width(i) apart', () => {
    const points = Float32Array.from(rig.points);
    const width = (i: number): number => 0.02 + 0.0001 * i;
    const out = new Float32Array(RIG_POINTS * 4);
    expect(buildStrip(points, width, out)).toBe(256);
    for (let i = 0; i < RIG_POINTS; i++) {
      const dx = (out[4 * i] ?? 0) - (out[4 * i + 2] ?? 0);
      const dy = (out[4 * i + 1] ?? 0) - (out[4 * i + 3] ?? 0);
      expect(Math.hypot(dx, dy)).toBeCloseTo(width(i), 5);
      // The pair is centered on the point.
      expect(((out[4 * i] ?? 0) + (out[4 * i + 2] ?? 0)) / 2).toBeCloseTo(points[2 * i] ?? NaN, 5);
    }
  });
});

describe('taperedWidth', () => {
  it('tapers to 30% over the first and last 6 points', () => {
    const w = taperedWidth(1, RIG_POINTS);
    expect(w(0)).toBeCloseTo(0.3);
    expect(w(RIG_POINTS - 1)).toBeCloseTo(0.3);
    expect(w(3)).toBeGreaterThan(0.3);
    expect(w(3)).toBeLessThan(1);
    expect(w(6)).toBe(1);
    expect(w(64)).toBe(1);
    expect(w(RIG_POINTS - 7)).toBe(1);
  });
});
