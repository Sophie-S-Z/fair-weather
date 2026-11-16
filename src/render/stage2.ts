// The Stage 2 valleys drawn from the snapshot's pack (ADR 0015 items 3 to 5): Foglight's terraces
// and the veil past the hero's sight, the council's stakes and its rain cloud, and the Shallows'
// lily pads and each frog's songs. Placeholder art in the scenery's line (ADR 0010).
import type { Graphics } from 'pixi.js';
import type { Song } from '../sim/types.ts';
import type { WorldLite } from '../sim-host/protocol.ts';
import { inkStroke } from './ink.ts';
import type { Palette } from './palette.ts';

type PackOf<Id extends string> = Extract<NonNullable<WorldLite['pack']>, { id: Id }>;

/** Ink alpha on the lowest ground, falling to 0 at the meadow: low land reads darker. */
const LOW_SHADE = 0.12;
const CONTOUR_ALPHA = 0.22;
const MEADOW_ALPHA = 0.45;
/** The veil past the hero's sight: paper at this alpha. */
const VEIL_ALPHA = 0.5;

/** The side of one height cell in scene units, from the map's columns and the scene's width. */
const cellOf = (f: PackOf<'foglight'>, width: number): number => width / f.cols;

/**
 * Foglight's terraces: each cell shaded by its height, the meadow in the leaf color, and a
 * contour line on each edge between two heights.
 */
export function drawTerraces(
  g: Graphics,
  f: PackOf<'foglight'>,
  width: number,
  palette: Palette,
  w: number,
): void {
  const size = cellOf(f, width);
  const rows = f.heights.length / f.cols;
  const at = (c: number, r: number): number => f.heights[r * f.cols + c] ?? 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      const h = at(c, r);
      if (h >= f.meadow)
        g.rect(c * size, r * size, size, size).fill({ color: palette.leaf, alpha: MEADOW_ALPHA });
      else
        g.rect(c * size, r * size, size, size).fill({
          color: palette.ink,
          alpha: LOW_SHADE * (1 - h / f.meadow),
        });
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      if (c + 1 < f.cols && at(c, r) !== at(c + 1, r))
        g.moveTo((c + 1) * size, r * size).lineTo((c + 1) * size, (r + 1) * size);
      if (r + 1 < rows && at(c, r) !== at(c, r + 1))
        g.moveTo(c * size, (r + 1) * size).lineTo((c + 1) * size, (r + 1) * size);
    }
  }
  g.stroke(inkStroke(palette, w * 0.6, CONTOUR_ALPHA));
}

/** The cell (column, row) under (x, y) on Foglight's map. */
export function cellUnder(f: PackOf<'foglight'>, width: number, x: number, y: number): [number, number] {
  const size = cellOf(f, width);
  const rows = f.heights.length / f.cols;
  const clamp = (v: number, n: number): number => Math.min(n - 1, Math.max(0, Math.floor(v / size)));
  return [clamp(x, f.cols), clamp(y, rows)];
}

/** The veil over every cell more than `steps` cells from the hero's (col, row): the hero's short sight. */
export function drawVeil(
  g: Graphics,
  f: PackOf<'foglight'>,
  width: number,
  [col, row]: [number, number],
  steps: number,
  palette: Palette,
): void {
  const size = cellOf(f, width);
  const rows = f.heights.length / f.cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < f.cols; c++) {
      if (Math.max(Math.abs(c - col), Math.abs(r - row)) > steps) g.rect(c * size, r * size, size, size);
    }
  }
  g.fill({ color: palette.paper, alpha: VEIL_ALPHA });
}

const STAKE_HEIGHT = 40;
const CLOUD_LIFT = 90;

/**
 * The council's stakes: a post with a flag at each spot, the hero's vote in the accent, and the
 * rain cloud over the last winner, with rain falling to its stake.
 */
