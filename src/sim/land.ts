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
 * the water it reaches bridge.radius each side of the bridge. Only that one rectangle counts: on
 * water made of several (the ch6 pond) a deck could end in another's bank, so place no bridge there.
 */
export function bridgeDeck(bridge: Structure, water: readonly Rect[], t: Tuning): Deck | null {
  return crossing(bridge, water, t)?.deck ?? null;
}

function crossing(bridge: Structure, water: readonly Rect[], t: Tuning): { deck: Deck; water: Rect } | null {
  const r = water.find((rect) => inRect(rect, bridge.x, bridge.y));
  if (!r) return null;
  const g = withBank(r, t);
  const { radius: half, landing } = t.bridge;
  const deck: Deck =
    r.w <= r.h
      ? { x: g.x - landing, y: bridge.y - half, w: g.w + 2 * landing, h: 2 * half, eastWest: true }
      : { x: bridge.x - half, y: g.y - landing, w: 2 * half, h: g.h + 2 * landing, eastWest: false };
  return { deck, water: r };
}

/** Every bridge's deck, in structure order. */
export function decksOf(world: World, t: Tuning): Deck[] {
  return crossingsOf(world, t).map((c) => c.deck);
}

function crossingsOf(world: World, t: Tuning): { deck: Deck; water: Rect }[] {
  const out: { deck: Deck; water: Rect }[] = [];
  for (const s of world.structures) {
    const c = s.kind === 'bridge' ? crossing(s, world.water ?? [], t) : null;
    if (c) out.push(c);
  }
  return out;
}

/**
 * Ground that water closes in on every side: the dry cells, of the grid the water's edges make,
 * that no dry path joins to the open meadow.
 */
export function islets(water: readonly Rect[]): Rect[] {
  const edges = (a: number[]): number[] => [...new Set(a)].sort((p, q) => p - q);
  const xs = edges(water.flatMap((r) => [r.x, r.x + r.w]));
  const ys = edges(water.flatMap((r) => [r.y, r.y + r.h]));
  const cols = xs.length - 1;
  const rows = ys.length - 1;
  const cell = (k: number): Rect => {
    const [i, j] = [k % cols, Math.floor(k / cols)];
    const [x, y] = [xs[i] ?? 0, ys[j] ?? 0];
    return { x, y, w: (xs[i + 1] ?? 0) - x, h: (ys[j + 1] ?? 0) - y };
  };
  const dry = (k: number): boolean => {
    const c = cell(k);
    return !water.some((r) => inRect(r, c.x + c.w / 2, c.y + c.h / 2));
  };
  // Flood the dry cells from the grid's border; the dry cells left over are islets.
  const open = new Set<number>();
  const todo: number[] = [];
  for (let k = 0; k < cols * rows; k++) {
    const [i, j] = [k % cols, Math.floor(k / cols)];
    if ((i === 0 || j === 0 || i === cols - 1 || j === rows - 1) && dry(k)) todo.push(k);
  }
  for (let k = todo.pop(); k !== undefined; k = todo.pop()) {
    if (open.has(k)) continue;
    open.add(k);
    const [i, j] = [k % cols, Math.floor(k / cols)];
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const [a, b] = [i + di, j + dj];
      if (a >= 0 && b >= 0 && a < cols && b < rows && dry(b * cols + a)) todo.push(b * cols + a);
    }
  }
  const out: Rect[] = [];
  for (let k = 0; k < cols * rows; k++) if (dry(k) && !open.has(k)) out.push(cell(k));
  return out;
}

/** The land a step is checked against, built once per step for every creature (landOf). */
export interface Land {
  water: readonly Rect[];
  /** water[i] grown by its bank (withBank). */
  banks: readonly Rect[];
  /** Each bridge's deck, in structure order, with the water rectangle it crosses. */
  crossings: readonly { deck: Deck; water: Rect }[];
  decks: readonly Deck[];
  islets: readonly Rect[];
}

export function landOf(world: World, t: Tuning): Land {
  const water = world.water ?? [];
  const crossings = crossingsOf(world, t);
  return {
    water,
    banks: water.map((r) => withBank(r, t)),
    crossings,
    decks: crossings.map((c) => c.deck),
    islets: water.length > 0 ? islets(water) : [],
  };
}

