// The Part 2 valleys' ground in color and depth (spec 7.3, 11.1): a sky at the valley's hour, far
// hills fading into it, a sea valley's sun and open sea, land from hazy far off to rich near with
// grass thickening toward the foot, still pools, paved lanes and squares, and reed beds whose stems
// stand behind and before the birds in them. Every mark is drawn in code (ADR 0010). Part 1's
// meadow has no depth and keeps its own ground.
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
const LAND_BANDS = 40;
/**
 * Without a ground of its own, the floor hazes this far toward the horizon's color at the horizon,
 * and darkens this far toward ink at the scene's foot, so the near ground is heavier.
 */
const LAND_HAZE = 0.5;
const NEAR_SHADE = 0.2;
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

/** The valley floor's middle color: the palette's land, or the page. */
const landOf = (palette: Palette): number => palette.land ?? palette.background;

/** The sky's top and its horizon, the horizon tinted by the accent; the page without a sky. */
export function skyOf(palette: Palette): { top: number; horizon: number } {
  const sky = palette.sky ?? { top: palette.background, horizon: palette.background };
  return { top: sky.top, horizon: mix(sky.horizon, palette.accent, ACCENT_SKY) };
}

/** Horizontal bands from y0 to y1 across [x, x + width], each the color `at(u)` for u from 0 at y0 to 1 at y1. */
function bands(
  g: Graphics,
  x: number,
  width: number,
  y0: number,
  y1: number,
  n: number,
  at: (u: number) => number,
): void {
  const step = (y1 - y0) / n;
  // Each band overlaps the next by a unit, so no seam shows between them.
  for (let i = 0; i < n; i++) g.rect(x, y0 + i * step, width, step + 1).fill(at((i + 0.5) / n));
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

/**
 * A lane narrows toward the horizon more steeply than a body shrinks (the square of the depth),
 * as a road on the ground runs away from the eye.
 */
const laneDepth = (scene: SceneData, y: number): number => depthAt(scene, y) ** 2;

const stoneOf = (palette: Palette): number =>
  mix(mix(palette.background, palette.warmth, STONE_WARM), palette.ink, STONE_SHADE);

/** A paved lane: a stone strip, much narrower toward the horizon, with ink edges and rows of cobbles. */
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
    const half = (PAVED_WIDTH * laneDepth(scene, cy)) / 2;
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
      const s = laneDepth(scene, cy);
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

/** The floor's colors: hazy at the horizon (`far`), the palette's land, and rich at the foot (`near`). */
function groundOf(palette: Palette): { far: number; mid: number; near: number } {
  const mid = landOf(palette);
  const own = palette.ground ?? {
    far: mix(mid, skyOf(palette).horizon, LAND_HAZE),
    near: mix(mid, palette.ink, NEAR_SHADE),
  };
  return { far: own.far, mid, near: own.near };
}

/**
 * The floor's color at depth u: 0 at the horizon, 1 at the foot, u the square root of the share of
 * the way down, so the color turns quickly over the far ground, which lies foreshortened.
 */
function groundAt(c: ReturnType<typeof groundOf>, u: number): number {
  return u < 0.5 ? mix(c.far, c.mid, 2 * u) : mix(c.mid, c.near, 2 * u - 1);
}

/** Grass marks over a valley's floor: this many in all, in this many groups by depth. */
const GRASS_MARKS = 320;
const GRASS_GROUPS = 5;
/** The farthest this many groups are low sweeps; the rest are tufts of these blades [tip x, height]. */
const FLAT_GROUPS = 2;
const BLADES: readonly (readonly [number, number])[] = [
  [-9, 8],
  [-3, 13],
  [2, 14],
  [8, 9],
];
/** Grass is the floor's color this far toward the leaf, then toward ink by its depth. */
const GRASS_LEAF = 0.4;

/**
 * Grass over the floor from `top` to the foot, the same on every load: more marks toward the foot,
 * each larger there, and each group darker and less faint than the one above it, so the near
 * ground is thick with grass and the far ground fades into the haze.
 */
function drawGrass(g: Graphics, scene: SceneData, top: number, palette: Palette, w: number): void {
  const { width, height } = scene;
  const horizon = scene.depth?.horizon ?? top;
  const c = groundOf(palette);
  const rnd = stream(width * 31 + height * 7 + top);
  const groups: number[][] = Array.from({ length: GRASS_GROUPS }, () => []);
  for (let i = 0; i < GRASS_MARKS; i++) {
    // Skewed toward the foot: more marks nearer the viewer.
    const v = rnd() ** 0.6;
    groups[Math.min(GRASS_GROUPS - 1, Math.floor(v * GRASS_GROUPS))]?.push(
      width * rnd(),
      top + (height - top) * v,
      rnd(),
    );
  }
  groups.forEach((marks, k) => {
    const v = (k + 0.5) / GRASS_GROUPS;
    for (let i = 0; i + 2 < marks.length; i += 3) {
      const [x, y, r] = [marks[i] ?? 0, marks[i + 1] ?? 0, marks[i + 2] ?? 0];
      const s = 0.4 + 0.9 * ((y - top) / (height - top));
      if (k < FLAT_GROUPS) {
        // Far off, grass is a low sweep along the ground.
        const len = (14 + 10 * r) * s;
        g.moveTo(x - len / 2, y).quadraticCurveTo(x, y - 3 * s, x + len / 2, y);
        continue;
      }
      // Near, a tuft: blades from one root, curving out, the middle ones tallest.
      for (const [dx, h] of BLADES) {
        const tip = h * s * (0.8 + 0.4 * r);
        g.moveTo(x, y).quadraticCurveTo(x + dx * s * 0.3, y - tip * 0.6, x + dx * s, y - tip);
      }
    }
    const y = top + (height - top) * v;
    const tone = groundAt(c, Math.sqrt(Math.max(0, (y - horizon) / (height - horizon))));
    g.stroke({
      color: mix(mix(tone, palette.leaf, GRASS_LEAF), palette.ink, 0.3 + 0.25 * v),
      width: w * (0.15 + 0.2 * v),
      alpha: 0.2 + 0.45 * v,
      cap: 'round',
      join: 'round',
    });
  });
}

/** The sun's glow: this many rings out to this radius, each this faint, about a disc this wide. */
const SUN_RINGS = 24;
const SUN_GLOW = 340;
const SUN_RING_ALPHA = 0.06;
const SUN_DISC = 16;
/** The sun's light: white, this far toward the accent (Halcyon's soft white-gold). */
const SUN_GOLD = 0.3;
const sunOf = (palette: Palette): number => mix(palette.paper, palette.accent, SUN_GOLD);

/** The sun at (x, y): a pale disc in a soft glow that fades out over the sky. */
function drawSun(g: Graphics, [x, y]: readonly [number, number], palette: Palette): void {
  const sun = sunOf(palette);
  for (let i = 0; i < SUN_RINGS; i++) {
    const k = (SUN_RINGS - i) / SUN_RINGS;
    g.circle(x, y, SUN_DISC + (SUN_GLOW - SUN_DISC) * k * k).fill({ color: sun, alpha: SUN_RING_ALPHA });
  }
  g.circle(x, y, SUN_DISC).fill(mix(palette.paper, palette.accent, SUN_GOLD / 3));
}

/** A sea's colors: the palette's own, or its water with the sky in it; and the glitter's light. */
function seaOf(palette: Palette): { deep: number; shallow: number; sand: number; glint: number } {
  const water = waterOf(palette);
  const own = palette.sea ?? {
    deep: water.near,
    shallow: water.far,
    sand: mix(landOf(palette), palette.warmth, 0.6),
  };
  return { ...own, glint: mix(palette.paper, palette.accent, SUN_GOLD / 2) };
}

/**
 * The sun's glow mirrored in calm water under x, from y0 (far) to y1 (near): a soft column that
 * widens from `w0` to `w1`, and glitter on it, rows of short bright dashes that lie closer
 * together far off and grow longer near.
 */
function drawSunPath(
  g: Graphics,
  x: number,
  [y0, y1]: readonly [number, number],
  [w0, w1]: readonly [number, number],
  palette: Palette,
  w: number,
): void {
  const sun = sunOf(palette);
  const n = 12;
  const step = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    const half = (w0 + ((w1 - w0) * (i + 0.5)) / n) / 2;
    for (const k of [1, 0.8, 0.6, 0.4, 0.2])
      g.rect(x - half * k, y0 + i * step, 2 * half * k, step + 0.5).fill({ color: sun, alpha: 0.08 });
  }
  const rnd = stream(x * 7 + y0 * 13 + y1);
  const rows = Math.max(3, Math.round((y1 - y0) / 6));
  for (let j = 0; j < rows; j++) {
    const u = ((j + 0.5) / rows) ** 1.5;
    const y = y0 + (y1 - y0) * u;
    const half = (w0 + (w1 - w0) * u) / 2;
    const dashes = 2 + Math.floor(3 * rnd());
    for (let d = 0; d < dashes; d++) {
      const cx = x + (2 * rnd() - 1) * half * 0.75;
      const len = (5 + 22 * u) * (0.6 + 0.8 * rnd()) * (w0 / 60) ** 0.3;
      g.moveTo(cx - len / 2, y).lineTo(cx + len / 2, y);
    }
  }
  g.stroke({ color: seaOf(palette).glint, width: w * 0.35, alpha: 0.9, cap: 'round' });
}

