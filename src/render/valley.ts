// The Part 2 valleys' ground in color and depth (spec 7.3, 11.1): a sky at the valley's hour, far
// hills fading into it, land that hazes toward the horizon, still pools, paved lanes and squares,
// and reed beds whose stems stand behind and before the birds in them. Every mark is drawn in code
// (ADR 0010). Part 1's meadow has no depth and keeps its own ground.
import type { Graphics } from 'pixi.js';
import type { Rect } from '../sim/types.ts';
import { inkStroke, smoothClosed, smoothLine, TUFT_ALPHA } from './ink.ts';
import { bodyColor as mix } from './line/fill.ts';
import type { Palette } from './palette.ts';
import { depthAt, type SceneData } from './scene.ts';

/** The accent tints the sky at the horizon, and the water, this far (spec 7.3: never text). */
const ACCENT_SKY = 0.22;
const ACCENT_WATER = 0.12;
/** Bands per gradient: fine enough that no step shows. */
const SKY_BANDS = 32;
const LAND_BANDS = 28;
/** The land hazes toward the horizon color this much at the horizon, and is clear this far below it. */
const LAND_HAZE = 0.5;
const HAZE_DEPTH = 320;
/** The land darkens this much toward ink at the scene's foot, so the near ground is heavier. */
const NEAR_SHADE = 0.05;
/** Hills: the nearest is mixed this far from the hill tone toward the horizon, each farther one more. */
const HILL_NEAR_FADE = 0.3;
const HILL_FADE_STEP = 0.2;
/**
 * The hill tone: the leaf half toward the sky's top, then this far toward ink, so the hills stand
 * against the horizon's glow as soft green-grey silhouettes.
 */
const HILL_TONE = 0.18;
/** Hill outlines: ink at this alpha for the nearest, fainter for farther ones. */
const HILL_LINE_ALPHA = 0.3;

/** The valley floor's color near the viewer: the palette's land, or the page. */
const landOf = (palette: Palette): number => palette.land ?? palette.background;

/** The sky's top and its horizon, the horizon tinted by the accent; the page without a sky. */
export function skyOf(palette: Palette): { top: number; horizon: number } {
  const sky = palette.sky ?? { top: palette.background, horizon: palette.background };
  return { top: sky.top, horizon: mix(sky.horizon, palette.accent, ACCENT_SKY) };
}

/** Horizontal bands from y0 to y1, each the color `at(u)` for u from 0 at y0 to 1 at y1. */
function bands(
  g: Graphics,
  width: number,
  y0: number,
  y1: number,
  n: number,
  at: (u: number) => number,
): void {
  const step = (y1 - y0) / n;
  // Each band overlaps the next by a unit, so no seam shows between them.
  for (let i = 0; i < n; i++) g.rect(0, y0 + i * step, width, step + 1).fill(at((i + 0.5) / n));
}