/** The squared distance from (x, y) to the nearest point of `r`; 0 inside it. */
function rectDist2(r: Rect, x: number, y: number): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return dx * dx + dy * dy;
}

/** The water rectangle nearest (x, y), the first listed on a tie, and its squared distance. */
function nearestWater(land: Land, x: number, y: number): [Rect | null, number] {
  let best: Rect | null = null;
  let bestD = Infinity;
  for (const r of land.water) {
    const d = rectDist2(r, x, y);
    if (d < bestD) [best, bestD] = [r, d];
  }
  return [best, bestD];
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
 * The water rectangle that refuses the step from (ax, ay) to (bx, by), or null. The step's part
 * inside a rectangle grown by its bank (Land.banks) must start and end on one deck. A creature
 * that stands in a bank off every deck is held by the water itself under that rule, and:
 *  - on an islet (ground the water closes in, too small to hold a body clear of the water), that
 *    is all, so it walks the islet freely;
 *  - elsewhere, the step must not end nearer the nearest water than it starts, so it can only walk
 *    out or along, never deeper in.
 */
export function waterBlocking(land: Land, ax: number, ay: number, bx: number, by: number): Rect | null {
  const { water, banks, decks } = land;
  if (water.length === 0) return null;
  const at = (u: number): [number, number] =>
    u === 0 ? [ax, ay] : u === 1 ? [bx, by] : [ax + u * (bx - ax), ay + u * (by - ay)];
  const held = !decks.some((d) => inRect(d, ax, ay)) && banks.some((g) => inRect(g, ax, ay));
  for (let i = 0; i < water.length; i++) {
    const r = water[i];
    const g = banks[i];
    if (!r || !g) continue;
    const span = clip(held ? r : g, ax, ay, bx, by);
    if (!span) continue;
    const [from, to] = [at(span[0]), at(span[1])];
    if (!decks.some((d) => inRect(d, ...from) && inRect(d, ...to))) return r;
  }
  if (held && !land.islets.some((isle) => inRect(isle, ax, ay))) {
    const [r, d] = nearestWater(land, ax, ay);
    if (nearestWater(land, bx, by)[1] < d) return r;
  }
  return null;
}

/** The deck crossing `water` nearest (x, y), the first listed on a tie, or null with none. */
export function nearestDeckOn(land: Land, water: Rect, x: number, y: number): Deck | null {
  let best: Deck | null = null;
  let bestD = Infinity;
  for (const c of land.crossings) {
    if (c.water !== water) continue;
    const d = rectDist2(c.deck, x, y);
    if (d < bestD) [best, bestD] = [c.deck, d];
  }
  return best;
}

/**
 * Where a creature placed at (x, y) starts: there, unless its feet are in a bank off every deck
 * and off every islet; then the nearest of the points just past the edges of the banks that hold
 * it (one unit out, inside the scene) that is clear of every bank. A creature in water stays put
 * (scenarios keep creatures out of water). So, outside an islet, no body starts over water.
 */
export function clearOfBanks(land: Land, x: number, y: number, t: Tuning): [number, number] {
  const inside = (p: readonly [number, number]): boolean =>
    land.banks.some((g) => inRect(g, ...p)) &&
    !land.decks.some((d) => inRect(d, ...p)) &&
    !land.islets.some((isle) => inRect(isle, ...p));
  if (!inside([x, y]) || land.water.some((r) => inRect(r, x, y))) return [x, y];
  const { width, height } = t.scene;
  let best: [number, number] = [x, y];
  let bestD = Infinity;
  for (const g of land.banks) {
    if (!inRect(g, x, y)) continue;
    for (const p of [
      [g.x - 1, y],
      [g.x + g.w + 1, y],
      [x, g.y - 1],
      [x, g.y + g.h + 1],
    ] as const) {
      if (p[0] < 0 || p[1] < 0 || p[0] > width || p[1] > height) continue;
      if (land.banks.some((o) => inRect(o, ...p))) continue;
      const d = dist2(x, y, ...p);
      if (d < bestD) [best, bestD] = [[p[0], p[1]], d];
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
