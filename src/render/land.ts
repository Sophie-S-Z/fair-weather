// The land on the Meadow's ground: water, the islets it closes in, and the bridges over it.
import type { Graphics } from 'pixi.js';
import type { Rect, Structure } from '../sim/types.ts';
import { FAR_ALPHA, inkStroke, TUFT_ALPHA } from './ink.ts';
import type { Palette } from './palette.ts';

/** How far a bridge reaches past each bank. */
const BRIDGE_REACH = 14;
/** Planks are this far apart along the deck. */
const PLANK_STEP = 12;
/** Ripple marks sit about this far apart on the water, each this wide. */
const RIPPLE_STEP = 90;
const RIPPLE_WIDTH = 22;

/** One ripple mark, a small wave, centered at (x, y). */
function drawRipple(g: Graphics, x: number, y: number): void {
  const h = RIPPLE_WIDTH / 2;
  g.moveTo(x - h, y)
    .quadraticCurveTo(x - h / 2, y - 5, x, y)
    .quadraticCurveTo(x + h / 2, y + 5, x + h, y);
}

/**
 * A bridge: a paper deck with ink rails and planks across the water rectangle it stands in, the
 * short way, reaching a little onto each bank. The deck is `2 * half` wide, the sim's bridge
 * radius each side, so every creature the sim lets stand on the bridge is drawn on its deck.
 */
function drawBridge(
  g: Graphics,
  { x, y }: Structure,
  r: Rect,
  half: number,
  palette: Palette,
  w: number,
): void {
  // A tall rectangle (a brook running north to south) is crossed east to west.
  const eastWest = r.w <= r.h;
  const [from, to] = eastWest ? [r.x, r.x + r.w] : [r.y, r.y + r.h];
  const at = (u: number, v: number): [number, number] => (eastWest ? [u, y + v] : [x + v, u]);
  const a = from - BRIDGE_REACH;
  const b = to + BRIDGE_REACH;
  g.poly([...at(a, -half), ...at(b, -half), ...at(b, half), ...at(a, half)])
    .fill(palette.paper)
    .stroke(inkStroke(palette, w));
  for (let u = a + PLANK_STEP; u < b - PLANK_STEP / 2; u += PLANK_STEP) {
    g.moveTo(...at(u, -half)).lineTo(...at(u, half));
  }
  g.stroke(inkStroke(palette, w * 0.5, TUFT_ALPHA));
}

const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * Water corners round off this much where no other water meets them. An islet's ground is drawn
 * this much past its edge, so its bank line lies on the water and all of the land shows.
 */
const WATER_CORNER = 14;
const ISLET_MARGIN = 5;

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

/** A rectangle whose corners round off where `round(x, y)` is true. */
function softRect(g: Graphics, r: Rect, round: (x: number, y: number) => boolean): Graphics {
  const radius = Math.min(WATER_CORNER, r.w / 2, r.h / 2);
  const c: [number, number][] = [
    [r.x + r.w, r.y],
    [r.x + r.w, r.y + r.h],
    [r.x, r.y + r.h],
    [r.x, r.y],
  ];
  g.moveTo(r.x + r.w / 2, r.y);
  c.forEach(([x, y], k) => {
    const [nx, ny] = c[(k + 1) % 4] ?? [x, y];
    if (round(x, y)) g.arcTo(x, y, nx, ny, radius);
    else g.lineTo(x, y);
  });
  return g.closePath();
}

/**
 * The water and the bridges over it: flat on the ground, under everything that stands. An islet
 * (ground that water closes in) is filled as water first, so the pond is one shape. Each piece is
 * outlined at twice the line width and then filled, so where pieces meet their outlines are covered
 * and one bank line runs round the whole water. A corner rounds off unless other water touches it or it lies on the scene's edge.
 * Each islet is then drawn as its own patch of ground with a bank line, out on the water a little.
 */
export function drawLand(
  g: Graphics,
  water: readonly Rect[],
  bridges: Structure[],
  palette: Palette,
  w: number,
  bridgeRadius: number,
  scene: { width: number; height: number },
): void {
  g.clear();
  // Water that runs off the scene stays square there, so a brook flows on past the page.
  const onEdge = (x: number, y: number): boolean => x <= 0 || y <= 0 || x >= scene.width || y >= scene.height;
  const isles = islets(water);
  const pond = [...water, ...isles];
  const shapes = pond.map(
    (r) => (piece: Graphics) =>
      softRect(piece, r, (x, y) => !onEdge(x, y) && !pond.some((o) => o !== r && inRect(o, x, y))),
  );
  for (const shape of shapes) shape(g).stroke(inkStroke(palette, 2 * w));
  for (const shape of shapes) shape(g).fill(palette.water);
  for (const r of water) {
    const cols = Math.max(1, Math.round(r.w / RIPPLE_STEP));
    const rows = Math.max(1, Math.round(r.h / RIPPLE_STEP));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++)
        drawRipple(g, r.x + ((i + 0.5) * r.w) / cols, r.y + ((j + 0.5) * r.h) / rows);
    }
  }
  g.stroke(inkStroke(palette, w * 0.6, FAR_ALPHA));
  for (const r of isles) {
    const m = ISLET_MARGIN;
    const ground = { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
    softRect(g, ground, () => true)
      .fill(palette.background)
      .stroke(inkStroke(palette, w));
  }
  for (const s of bridges) {
    const r = water.find((rect) => inRect(rect, s.x, s.y));
    if (r) drawBridge(g, s, r, bridgeRadius, palette, w);
  }
}
