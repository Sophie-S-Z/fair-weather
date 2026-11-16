import { readdirSync, readFileSync } from 'node:fs';
import { svgPathProperties } from 'svg-path-properties';
import { describe, expect, test } from 'vitest';
import { RigSchema } from '../../../src/render/line/rig.ts';
import { rigToJson, svgToRig } from '../../../tools/svg-to-rig/svg-to-rig.ts';

/** Every body drawing in content/creatures: the rig id is the file name. */
const bodies = readdirSync('content/creatures')
  .filter((f) => f.endsWith('.svg'))
  .sort()
  .map((f) => ({ id: f.slice(0, -'.svg'.length), file: f }));

/**
 * The path walked by the curve formulas themselves, not the library's length lookup: each line or
 * cubic segment in even steps of its parameter, about 20 steps per path unit.
 */
function exactWalk(d: string): { x: number; y: number }[] {
  const walk: { x: number; y: number }[] = [];
  for (const { start: s, end: e, length, details } of new svgPathProperties(d).getParts()) {
    const steps = Math.max(8, Math.ceil(length * 20));
    for (let i = walk.length === 0 ? 0 : 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      if (details[0] === 'C') {
        const [, x1, y1, x2, y2] = details;
        walk.push({
          x: u * u * u * s.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * e.x,
          y: u * u * u * s.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * e.y,
        });
      } else if (details[0] === 'L') {
        walk.push({ x: s.x + (e.x - s.x) * t, y: s.y + (e.y - s.y) * t });
      } else {
        throw new Error(`a body path uses only L and C segments, not ${details[0]}`);
      }
    }
  }
  return walk;
}

/** Indexed read that fails loudly instead of returning undefined. */
function at<T>(a: readonly T[], i: number): T {
  const v = a[i];
  if (v === undefined) throw new Error(`index ${String(i)} out of range`);
  return v;
}

/** Arc position (along a dense walk of the path) of the walk point nearest to (sx, sy) near `want`. */
function arcPositionNear(
  walk: { x: number; y: number }[],
  arc: number[],
  want: number,
  sx: number,
  sy: number,
) {
  const centre = arc.findIndex((v) => v >= want);
  let best = centre;
  let bestD = Infinity;
  for (let j = Math.max(0, centre - 80); j <= Math.min(walk.length - 1, centre + 80); j++) {
    const p = at(walk, j);
    const dd = Math.hypot(p.x - sx, p.y - sy);
    if (dd < bestD) {
      bestD = dd;
      best = j;
    }
  }
  // Refine by projecting onto the two segments that meet at the nearest vertex.
  let pos = at(arc, best);
  let posD = bestD;
  for (const a of [best - 1, best]) {
    if (a < 0 || a >= walk.length - 1) continue;
    const p = at(walk, a);
    const q = at(walk, a + 1);
    const vx = q.x - p.x;
    const vy = q.y - p.y;
    const t = Math.min(1, Math.max(0, ((sx - p.x) * vx + (sy - p.y) * vy) / (vx * vx + vy * vy)));
    const dd = Math.hypot(p.x + vx * t - sx, p.y + vy * t - sy);
    if (dd < posD) {
      posD = dd;
      pos = at(arc, a) + t * (at(arc, a + 1) - at(arc, a));
    }
  }
  return pos;
}