/**
 * A few long, faint ripple lines across calm water in `r`, closer together toward its far (top)
 * edge and thinner there, broken into long runs with gaps.
 */
function drawRipples(g: Graphics, r: Rect, n: number, color: number, w: number): void {
  const rnd = stream(r.x * 3 + r.y * 11 + r.h);
  for (let k = 0; k < n; k++) {
    const u = ((k + 0.6) / n) ** 1.7;
    const y = r.y + r.h * u;
    let x = r.x - 80 * rnd();
    while (x < r.x + r.w) {
      const len = r.w * (0.12 + 0.22 * rnd());
      g.moveTo(Math.max(r.x, x), y).lineTo(Math.min(r.x + r.w, x + len), y);
      x += len + 40 + 160 * rnd();
    }
    g.stroke({ color, width: w * (0.12 + 0.2 * u), alpha: 0.35 + 0.25 * u, cap: 'round' });
  }
}

/**
 * A strip of sand `depth` deep between land and water across [x, x + width], from the waterline at
 * y toward the land (`toward` 1 down, -1 up): dry sand that fades into the land over its outer
 * part, wet sand darker at the water, and a thin foam line on the waterline.
 */
function drawShore(
  g: Graphics,
  x: number,
  width: number,
  y: number,
  depth: number,
  toward: 1 | -1,
  palette: Palette,
): void {
  const c = seaOf(palette);
  /** The band from `a` to `b` units away from the waterline, toward the land, as [top y, height]. */
  const band = (a: number, b: number): [number, number] => [toward > 0 ? y + a : y - b, b - a];
  const solid = depth * 0.6;
  const [sy, sh] = band(0, solid);
  g.rect(x, sy, width, sh).fill(c.sand);
  const fade = 5;
  for (let i = 0; i < fade; i++) {
    const [fy, fh] = band(solid + ((depth - solid) * i) / fade, solid + ((depth - solid) * (i + 1)) / fade);
    g.rect(x, fy, width, fh + 0.5).fill({ color: c.sand, alpha: 1 - (i + 0.5) / fade });
  }
  const [wy, wh] = band(0, depth * 0.22);
  g.rect(x, wy, width, wh).fill(mix(c.sand, c.deep, 0.22));
  g.rect(x, y - 0.6, width, 1.2).fill({ color: palette.paper, alpha: 0.8 });
}

