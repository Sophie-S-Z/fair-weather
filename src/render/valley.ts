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

/**
 * Paving lies flat on the ground plane, seen by an eye whose vanishing line stands this far above
 * the horizon (so a lane narrows toward the horizon but never closes to a point), looking down so
 * that at the scene's foot a stone shows this tall for its width.
 */
const PAVE_LEAD = 60;
const PAVE_TILT = 0.6;
/** A lane is this wide on the ground (scene units at the foot), and its stones lie in rows this long. */
const LANE_WIDTH = 140;
const STONE_LENGTH = 44;
/** A row shows at least this long, so the far stones become a fine texture, not a crowd of specks. */
const ROW_MIN = 4;
/** A stone's mortar gap, as a share of a stone's length, per unit of line width (high contrast widens it). */
const MORTAR_GAP = 0.012;
/**
 * Stone is the warm tint this far toward the near ground (the valley's own earth), then this far
 * toward ink; mortar and the worn verge are darker by these.
 */
const STONE_EARTH = 0.35;
const STONE_SHADE = 0.16;
const MORTAR_SHADE = 0.16;
const VERGE_SHADE = 0.3;
/** The verge reaches this far past a lane's edge, as a share of its half-width. */
const VERGE = 0.14;
/** Stone hazes this far toward the far ground at the horizon. */
const STONE_HAZE = 0.5;
/** A lane's mortar is laid in runs of this many stations, each hazed for its depth. */
const MORTAR_RUN = 6;
/** A square is paved in this many rings. */
const SQUARE_RINGS = 6;

/** How much smaller a thing on the ground shows at scene y than at the scene's foot. */
function planeScale(scene: SceneData, y: number): number {
  const vy = (scene.depth?.horizon ?? 0) - PAVE_LEAD;
  return Math.max(1e-3, (y - vy) / (scene.height - vy));
}

/** Ground-plane coordinates: x across and z away from the eye, in scene units at the foot. */
function planeOf(scene: SceneData): {
  toGround: (x: number, y: number) => [number, number];
  toScreen: (gx: number, gz: number) => [number, number];
} {
  const vy = (scene.depth?.horizon ?? 0) - PAVE_LEAD;
  const foot = scene.height - vy;
  const cx = scene.width / 2;
  return {
    toGround: (x, y) => {
      const k = planeScale(scene, y);
      return [(x - cx) / k, foot / (PAVE_TILT * k)];
    },
    toScreen: (gx, gz) => {
      const k = foot / (PAVE_TILT * gz);
      return [cx + gx * k, vy + foot * k];
    },
  };
}

/** Points along smoothLine's curve through p, `n` per bend. */
function smoothPoints(p: readonly number[], n: number): number[] {
  const at = (i: number): number => p[i] ?? 0;
  const out = [at(0), at(1)];
  let [x0, y0] = [at(0), at(1)];
  for (let k = 2; k + 3 < p.length; k += 2) {
    const [cx, cy, x1, y1] = [at(k), at(k + 1), (at(k) + at(k + 2)) / 2, (at(k + 1) + at(k + 3)) / 2];
    for (let i = 1; i <= n; i++) {
      const [t, u] = [i / n, 1 - i / n];
      out.push(u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1);
    }
    [x0, y0] = [x1, y1];
  }
  out.push(at(p.length - 2), at(p.length - 1));
  return out;
}

/**
 * A lane laid flat on the ground: `at(s, t)` is the scene point `s` along it on the ground (from
 * its first point) and `t` across it (-1 at one edge, 1 at the other); `stations` are the
 * distances along it of its centerline's points.
 */
export type GroundLane = {
  length: number;
  stations: number[];
  at: (s: number, t: number) => [number, number];
};

const ORIGIN = [0, 0] as const;

export function groundLane(scene: SceneData, lane: readonly number[]): GroundLane {
  const plane = planeOf(scene);
  const pts = smoothPoints(lane, 8);
  const c: [number, number][] = [];
  const stations: number[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const q = plane.toGround(pts[i] ?? 0, pts[i + 1] ?? 0);
    const last = c.at(-1);
    stations.push(last ? (stations.at(-1) ?? 0) + Math.hypot(q[0] - last[0], q[1] - last[1]) : 0);
    c.push(q);
  }
  const n = c.length;
  // Each point's normal on the ground, from its neighbors.
  const normals = c.map((_, i) => {
    const [a, b] = [c[Math.max(0, i - 1)] ?? ORIGIN, c[Math.min(n - 1, i + 1)] ?? ORIGIN];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len] as const;
  });
  const length = stations.at(-1) ?? 0;
  const half = LANE_WIDTH / 2;
  return {
    length,
    stations,
    at: (s, t) => {
      const d = Math.min(length, Math.max(0, s));
      let i = 0;
      while (i < n - 2 && (stations[i + 1] ?? 0) < d) i++;
      const [s0, s1] = [stations[i] ?? 0, stations[i + 1] ?? 1];
      const f = s1 > s0 ? (d - s0) / (s1 - s0) : 0;
      const [p, q] = [c[i] ?? ORIGIN, c[i + 1] ?? ORIGIN];
      const [m, o] = [normals[i] ?? ORIGIN, normals[i + 1] ?? ORIGIN];
      const [nx, nz] = [m[0] + (o[0] - m[0]) * f, m[1] + (o[1] - m[1]) * f];
      const nl = Math.hypot(nx, nz) || 1;
      return plane.toScreen(
        p[0] + (q[0] - p[0]) * f + (nx / nl) * t * half,
        p[1] + (q[1] - p[1]) * f + (nz / nl) * t * half,
      );
    },
  };
}