describe.each(bodies)('svgToRig on $file', ({ id, file }) => {
  const svg = readFileSync(`content/creatures/${file}`, 'utf8');
  /** The y1 of the svg's `<line id=...>` marker. */
  const lineY = (marker: string): number =>
    Number(new RegExp(`id="${marker}"[^>]*y1="([^"]+)"`).exec(svg)?.[1]);

  test('samples exactly 128 points spaced by equal arc length', () => {
    const rig = svgToRig(svg, id);
    expect(RigSchema.parse(rig)).toEqual(rig);
    expect(rig.points).toHaveLength(256);
    expect(rig.region).toHaveLength(128);

    // Independent check: walk the source path, locate each rig point on it, and compare the
    // arc distance between neighbours with the mean gap.
    const d = /<path\b[^>]*\bd="([^"]+)"/.exec(svg)?.[1] ?? '';
    const walk = exactWalk(d);
    const N = walk.length - 1;
    const arc = [0];
    for (let i = 1; i <= N; i++) {
      const p = at(walk, i);
      const q = at(walk, i - 1);
      arc.push(at(arc, i - 1) + Math.hypot(p.x - q.x, p.y - q.y));
    }
    const ys = walk.map((p) => p.y);
    const xs = walk.map((p) => p.x);
    const height = Math.max(...ys) - Math.min(...ys);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const baseY = lineY('base');
    const last = at(arc, N);
    const pos: number[] = [];
    for (let i = 0; i < 128; i++) {
      const sx = at(rig.points, 2 * i) * height + cx;
      const sy = baseY - at(rig.points, 2 * i + 1) * height;
      pos.push(arcPositionNear(walk, arc, (last * i) / 127, sx, sy));
    }
    const mean = (at(pos, 127) - at(pos, 0)) / 127;
    for (let i = 1; i < 128; i++) {
      expect(Math.abs(at(pos, i) - at(pos, i - 1) - mean) / mean).toBeLessThan(0.01);
    }
    expect(rig.length * height).toBeCloseTo(last, 1);
  });

  test('normalizes: base center at origin, height 1, y up', () => {
    const rig = svgToRig(svg, id);
    const ys = rig.points.filter((_, i) => i % 2 === 1);
    const xs = rig.points.filter((_, i) => i % 2 === 0);
    // The path, not its 128 samples, sets the scale: a sharp tip can fall between two samples.
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1, 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1);
    expect(Math.abs(Math.max(...xs) + Math.min(...xs))).toBeLessThan(0.02);
    // The base line is at rig y 0, so the lowest point is below it and the eyes are above it. A
    // prop (a cap, a kite, a plume) can move the middle, so the eyes need only be left and right.
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(rig.markers.eyeL[1]).toBeGreaterThan(0);
    expect(rig.markers.eyeL[1]).toBeLessThan(Math.max(...ys));
    expect(rig.markers.eyeL[0]).toBeLessThan(rig.markers.eyeR[0]);
  });

  test('assigns regions by neck and base lines', () => {
    const rig = svgToRig(svg, id);
    // Rig y is (base - y) / height. The left eye gives the height, so the neck line sits at this rig y.
    const eyeCy = Number(/id="eye-l"[^>]*cy="([^"]+)"/.exec(svg)?.[1]);
    const height = (lineY('base') - eyeCy) / rig.markers.eyeL[1];
    const neck = (lineY('base') - lineY('neck')) / height;
    const counts = [0, 0, 0];
    for (let i = 0; i < 128; i++) {
      const y = at(rig.points, 2 * i + 1);
      const r = at(rig.region, i);
      counts[r] = at(counts, r) + 1;
      if (r === 2) expect(y).toBeLessThan(0);
      if (r === 1) {
        expect(y).toBeGreaterThanOrEqual(-1e-4);
        expect(y).toBeLessThan(neck + 0.01);
      }
      if (r === 0) expect(y).toBeGreaterThan(neck - 0.01);
    }
    expect(counts.every((c) => c > 0)).toBe(true);
  });

  test('is byte-identical across runs', () => {
    expect(rigToJson(svgToRig(svg, id))).toBe(rigToJson(svgToRig(svg, id)));
  });

  test('rounds to 4 decimals and ends with a newline', () => {
    const json = rigToJson(svgToRig(svg, id));
    expect(json.endsWith('}\n')).toBe(true);
    for (const m of json.matchAll(/-?\d+\.\d+/g))
      expect(at(m[0].split('.'), 1).length).toBeLessThanOrEqual(4);
  });

  test('rejects two paths', () => {
    const two = svg.replace('</svg>', '<path id="line" d="M 0 0 L 1 1"/></svg>');
    expect(() => svgToRig(two, 'x')).toThrow(/exactly one path#line/);
  });

  test('rejects a missing path', () => {
    expect(() => svgToRig(svg.replace('id="line"', 'id="other"'), 'x')).toThrow(/exactly one path#line/);
  });

  test('rejects a missing eye-l', () => {
    expect(() => svgToRig(svg.replace('id="eye-l"', 'id="eye-x"'), 'x')).toThrow(/missing marker eye-l/);
  });

  test('rejects a missing neck', () => {
    expect(() => svgToRig(svg.replace('id="neck"', 'id="nope"'), 'x')).toThrow(/missing marker neck/);
  });
});

describe.each(bodies)('checked-in rig for $file', ({ id, file }) => {
  test('equals the tool output', () => {
    const svg = readFileSync(`content/creatures/${file}`, 'utf8');
    const rig = readFileSync(`content/rigs/${file.replace('.svg', '.rig.json')}`, 'utf8');
    expect(rig).toBe(rigToJson(svgToRig(svg, id)));
  });
});
