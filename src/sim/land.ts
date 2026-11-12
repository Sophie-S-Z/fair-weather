// Water, bridges, and the east ridge (ADR 0012 item 3).
import type { Rect, SimEvent, Structure, World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { dist2 } from './math.ts';

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function inWater(world: World, x: number, y: number): boolean {
  return world.water?.some((r) => inRect(r, x, y)) ?? false;
}

/** The first bridge, in structure order, within bridge.radius of (x, y), edge included. */
export function bridgeNear(world: World, x: number, y: number, t: Tuning): Structure | null {
  const r2 = t.bridge.radius * t.bridge.radius;
  return world.structures.find((s) => s.kind === 'bridge' && dist2(x, y, s.x, s.y) <= r2) ?? null;
}

/**
 * The part of the segment from (ax, ay) to (bx, by) inside `r`, as [from, to] fractions of the
 * segment, or null when it misses. When (bx, by) is inside `r`, `to` is exactly 1.
 */
function clip(r: Rect, ax: number, ay: number, bx: number, by: number): [number, number] | null {
  let from = 0;
  let to = 1;
  for (const [a, d, lo, hi] of [
    [ax, bx - ax, r.x, r.x + r.w],
    [ay, by - ay, r.y, r.y + r.h],
  ] as const) {
    if (d === 0) {
      if (a < lo || a > hi) return null;
      continue;
    }
    const u = (lo - a) / d;
    const v = (hi - a) / d;
    from = Math.max(from, Math.min(u, v));
    to = Math.min(to, Math.max(u, v));
  }
  return from <= to ? [from, to] : null;
}

/**
 * The first water rectangle that the step from (ax, ay) to (bx, by) enters away from a bridge, or
 * null. The step's part in a rectangle must start and end within bridge.radius of a bridge.
 */
export function waterBlocking(
  world: World,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  t: Tuning,
): Rect | null {
  const at = (u: number): [number, number] =>
    u === 0 ? [ax, ay] : u === 1 ? [bx, by] : [ax + u * (bx - ax), ay + u * (by - ay)];
  for (const r of world.water ?? []) {
    const span = clip(r, ax, ay, bx, by);
    if (!span) continue;
    if (span.some((u) => !bridgeNear(world, ...at(u), t))) return r;
  }
  return null;
}

/** The bridge inside `r` nearest (x, y); the first listed wins a tie. */
export function nearestBridgeOn(world: World, r: Rect, x: number, y: number): Structure | null {
  let best: Structure | null = null;
  let bestD = Infinity;
  for (const s of world.structures) {
    if (s.kind !== 'bridge' || !inRect(r, s.x, s.y)) continue;
    const d = dist2(x, y, s.x, s.y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Each wandering creature at or past the ridge leaves for good: `away`, `gone`, and a `leave` event. */
export function crossRidge(world: World): SimEvent[] {
  const ridgeX = world.ridgeX;
  if (ridgeX === undefined) return [];
  const events: SimEvent[] = [];
  for (const c of world.creatures) {
    if (c.state !== 'wander' || c.x < ridgeX) continue;
    c.state = 'away';
    c.gone = true;
    c.vx = 0;
    c.vy = 0;
    events.push({ t: 'leave', who: c.id });
  }
  return events;
}