/** A small seeded random stream in [0, 1), so a bed grows the same stems on every load. */
function stream(seed: number): () => number {
  let s = Math.floor(seed) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

type Bed = SceneData['beds'][number];
/** One reed: its foot, height, lean (x shift at the tip per unit of height), and what it carries. */
type Stem = { x: number; y: number; h: number; lean: number; head: boolean; blade: -1 | 0 | 1 };
/** Stems with feet this far forward of the bed's center, as a share of ry, stand before the birds. */
export const REED_FRONT = 0.35;
/** A bed's front keeps every this-many-th stem only, so the birds behind still show. */
const FRONT_EVERY = 2;

/**
 * A bed's stems in back-to-front order: feet spread evenly over its oval, heights from half to all
 * of `height` (times the depth there), a slight lean each, outward at the sides, a cattail head on
 * some and a leaf blade on others.
 */
function stemsOf(bed: Bed, scene: Pick<SceneData, 'depth' | 'height'>): Stem[] {
  const rnd = stream(bed.x * 7919 + bed.y * 104729 + bed.stems);
  const out: Stem[] = [];
  for (let i = 0; i < bed.stems; i++) {
    const a = 2 * Math.PI * rnd();
    const r = Math.sqrt(rnd());
    const x = bed.x + bed.rx * r * Math.cos(a);
    const y = bed.y + bed.ry * r * Math.sin(a);
    const roll = rnd();
    out.push({
      x,
      y,
      h: bed.height * (0.5 + 0.5 * rnd()) * depthAt(scene, y),
      lean: (rnd() - 0.5) * 0.35 + (x - bed.x) / bed.rx / 10,
      head: roll < 0.4,
      blade: roll > 0.6 ? (rnd() < 0.5 ? -1 : 1) : 0,
    });
  }
  return out.sort((p, q) => p.y - q.y);
}

/** True when a stem stands before the birds in its bed. */
const inFront = (bed: Bed, s: Stem, i: number): boolean =>
  s.y >= bed.y + REED_FRONT * bed.ry && i % FRONT_EVERY === 0;

/**
 * The bed's stems behind its birds (`front` false) or before them (`front` true). A stem is a
 * tapered blade from its foot, colored from the back tone at the bed's back rim to the front tone
 * at its front rim; some carry a brown cattail head and some a leaf blade curving out.
 */
export function drawStems(
  g: Graphics,
  bed: Bed,
  scene: Pick<SceneData, 'depth' | 'height'>,
  palette: Palette,
  w: number,
  front: boolean,
): void {
  const tones = palette.reeds ?? { back: palette.leaf, front: palette.leaf, head: palette.ink };
  const stems = stemsOf(bed, scene);
  const outline = inkStroke(palette, w * 0.16, front ? 0.5 : 0.22);
  if (!front) {
    // Behind the stems, a thicket of fine dark stalks, so the bed reads as dense.
    for (const s of stems) {
      g.moveTo(s.x + 3, s.y - 2).quadraticCurveTo(
        s.x + 3 - s.lean * s.h * 0.2,
        s.y - s.h * 0.5,
        s.x + 3 - s.lean * s.h * 0.6,
        s.y - s.h * 0.92,
      );
    }
    g.stroke({ color: tones.back, width: 1.4, alpha: 0.7, cap: 'round' });
  }
  stems.forEach((s, i) => {
    if (inFront(bed, s, i) !== front) return;
    const u = Math.min(1, Math.max(0, (s.y - (bed.y - bed.ry)) / (2 * bed.ry)));
    const tone = mix(tones.back, tones.front, u);
    const k = s.h / bed.height;
    const base = 2.4 * Math.max(0.6, k) + 0.6;
    const tipX = s.x + s.lean * s.h;
    const tipY = s.y - s.h;
    const midX = s.x + s.lean * s.h * 0.35;
    const midY = s.y - s.h * 0.55;
    if (s.blade !== 0) {
      // A leaf blade, from the foot out and over.
      const d = s.blade * s.h * 0.4;
      g.moveTo(s.x - base / 2, s.y)
        .quadraticCurveTo(s.x + d * 0.3, s.y - s.h * 0.55, s.x + d, s.y - s.h * 0.62)
        .quadraticCurveTo(s.x + d * 0.35, s.y - s.h * 0.4, s.x + base / 2, s.y)
        .closePath()
        .fill(mix(tone, tones.back, 0.25));
    }
    g.moveTo(s.x - base / 2, s.y)
      .quadraticCurveTo(midX - base / 3, midY, tipX, tipY)
      .quadraticCurveTo(midX + base / 3, midY, s.x + base / 2, s.y)
      .closePath()
      .fill(tone)
      .stroke(outline);
    if (s.head) {
      // A cattail: a brown head a little below the tip, the stem's spike above it.
      const hx = s.x + s.lean * s.h * 0.82;
      const hy = s.y - s.h * 0.8;
      g.ellipse(hx, hy, 2.6 * k + 1, 7 * k + 2)
        .fill(tones.head)
        .stroke(outline);
    }
  });
}

/** The ground under a bed: a damp patch, darker toward its middle, so the clump stands in the marsh. */
function drawBedFloor(g: Graphics, bed: Bed, palette: Palette): void {
  const tones = palette.reeds ?? { back: palette.leaf, front: palette.leaf, head: palette.ink };
  const damp = mix(landOf(palette), tones.back, 0.5);
  for (const k of [1.15, 0.95, 0.75])
    g.ellipse(bed.x, bed.y + bed.ry * 0.1, bed.rx * k, bed.ry * k * 0.9).fill({ color: damp, alpha: 0.22 });
}

/** Water with the sky in it: the horizon's glow on its far side, the sky's top near, and a light glint. */
const waterOf = (palette: Palette): { near: number; far: number; glint: number } => {
  const sky = skyOf(palette);
  const water = mix(palette.water, palette.accent, ACCENT_WATER);
  return {
    far: mix(water, sky.horizon, 0.5),
    near: mix(water, sky.top, 0.45),
    glint: mix(palette.paper, palette.accent, 0.25),
  };
};

/** A still pool's outline: an oval with a gently uneven bank, the same on every load. */
function poolShape(x: number, y: number, rx: number, ry: number): number[] {
  const rnd = stream(x * 131 + y * 7);
  const p: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (2 * Math.PI * i) / 10;
    const r = 0.86 + 0.24 * rnd();
    p.push(x + rx * r * Math.cos(a), y + ry * r * Math.sin(a));
  }
  return p;
}