const stoneOf = (palette: Palette): number =>
  mix(mix(palette.warmth, groundOf(palette).near, STONE_EARTH), palette.ink, STONE_SHADE);

/**
 * One flat stone over [u0, u1] x [v0, v1] in a paving's own coordinates, through `map` to the
 * scene: a four-sided slab with slightly rounded corners, each corner pulled in a little at random
 * (by up to du, dv) so the mortar gaps run uneven.
 */
function drawStone(
  g: Graphics,
  map: (u: number, v: number) => [number, number],
  [u0, u1, v0, v1]: readonly [number, number, number, number],
  [du, dv]: readonly [number, number],
  rnd: () => number,
): Graphics {
  const corners = [
    [u0 + du * rnd(), v0 + dv * rnd()],
    [u1 - du * rnd(), v0 + dv * rnd()],
    [u1 - du * rnd(), v1 - dv * rnd()],
    [u0 + du * rnd(), v1 - dv * rnd()],
  ] as const;
  const p: number[] = [];
  corners.forEach(([pu, pv], i) => {
    const [qu, qv] = corners[(i + 1) % 4] ?? [pu, pv];
    for (const f of [0, 1 / 3, 2 / 3]) p.push(...map(pu + (qu - pu) * f, pv + (qv - pv) * f));
  });
  return smoothClosed(g, p);
}

/** A color at scene y hazed toward the far ground, more the nearer the horizon. */
function hazeAt(color: number, far: number, scene: SceneData, y: number): number {
  const horizon = scene.depth?.horizon ?? 0;
  const u = Math.min(1, Math.max(0, (y - horizon) / (scene.height - horizon)));
  return mix(color, far, STONE_HAZE * (1 - u) ** 2);
}

/** A few blades of grass leaning over an edge at (x, y), `s` the scale there. */
function drawEdgeTuft(g: Graphics, x: number, y: number, s: number, color: number, rnd: () => number): void {
  for (const [dx, h] of BLADES) {
    const tip = h * s * (0.7 + 0.5 * rnd());
    g.moveTo(x - 1.2 * s, y)
      .quadraticCurveTo(x + dx * s * 0.3, y - tip * 0.6, x + dx * s, y - tip)
      .lineTo(x + 1.2 * s, y)
      .closePath();
  }
  g.fill({ color, alpha: 0.8 });
}

/**
 * The valley's lanes and squares as one paved surface lying flat on the ground: under it a soft,
 * darker worn verge; then mortar, and on it flat stones in rows across each lane (rows closer
 * together and stones smaller toward the horizon, as the ground runs away) and in rings round each
 * square; a faint lighter line of wear down each lane; and grass leaning over the lanes' edges.
 * Nothing on it is outlined.
 */
