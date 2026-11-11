import fc from 'fast-check';
import { expect, test } from 'vitest';
import { createGrid } from '../../../src/sim/grid.ts';

const W = 1600;
const H = 900;
const CELL = 40;

function bruteForce(pts: { x: number; y: number }[], qx: number, qy: number, r: number): number[] {
  const out: number[] = [];
  pts.forEach((p, i) => {
    const dx = p.x - qx;
    const dy = p.y - qy;
    if (dx * dx + dy * dy <= r * r) out.push(i);
  });
  return out;
}

function build(pts: { x: number; y: number }[]) {
  const grid = createGrid(W, H, CELL);
  grid.rebuild(
    pts.map((p) => p.x),
    pts.map((p) => p.y),
    pts.length,
  );
  return grid;
}

const coord = (max: number) =>
  fc.oneof(
    fc.double({ min: 0, max, noNaN: true }),
    fc.integer({ min: 0, max: Math.floor(max / CELL) }).map((k) => Math.min(max, k * CELL)),
  );
const layoutArb = fc.array(fc.record({ x: coord(W), y: coord(H) }), { minLength: 0, maxLength: 60 });

test('query matches brute force on 500 random layouts', () => {
  fc.assert(
    fc.property(
      layoutArb,
      fc.double({ min: -50, max: W + 50, noNaN: true }),
      fc.double({ min: -50, max: H + 50, noNaN: true }),
      fc.double({ min: 0, max: 300, noNaN: true }),
      (pts, qx, qy, r) => {
        expect(build(pts).query(qx, qy, r, [])).toEqual(bruteForce(pts, qx, qy, r));
      },
    ),
    { numRuns: 500 },
  );
});

test('a point exactly at distance r is included', () => {
  const grid = build([{ x: 103, y: 104 }]);
  expect(grid.query(100, 100, 5, [])).toEqual([0]);
});

test('points at (0,0) and (width,height) are found', () => {
  const grid = build([
    { x: 0, y: 0 },
    { x: W, y: H },
  ]);
  expect(grid.query(0, 0, 1, [])).toEqual([0]);
  expect(grid.query(W, H, 1, [])).toEqual([1]);
});

test('an empty grid returns no indices, and query clears out', () => {
  const grid = build([]);
  expect(grid.query(10, 10, 100, [7, 8])).toEqual([]);
});

test('rebuild replaces the previous layout', () => {
  const grid = build([{ x: 10, y: 10 }]);
  grid.rebuild([500], [500], 1);
  expect(grid.query(10, 10, 20, [])).toEqual([]);
  expect(grid.query(500, 500, 1, [])).toEqual([0]);
});