/**
 * A still pool: a damp rim, water with the sky in it (the horizon's glow on its far half), a
 * faint bank line, and soft light reflection lines across it.
 */
function drawPool(g: Graphics, [x, y, rx, ry]: readonly number[], palette: Palette, w: number): void {
  const water = waterOf(palette);
  const [px, py, prx, pry] = [x ?? 0, y ?? 0, rx ?? 1, ry ?? 1];
  const damp = mix(landOf(palette), palette.ink, 0.12);
  smoothClosed(g, poolShape(px, py + 2, prx * 1.08, pry * 1.25)).fill({ color: damp, alpha: 0.35 });
  const shape = poolShape(px, py, prx, pry);
  smoothClosed(g, shape).fill(water.near);
  g.ellipse(px, py - pry * 0.3, prx * 0.8, pry * 0.5).fill({ color: water.far, alpha: 0.85 });
  smoothClosed(g, shape).stroke(inkStroke(palette, w * 0.3, 0.35));
  g.moveTo(px - prx * 0.55, py - pry * 0.15)
    .lineTo(px + prx * 0.3, py - pry * 0.15)
    .moveTo(px - prx * 0.15, py + pry * 0.3)
    .lineTo(px + prx * 0.45, py + pry * 0.3)
    .stroke({ color: water.glint, width: w * 0.3, alpha: 0.85, cap: 'round' });
}

/** Paving: the page this far toward the warm tint, and darker by this much toward ink. */
const STONE_WARM = 0.75;
const STONE_SHADE = 0.08;
/** A lane is this wide at the depth reference. */
const PAVED_WIDTH = 46;
/** Cobble rows lie this far apart along a lane at the reference. */
const COBBLE_STEP = 22;

const stoneOf = (palette: Palette): number =>
  mix(mix(palette.background, palette.warmth, STONE_WARM), palette.ink, STONE_SHADE);