function drawPaving(g: Graphics, scene: SceneData, palette: Palette, w: number): void {
  const lanes = scene.lanes.map((l) => groundLane(scene, l));
  const stone = stoneOf(palette);
  const mortar = mix(stone, palette.ink, MORTAR_SHADE);
  const verge = mix(stone, palette.ink, VERGE_SHADE);
  const c = groundOf(palette);
  const rnd = stream(scene.width * 13 + scene.height * 17 + lanes.length);
  /** A stone's color at y: a little lighter or darker at random, and hazed far off. */
  const tone = (y: number): number => {
    const v = 2 * rnd() - 1;
    return hazeAt(
      v > 0 ? mix(stone, palette.paper, 0.3 * v) : mix(stone, palette.ink, -0.08 * v),
      c.far,
      scene,
      y,
    );
  };
  /** The lane between stations i and j, from t0 to t1 across, its edges a little ragged. */
  const band = (
    lane: GroundLane,
    [i, j]: readonly [number, number],
    t0: number,
    t1: number,
    ragged: number,
  ) => {
    const st = lane.stations.slice(i, j + 1);
    return g.poly([
      ...st.flatMap((s) => lane.at(s, t0 - ragged * rnd())),
      ...st.toReversed().flatMap((s) => lane.at(s, t1 + ragged * rnd())),
    ]);
  };
  const whole = (lane: GroundLane): [number, number] => [0, lane.stations.length - 1];
  for (const lane of lanes)
    for (const k of [1, 0.5])
      band(lane, whole(lane), -1 - VERGE * k, 1 + VERGE * k, 0.05).fill({ color: verge, alpha: 0.3 });
  for (const [x, y, rx, ry] of scene.squares)
    for (const k of [1, 0.5])
      g.ellipse(x, y, rx * (1 + VERGE * k * 0.3), ry * (1 + VERGE * k * 0.4)).fill({
        color: verge,
        alpha: 0.3,
      });
  // Each stone stands this far (on the ground, at the foot) inside its share of the paving.
  const seam = (MORTAR_GAP * w * STONE_LENGTH) / 2;
  for (const lane of lanes) {
    // Mortar in short runs, each hazed for its depth; each run overlaps the next by a station.
    for (let i = 0; i + 1 < lane.stations.length; i += MORTAR_RUN) {
      const run = [i, Math.min(lane.stations.length - 1, i + MORTAR_RUN + 1)] as const;
      band(lane, run, -1, 1, 0).fill(hazeAt(mortar, c.far, scene, lane.at(lane.stations[i] ?? 0, 0)[1]));
    }
    for (let s = 0, row = 0; s < lane.length - 1; row++) {
      const [x0, y0] = lane.at(s, 0);
      const [x1, y1] = lane.at(s + STONE_LENGTH, 0);
      const step = Math.min(
        lane.length - s,
        STONE_LENGTH * Math.max(1, ROW_MIN / (Math.hypot(x1 - x0, y1 - y0) || 1)),
      );
      const [ds, dt] = [(seam * step) / STONE_LENGTH, (seam * 2) / LANE_WIDTH];
      // Rows in a running bond: three stones across, then two with a half stone at each edge.
      const joints = row % 2 ? [-1, -0.66, 0, 0.66, 1] : [-1, -0.33, 0.33, 1];
      const across = joints.map((j, i) =>
        i === 0 || i === joints.length - 1 ? j : j + 0.12 * (rnd() - 0.5),
      );
      for (let i = 0; i + 1 < across.length; i++) {
        const [v0, v1] = [(across[i] ?? 0) + dt, (across[i + 1] ?? 0) - dt];
        const y = lane.at(s + step / 2, (v0 + v1) / 2)[1];
        drawStone(g, lane.at, [s + ds, s + step - ds, v0, v1], [ds * 1.5, dt * 1.5], rnd).fill(tone(y));
      }
      s += step;
    }
    for (const t of [0.3, 0.15])
      band(lane, whole(lane), -t, t, 0.05).fill({ color: palette.paper, alpha: 0.07 });
  }
  for (const [x, y, rx, ry] of scene.squares) {
    g.ellipse(x, y, rx, ry).fill(hazeAt(mortar, c.far, scene, y));
    const map = (r: number, a: number): [number, number] => [
      x + rx * r * Math.cos(a),
      y + ry * r * Math.sin(a),
    ];
    // Rings of stones round a middle stone, more to a ring the farther out it lies.
    const dr = (seam * planeScale(scene, y)) / rx;
    for (let k = 0; k < SQUARE_RINGS; k++) {
      const [r0, r1] = [k / SQUARE_RINGS, (k + 1) / SQUARE_RINGS];
      const mid = (r0 + r1) / 2;
      const n = k === 0 ? 1 : Math.round(2 * Math.PI * mid * SQUARE_RINGS * 0.7);
      const turn = rnd() * 2 * Math.PI;
      const da = (2 * Math.PI) / n;
      for (let i = 0; i < n; i++) {
        const a0 = turn + i * da;
        const box = [k === 0 ? 0 : r0 + dr, r1 - dr, a0 + dr / mid, a0 + da - dr / mid] as const;
        drawStone(g, map, box, [dr * 1.5, (dr * 1.5) / mid], rnd).fill(tone(map(mid, a0 + da / 2)[1]));
      }
    }
  }
  // Grass leaning over the lanes' edges here and there, but not where a lane runs into a square.
  const horizon = scene.depth?.horizon ?? 0;
  for (const lane of lanes)
    for (let s = rnd() * STONE_LENGTH; s < lane.length; s += STONE_LENGTH * (0.6 + 1.4 * rnd())) {
      const [x, y] = lane.at(s, (rnd() < 0.5 ? -1 : 1) * (1 + 0.04 * rnd()));
      const inSquare = scene.squares.some(
        ([qx, qy, qrx, qry]) => ((x - qx) / qrx) ** 2 + ((y - qy) / qry) ** 2 < 1.3,
      );
      const u = Math.max(0, (y - horizon) / (scene.height - horizon));
      if (inSquare || u < 0.12) continue;
      const grass = mix(
        mix(groundAt(c, Math.sqrt(u)), palette.leaf, GRASS_LEAF),
        palette.ink,
        0.3 + 0.25 * u,
      );
      drawEdgeTuft(g, x, y, 0.3 + 0.9 * u, grass, rnd);
    }
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
/** The sand narrows toward the horizon with the square of the depth. */
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
  drawPaving(g, scene, palette, w);
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
