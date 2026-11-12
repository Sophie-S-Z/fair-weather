// Water, its bank, bridge decks, and the east ridge (ADR 0012 item 3).
import type { Rect, SimEvent, Structure, World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { dist2 } from './math.ts';

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function inWater(world: World, x: number, y: number): boolean {
  return world.water?.some((r) => inRect(r, x, y)) ?? false;
}

/** `r` grown by the bank: tuning `bank.side` left, right, and above, and `bank.below` under it. */
export function withBank(r: Rect, t: Tuning): Rect {
  const { side, below } = t.bank;
  return { x: r.x - side, y: r.y - side, w: r.w + 2 * side, h: r.h + side + below };
}

/** A bridge's deck: the one place where feet may be in water or its bank (ADR 0012 item 3). */
export type Deck = Rect & { eastWest: boolean };

/**
 * The deck of `bridge`, or null when it stands in no water. It crosses the first water rectangle
 * that holds the bridge the short way (a tall one, a brook running north to south, east to west),
 * over the bank on both sides and bridge.landing past it, so its ends rest on clear ground. Along
 * the water it reaches bridge.radius each side of the bridge.
 */
export function bridgeDeck(bridge: Structure, water: readonly Rect[], t: Tuning): Deck | null {
  const r = water.find((rect) => inRect(rect, bridge.x, bridge.y));
  if (!r) return null;
  const g = withBank(r, t);
  const { radius: half, landing } = t.bridge;
  if (r.w <= r.h)
    return { x: g.x - landing, y: bridge.y - half, w: g.w + 2 * landing, h: 2 * half, eastWest: true };
  return { x: bridge.x - half, y: g.y - landing, w: 2 * half, h: g.h + 2 * landing, eastWest: false };
}

/** Every bridge's deck, in structure order. */
export function decksOf(world: World, t: Tuning): Deck[] {
  const water = world.water ?? [];
  const out: Deck[] = [];
  for (const s of world.structures) {
    const deck = s.kind === 'bridge' ? bridgeDeck(s, water, t) : null;
    if (deck) out.push(deck);
  }
  return out;
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
 * The first water rectangle whose bank the step from (ax, ay) to (bx, by) enters off a deck, or
 * null. The step's part inside the rectangle grown by its bank (withBank) must start and end on
 * one deck. A creature that stands in a bank off every deck (it started there) is held only by the
 * water itself, under the same rule, so it can walk out and is never stuck.
 */
export function waterBlocking(
  world: World,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  t: Tuning,
): Rect | null {
  const water = world.water ?? [];
  if (water.length === 0) return null;
  const decks = decksOf(world, t);
  const at = (u: number): [number, number] =>
    u === 0 ? [ax, ay] : u === 1 ? [bx, by] : [ax + u * (bx - ax), ay + u * (by - ay)];
  const inBank = !decks.some((d) => inRect(d, ax, ay)) && water.some((r) => inRect(withBank(r, t), ax, ay));
  for (const r of water) {
    const span = clip(inBank ? r : withBank(r, t), ax, ay, bx, by);
    if (!span) continue;
    const [from, to] = [at(span[0]), at(span[1])];
    if (!decks.some((d) => inRect(d, ...from) && inRect(d, ...to))) return r;
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