export function drawCouncil(g: Graphics, c: PackOf<'council'>, palette: Palette, w: number): void {
  const ink = inkStroke(palette, w);
  for (const s of c.spots) {
    const top = s.y - STAKE_HEIGHT;
    g.moveTo(s.x, s.y).lineTo(s.x, top).stroke(ink);
    g.poly([s.x, top, s.x + 18, top + 6, s.x, top + 12])
      .fill(s.id === c.heroVote ? palette.accent : palette.paper)
      .stroke(inkStroke(palette, w * 0.8));
  }
  const win = c.spots.find((s) => s.id === c.winner);
  if (!win) return;
  const y = win.y - CLOUD_LIFT;
  for (const [dx, dy, r] of [
    [-20, 4, 16],
    [0, -6, 20],
    [22, 4, 15],
  ] as const)
    g.circle(win.x + dx, y + dy, r);
  g.fill(palette.paper).stroke(inkStroke(palette, w * 0.8));
  for (const dx of [-16, -4, 8, 20]) g.moveTo(win.x + dx, y + 24).lineTo(win.x + dx - 4, y + 40);
  g.stroke(inkStroke(palette, w * 0.6, 0.6));
}

const PAD_RX = 58;
const PAD_RY = 24;

/** The Shallows' lily pads: a leaf ellipse with a notch cut toward the viewer. */
export function drawPads(g: Graphics, s: PackOf<'shallows'>, palette: Palette, w: number): void {
  for (const p of s.pads) {
    const pts: number[] = [];
    // From the notch round the far side and back: the gap is a 30° wedge at the front.
    const start = Math.PI / 2 + Math.PI / 12;
    const end = Math.PI / 2 - Math.PI / 12 + 2 * Math.PI;
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const a = start + ((end - start) * i) / n;
      pts.push(p.x + PAD_RX * Math.cos(a), p.y + PAD_RY * Math.sin(a));
    }
    pts.push(p.x, p.y);
    g.poly(pts)
      .fill(palette.leaf)
      .stroke(inkStroke(palette, w * 0.8));
  }
}

/** A song mark's backing disc, and the glyph's half height inside it. */
const MARK_RADIUS = 9;
const GLYPH = 5;

/**
 * One song's mark, centered on (x, y), on a paper disc so it reads over a body: the reed song a
 * stem with a head, the rain song a drop, the old song a curl.
 */
function drawSongMark(g: Graphics, song: Song, x: number, y: number, palette: Palette, w: number): void {
  const ink = inkStroke(palette, w * 0.7);
  g.circle(x, y, MARK_RADIUS)
    .fill(palette.paper)
    .stroke(inkStroke(palette, w * 0.5, 0.5));
  const k = GLYPH;
  if (song === 'reed') {
    g.moveTo(x, y + k)
      .lineTo(x, y - k * 0.4)
      .stroke(ink);
    g.ellipse(x, y - k * 0.5, k * 0.35, k * 0.7).fill(palette.ink);
  } else if (song === 'rain') {
    g.moveTo(x, y - k)
      .quadraticCurveTo(x + k, y + k * 0.3, x, y + k)
      .quadraticCurveTo(x - k, y + k * 0.3, x, y - k)
      .fill(palette.water)
      .stroke(ink);
  } else {
    g.moveTo(x + k, y)
      .arc(x, y, k, 0, 1.6 * Math.PI)
      .stroke(ink);
    g.moveTo(x + k * 0.5, y)
      .arc(x, y, k * 0.5, 0, Math.PI)
      .stroke(ink);
  }
}

const MARK_GAP = 2 * MARK_RADIUS + 2;

/** The marks of every song in `songs`, side by side, centered on (x, y). */
export function drawSongs(
  g: Graphics,
  songs: readonly Song[],
  x: number,
  y: number,
  palette: Palette,
  w: number,
): void {
  songs.forEach((song, i) => {
    drawSongMark(g, song, x + (i - (songs.length - 1) / 2) * MARK_GAP, y, palette, w);
  });
}