/** A paved lane: a stone strip, narrower toward the horizon, with ink edges and rows of cobbles. */
function drawLane(g: Graphics, lane: readonly number[], scene: SceneData, palette: Palette, w: number): void {
  const n = lane.length / 2;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const dx = (lane[b * 2] ?? 0) - (lane[a * 2] ?? 0);
    const dy = (lane[b * 2 + 1] ?? 0) - (lane[a * 2 + 1] ?? 0);
    const len = Math.hypot(dx, dy) || 1;
    const [cx, cy] = [lane[i * 2] ?? 0, lane[i * 2 + 1] ?? 0];
    const half = (PAVED_WIDTH * depthAt(scene, cy)) / 2;
    left.push(cx - (dy / len) * half, cy + (dx / len) * half);
    right.unshift(cx + (dy / len) * half, cy - (dx / len) * half);
  }
  const stone = stoneOf(palette);
  const outline = [...left, ...right];
  smoothClosed(g, outline).fill(stone);
  // Cobbles: short arcs across the lane, a row every step along it, smaller toward the horizon.
  const cobble = inkStroke(palette, w * 0.22, 0.28);
  let carry = 0;
  for (let i = 0; i + 1 < n; i++) {
    const [x0, y0, x1, y1] = [
      lane[i * 2] ?? 0,
      lane[i * 2 + 1] ?? 0,
      lane[i * 2 + 2] ?? 0,
      lane[i * 2 + 3] ?? 0,
    ];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const [ux, uy] = [(x1 - x0) / len, (y1 - y0) / len];
    let d = carry;
    while (d < len) {
      const [cx, cy] = [x0 + ux * d, y0 + uy * d];
      const s = depthAt(scene, cy);
      const half = (PAVED_WIDTH * s) / 2;
      for (const t of [-0.6, 0, 0.6]) {
        const [bx, by] = [cx - uy * half * t, cy + ux * half * t];
        const r = 6 * s;
        g.moveTo(bx - uy * r - ux * r * 0.4, by + ux * r - uy * r * 0.4).quadraticCurveTo(
          bx + ux * r * 0.6,
          by + uy * r * 0.6,
          bx + uy * r - ux * r * 0.4,
          by - ux * r - uy * r * 0.4,
        );
      }
      d += COBBLE_STEP * s;
    }
    carry = d - len;
  }
  g.stroke(cobble);
  smoothClosed(g, outline).stroke(inkStroke(palette, w * 0.4, 0.5));
}

/** A paved square: a stone oval with an ink rim and rings of setts. */
function drawSquare(g: Graphics, [x, y, rx, ry]: readonly number[], palette: Palette, w: number): void {
  const [sx, sy, srx, sry] = [x ?? 0, y ?? 0, rx ?? 1, ry ?? 1];
  g.ellipse(sx, sy, srx, sry)
    .fill(stoneOf(palette))
    .stroke(inkStroke(palette, w * 0.4, 0.5));
  for (const k of [0.78, 0.55, 0.32]) g.ellipse(sx, sy, srx * k, sry * k);
  g.stroke(inkStroke(palette, w * 0.22, 0.25));
  for (let i = 0; i < 16; i++) {
    const a = (2 * Math.PI * i) / 16;
    g.moveTo(sx + srx * 0.32 * Math.cos(a), sy + sry * 0.32 * Math.sin(a)).lineTo(
      sx + srx * Math.cos(a),
      sy + sry * Math.sin(a),
    );
  }
  g.stroke(inkStroke(palette, w * 0.18, 0.18));
}

/** A tuft of grass, sized to its depth. */
function drawTuft(g: Graphics, x: number, y: number, s: number): void {
  g.moveTo(x - 6 * s, y)
    .lineTo(x - 9 * s, y - 8 * s)
    .moveTo(x, y)
    .lineTo(x, y - 11 * s)
    .moveTo(x + 6 * s, y)
    .lineTo(x + 9 * s, y - 8 * s);
}

/**
 * A valley's ground, the layer behind everything, for a scene with depth: the sky from its top to
 * the horizon, the far hills filled in a tone that fades toward the horizon's color the farther
 * they are (aerial perspective), the land hazed near the horizon and heavier near the foot, then
 * pools, lanes, squares, tufts, and each reed bed's floor and back stems.
 */
