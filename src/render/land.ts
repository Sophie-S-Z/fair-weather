// The land on the Meadow's ground: water, the islets it closes in, and the bridges over it.
import type { Graphics } from 'pixi.js';
import type { Deck } from '../sim/land.ts';
import type { Rect } from '../sim/types.ts';
import { FAR_ALPHA, inkStroke, TUFT_ALPHA } from './ink.ts';
import type { Palette } from './palette.ts';

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

/** True when (x, y) is in `r`, edges included: sim/land.ts inRect, which render may not import (spec 14.2). */
export const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** A bridge's deck in paper with an ink outline, and planks across the way it is crossed. */
function drawBridge(g: Graphics, deck: Deck, palette: Palette, w: number): void {
  g.rect(deck.x, deck.y, deck.w, deck.h).fill(palette.paper).stroke(inkStroke(palette, w));
  const { eastWest } = deck;
  const [from, to] = eastWest ? [deck.x, deck.x + deck.w] : [deck.y, deck.y + deck.h];
  for (let u = from + PLANK_STEP; u < to - PLANK_STEP / 2; u += PLANK_STEP) {
    if (eastWest) g.moveTo(u, deck.y).lineTo(u, deck.y + deck.h);
    else g.moveTo(deck.x, u).lineTo(deck.x + deck.w, u);
  }
  g.stroke(inkStroke(palette, w * 0.5, TUFT_ALPHA));
}

/**
 * Water corners round off this much where no other water meets them. An islet's ground is drawn
 * this much past its edge, so its bank line lies on the water and all of the land shows.
 */
const WATER_CORNER = 14;
const ISLET_MARGIN = 5;

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
 * The water, its islets, and the bridge decks over it, all from the snapshot (the sim's own): flat
 * on the ground, under everything that stands. An islet (ground that water closes in) is filled as
 * water first, so the pond is one shape. Each piece is outlined at twice the line width and then
 * filled, so where pieces meet their outlines are covered and one bank line runs round the whole
 * water. A corner rounds off unless other water touches it or it lies on the scene's edge. Each
 * islet is then drawn as its own patch of ground with a bank line, out on the water a little.
 * `surface`, when given, paints over each water rectangle after its fill, inside its round corners
 * (a valley's calm water).
 */
export function drawLand(
  g: Graphics,
  water: readonly Rect[],
  decks: readonly Deck[],
  isles: readonly Rect[],
  palette: Palette,
  w: number,
  scene: { width: number; height: number },
  surface?: (g: Graphics, r: Rect) => void,
): void {
  g.clear();
  // Water that runs off the scene stays square there, so a brook flows on past the page.
  const onEdge = (x: number, y: number): boolean => x <= 0 || y <= 0 || x >= scene.width || y >= scene.height;
  const pond = [...water, ...isles];
  const rounds = (r: Rect) => (x: number, y: number) =>
    !onEdge(x, y) && !pond.some((o) => o !== r && inRect(o, x, y));
  const shapes = pond.map((r) => (piece: Graphics) => softRect(piece, r, rounds(r)));
  for (const shape of shapes) shape(g).stroke(inkStroke(palette, 2 * w));
  for (const shape of shapes) shape(g).fill(palette.water);
  if (surface) {
    // Inside the round corners: in from each side that has a round corner.
    for (const r of water) {
      const round = rounds(r);
      const [x0, y0, x1, y1] = [r.x, r.y, r.x + r.w, r.y + r.h];
      const left = round(x0, y0) || round(x0, y1) ? WATER_CORNER : 0;
      const right = round(x1, y0) || round(x1, y1) ? WATER_CORNER : 0;
      const top = round(x0, y0) || round(x1, y0) ? WATER_CORNER : 0;
      const bottom = round(x0, y1) || round(x1, y1) ? WATER_CORNER : 0;
      const inner = { x: x0 + left, y: y0 + top, w: r.w - left - right, h: r.h - top - bottom };
      if (inner.w > 0 && inner.h > 0) surface(g, inner);
    }
  }
  // Calm water (a surface) has no ripples.
  if (!surface) {
    for (const r of water) {
      const cols = Math.max(1, Math.round(r.w / RIPPLE_STEP));
      const rows = Math.max(1, Math.round(r.h / RIPPLE_STEP));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++)
          drawRipple(g, r.x + ((i + 0.5) * r.w) / cols, r.y + ((j + 0.5) * r.h) / rows);
      }
    }
    g.stroke(inkStroke(palette, w * 0.6, FAR_ALPHA));
  }
  for (const r of isles) {
    const m = ISLET_MARGIN;
    const ground = { x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m };
    softRect(g, ground, () => true)
      .fill(palette.background)
      .stroke(inkStroke(palette, w));
  }
  for (const deck of decks) drawBridge(g, deck, palette, w);
}
