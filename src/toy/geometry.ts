import { CAST } from './cast.ts';
import type { Critter, Prop } from './types.ts';

/** The table in table units. The view scales it to fit the screen. */
export const TABLE_W = 1600;
export const TABLE_H = 900;
/** The floor band where feet can stand: far (small) at the top, near (large) at the bottom. */
export const FLOOR = { left: 70, right: 1530, top: 430, bottom: 860 } as const;
/** A creature's height in table units at depth scale 1. */
export const CREATURE_HEIGHT = 110;

/** Far creatures are smaller: 0.78 at the back of the floor, 1.12 at the front. */
export function depthScale(y: number): number {
  const k = (y - FLOOR.top) / (FLOOR.bottom - FLOOR.top);
  return 0.78 + 0.34 * Math.min(1, Math.max(0, k));
}

export function clampToFloor(x: number, y: number): [number, number] {
  return [Math.min(FLOOR.right, Math.max(FLOOR.left, x)), Math.min(FLOOR.bottom, Math.max(FLOOR.top, y))];
}

export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

/** Distance from (px, py) to the segment (x1, y1) to (x2, y2). */
export function segmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const k = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - x1) * dx + (py - y1) * dy) / len2));
  return dist(px, py, x1 + k * dx, y1 + k * dy);
}

export type Segment = readonly [number, number, number, number];

/** The toy rail track: a trunk from the left, then a fork into a far and a near branch. */
export function trackPaths(p: Prop): { trunk: Segment; far: Segment; near: Segment } {
  const fork = p.x - 60;
  return {
    trunk: [p.x - 300, p.y, fork, p.y],
    far: [fork, p.y, p.x + 300, p.y - 70],
    near: [fork, p.y, p.x + 300, p.y + 70],
  };
}

/** Seconds for the cart to roll from the trunk start to the end of a branch. */
export const CART_SECONDS = 6;

/** The cart's place `seconds` after it left, on the branch the lever picks. */
export function cartAt(p: Prop, seconds: number): [number, number] {
  const { trunk, near, far } = trackPaths(p);
  const branch = p.on ? near : far;
  const trunkLen = trunk[2] - trunk[0];
  const branchLen = dist(branch[0], branch[1], branch[2], branch[3]);
  const d = (Math.min(seconds, CART_SECONDS) / CART_SECONDS) * (trunkLen + branchLen);
  if (d <= trunkLen) return [trunk[0] + d, trunk[1]];
  const k = (d - trunkLen) / branchLen;
  return [branch[0] + k * (branch[2] - branch[0]), branch[1] + k * (branch[3] - branch[1])];
}

/** The lamp's stage: the wall at the prop, the screen above it. */
export const WALL_HALF = 120;
export const behindWall = (p: Prop, x: number, y: number): boolean =>
  Math.abs(x - p.x) < WALL_HALF + 20 && y < p.y - 6 && y > p.y - 100;
export const beforeWall = (p: Prop, x: number, y: number): boolean =>
  Math.abs(x - p.x) < WALL_HALF + 80 && y > p.y + 12 && y < p.y + 180;

/** The two twin boxes, left (A, in) and right (B, out). */
export const twinBoxes = (p: Prop): { a: [number, number]; b: [number, number] } => ({
  a: [p.x - 90, p.y],
  b: [p.x + 90, p.y],
});

/** A creature's height on screen, in table units. */
export const heightOf = (c: Critter): number => CREATURE_HEIGHT * CAST[c.cast].scale * depthScale(c.y);