/** The far sea's ripples, and the near water's. */
const FAR_RIPPLES = 6;
const NEAR_RIPPLES = 5;
/** The sun's path is this wide at the sea's horizon and at its shore, and across the near water. */
const PATH_FAR: readonly [number, number] = [50, 190];
const PATH_NEAR: readonly [number, number] = [300, 380];
/** The sand narrows toward the horizon with the square of the depth, as a lane does. */
const shoreAt = (scene: SceneData, sea: NonNullable<SceneData['sea']>, y: number): number =>
  sea.shore * depthAt(scene, y) ** 2;

/**
 * The open sea from its horizon to the shore at `shoreline`: deep blue-green far out to the
 * shallows' tint at the shore, the sun's glow mirrored down it, ripple lines closer together
 * toward the horizon, and a crisp horizon line.
 */
function drawFarSea(
  g: Graphics,
  scene: SceneData,
  sea: NonNullable<SceneData['sea']>,
  shoreline: number,
  palette: Palette,
  w: number,
): void {
  const c = seaOf(palette);
  const r = { x: 0, y: sea.horizon, w: scene.width, h: shoreline - sea.horizon };
  bands(g, 0, r.w, r.y, shoreline, 16, (u) => mix(c.deep, c.shallow, u ** 1.4));
  drawSunPath(g, sea.sun[0], [r.y, shoreline], PATH_FAR, palette, w);
  drawRipples(g, r, FAR_RIPPLES, mix(c.shallow, palette.paper, 0.55), w);
  g.rect(0, r.y - 0.75, r.w, 1.5).fill(mix(c.deep, palette.ink, 0.25));
}