export function drawValleyGround(g: Graphics, scene: SceneData, palette: Palette, w: number): void {
  const depth = scene.depth;
  if (!depth) return;
  const { width, height } = scene;
  const horizon = depth.horizon;
  const sky = skyOf(palette);
  g.clear().rect(0, 0, width, height).fill(palette.background);
  bands(g, width, 0, horizon + 2, SKY_BANDS, (u) => mix(sky.top, sky.horizon, u * u));
  const land = landOf(palette);
  const haze = mix(land, sky.horizon, LAND_HAZE);
  bands(g, width, horizon, horizon + HAZE_DEPTH, LAND_BANDS, (u) => mix(haze, land, u));
  const shade = mix(land, palette.ink, NEAR_SHADE);
  bands(g, width, horizon + HAZE_DEPTH, height, LAND_BANDS, (u) => mix(land, shade, u));
  const tone = mix(mix(palette.leaf, sky.top, 0.5), palette.ink, HILL_TONE);
  const last = scene.hills.length - 1;
  scene.hills.forEach((hill, i) => {
    // The first hill is the farthest.
    const fade = Math.min(0.9, HILL_NEAR_FADE + HILL_FADE_STEP * (last - i));
    const n = hill.length;
    smoothLine(g, hill)
      .lineTo(hill[n - 2] ?? width, horizon + 2)
      .lineTo(hill[0] ?? 0, horizon + 2)
      .closePath()
      .fill(mix(tone, sky.horizon, fade));
    smoothLine(g, hill).stroke(inkStroke(palette, w * 0.5, HILL_LINE_ALPHA * (1 - fade / 2)));
  });
  for (const pool of scene.pools) drawPool(g, pool, palette, w);
  for (const lane of scene.lanes) drawLane(g, lane, scene, palette, w);
  for (const square of scene.squares) drawSquare(g, square, palette, w);
  for (const [x, y] of scene.tufts) drawTuft(g, x, y, depthAt(scene, y));
  g.stroke(inkStroke(palette, w * 0.7, TUFT_ALPHA));
  for (const bed of scene.beds) {
    drawBedFloor(g, bed, palette);
    drawStems(g, bed, scene, palette, w, false);
  }
}

/** The shore's soft reflection reaches this far into calm water, in scene units. */
const SHORE_REFLECTION = 22;

/**
 * Calm water for a scene with depth, painted over a water rectangle after its fill: the sky's
 * horizon glow at its far (top) edge deepening to the sky's top color near, the shore's soft
 * reflection just under the far bank, and soft light streaks across it, a still sky in it.
 */
export function drawWaterSurface(g: Graphics, r: Rect, palette: Palette, w: number): void {
  const water = waterOf(palette);
  const n = 16;
  const step = r.h / n;
  for (let i = 0; i < n; i++)
    g.rect(r.x, r.y + i * step, r.w, step + 1).fill(mix(water.far, water.near, (i + 0.5) / n));
  const shore = mix(landOf(palette), palette.leaf, 0.5);
  const m = 6;
  const reach = Math.min(SHORE_REFLECTION, r.h / 2);
  for (let i = 0; i < m; i++)
    g.rect(r.x, r.y + (i * reach) / m, r.w, reach / m + 1).fill({ color: shore, alpha: 0.5 * (1 - i / m) });
  const streaks = stream(r.x * 31 + r.y * 17 + r.w);
  for (let i = 0; i < Math.round(r.w / 60); i++) {
    const y = r.y + r.h * (0.12 + 0.8 * streaks() ** 1.5);
    const x = r.x + r.w * streaks();
    const len = (30 + 90 * streaks()) * (1 - (y - r.y) / r.h / 2);
    g.moveTo(x - len / 2, y).lineTo(x + len / 2, y);
  }
  g.stroke({ color: water.glint, width: w * 0.4, alpha: 0.75, cap: 'round' });
}