/**
 * A valley's ground, the layer behind everything, for a scene with depth: the sky from its top to
 * the horizon (and a sea valley's sun and open sea), the far hills filled in a tone that fades
 * toward the horizon's color the farther they are (aerial perspective), the floor from hazy far
 * off to rich near, grass that thickens toward the foot, then pools, lanes, squares, tufts, and
 * each reed bed's floor and back stems.
 */
export function drawValleyGround(g: Graphics, scene: SceneData, palette: Palette, w: number): void {
  const depth = scene.depth;
  if (!depth) return;
  const { width, height } = scene;
  const horizon = depth.horizon;
  const sea = scene.sea;
  const sky = skyOf(palette);
  g.clear().rect(0, 0, width, height).fill(palette.background);
  const skyline = sea ? sea.horizon : horizon;
  bands(g, 0, width, 0, skyline + 2, SKY_BANDS, (u) => mix(sky.top, sky.horizon, u * u));
  if (sea) drawSun(g, sea.sun, palette);
  // The floor in bands that lie closer together far off, so each step of color is as small.
  const c = groundOf(palette);
  const range = height - horizon;
  for (let i = 0; i < LAND_BANDS; i++) {
    const y0 = horizon + range * (i / LAND_BANDS) ** 2;
    const y1 = horizon + range * ((i + 1) / LAND_BANDS) ** 2;
    g.rect(0, y0, width, y1 - y0 + 1).fill(groundAt(c, (i + 0.5) / LAND_BANDS));
  }
  if (sea) drawFarSea(g, scene, sea, horizon, palette, w);
  const tone = mix(mix(palette.leaf, sky.top, 0.5), palette.ink, HILL_TONE);
  const last = scene.hills.length - 1;
  scene.hills.forEach((hill, i) => {
    // The first hill is the farthest. Over a sea, a hill stands on its lower end: a headland
    // that runs down to the shore, or an island on the sea's horizon.
    const fade = Math.min(0.9, HILL_NEAR_FADE + HILL_FADE_STEP * (last - i));
    const n = hill.length;
    const foot = sea ? Math.max(hill[1] ?? 0, hill[n - 1] ?? 0) : horizon + 2;
    smoothLine(g, hill)
      .lineTo(hill[n - 2] ?? width, foot)
      .lineTo(hill[0] ?? 0, foot)
      .closePath()
      .fill(mix(tone, sky.horizon, fade));
    smoothLine(g, hill).stroke(inkStroke(palette, w * 0.5, HILL_LINE_ALPHA * (1 - fade / 2)));
  });
  const shore = sea ? shoreAt(scene, sea, horizon) : 0;
  if (sea) drawShore(g, 0, width, horizon, shore, 1, palette);
  drawGrass(g, scene, horizon + shore, palette, w);
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

/**
 * Calm water for a scene with depth, painted over a water rectangle after its fill: the shallows'
 * light tint at its far (top) edge, by the shore, deepening toward the viewer, ripple lines closer
 * together far off, and in a sea valley the sun's glitter path and a strip of sand above it,
 * between the land and the water (the bank's faint line still shows at the waterline).
 */
export function drawWaterSurface(g: Graphics, r: Rect, scene: SceneData, palette: Palette, w: number): void {
  const c = seaOf(palette);
  bands(g, r.x, r.w, r.y, r.y + r.h, 16, (u) => mix(c.shallow, c.deep, 0.55 * u));
  const sea = scene.sea;
  if (sea) drawSunPath(g, sea.sun[0], [r.y, r.y + r.h], PATH_NEAR, palette, w);
  drawRipples(g, r, NEAR_RIPPLES, mix(c.shallow, palette.paper, 0.6), w);
  if (sea) drawShore(g, r.x, r.w, r.y - w / 4, shoreAt(scene, sea, r.y), -1, palette);
}
