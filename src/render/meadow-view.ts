import { Container, Graphics, type Application } from 'pixi.js';
import type { Structure } from '../sim/types.ts';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Settings } from '../ui/settings.ts';
import { lerpTransform, toScene, toScreen, viewTransform, type Shot, type ViewTransform } from './camera.ts';
import type { Cast } from './cast.ts';
import { createWash } from './effects/fog.ts';
import { createLight } from './effects/light.ts';
import { FAR_ALPHA, HIGH_CONTRAST_WIDTH, inkStroke, smoothClosed, smoothLine, TUFT_ALPHA } from './ink.ts';
import { drawLand, inRect } from './land.ts';
import { bodyColor, fillOutline } from './line/fill.ts';
import { createLineView } from './line/line-view.ts';
import { rigFor, type Rig } from './line/rig.ts';
import type { Palette } from './palette.ts';
import { depthAt, interpolateCreatures, type DrawnCreature, type SceneData } from './scene.ts';
import {
  drawFlier,
  drawOutlineReflection,
  drawPerched,
  drawPerchedReflection,
  PERCHED_HEIGHT,
  type StarlingLook,
} from './starling.ts';
import { drawStems, drawValleyGround, drawWaterSurface, REED_FRONT } from './valley.ts';

/** A villager's height in scene units. Other bodies are sized to a villager's area (see bodyHeight). */
export const CREATURE_HEIGHT = 64;
/** The rig for every creature that has no rig of its own, and the size reference. */
export const VILLAGER_RIG = 'villager';
/** Area sizing stays within these factors, so a thin ribbon does not grow huge. */
const AREA_FACTOR_MIN = 0.85;
const AREA_FACTOR_MAX = 1.5;
/** The focus creature's body is this far from paper toward the accent, more with shell color (spec 11.1). */
const FOCUS_MIX = 0.55;
const FOCUS_MIX_COLOR = 0.35;
/** Sway: a small rock about the feet, in radians, and its period in seconds (spec 11.2). */
export const SWAY_ANGLE = 0.04;
const SWAY_SECONDS = 3;
/** How fast the camera closes on a new shot, per second. */
const CAMERA_RATE = 3;
/** Scenery line width in scene units. */
const SCENERY_WIDTH = 6;
/** A dancing creature hops this high, in scene units, once every this many seconds. */
export const HOP_HEIGHT = 7;
const HOP_SECONDS = 0.5;
/** The heat map grid over the scene, and the alpha of its most watched cell. */
const HEAT_COLS = 16;
const HEAT_ROWS = 9;
const HEAT_ALPHA = 0.4;
/** The keyboard cursor's ink ring, in scene units. */
const CURSOR_RADIUS = 16;
/**
 * Murmuration Fen (spec 7.3: a sky full of small dark marks). A starling with no rig of its own is
 * a small bird drawn in code (starling.ts), `BIRD` scene units per bird unit at the depth
 * reference: on the ground a bird seen from the side, facing a way its id sets, fanned up to
 * `GROUND_SPREAD` units across and `GROUND_SPREAD_Y` up or down about its feet so a tight bed
 * reads as its birds; in flight a
 * bird with swept wings, spread over the scene's sky band above its place on the ground, where it
 * drifts `DRIFT` units about its place once every `DRIFT_SECONDS`, slowly, so reduced motion keeps
 * it. A flier is drawn at the horizon's depth, between `FLIER_MIN` and `FLIER_MIN + FLIER_RANGE`
 * of a grounded bird's size there by its id.
 */
const STARLING = 'starling';
const BIRD = 1.05;
const FLIER_MIN = 0.85;
const FLIER_RANGE = 0.35;
/** A starling's ink outline, in bird units, and its reflection's tint toward the body and alpha. */
const BIRD_LINE = 0.9;
const REFLECT_TINT = 0.45;
const REFLECT_ALPHA = 0.5;
const DRIFT = 24;
const DRIFT_SECONDS = 30;
/** A flying flock spreads this wide about its birds' places on the ground. */
const SPREAD = 200;
const GROUND_SPREAD = 40;
const GROUND_SPREAD_Y = 22;
/**
 * A grounded bird reaches this far each side of its feet, in bird units; one that overlaps a body
 * and stands nearer is drawn this far in the shared layer's order before that body.
 */
const BIRD_REACH = 21;
const NEAR_STEP = 0.5;
/**
 * The reflection (ADR 0007): under each grounded starling, Tove included, whose perceived share is
 * at least `REFLECT_AT`, its body flipped in the water under its feet (under its shadow, `REFLECT_GAP`
 * below it, for a body with a rig), faint and water-tinted.
 */
const REFLECT_AT = 0.5;
const REFLECT_GAP = 2;
/** A starling's colors and line widths in this palette, at `widthScale` (high contrast thickens its line). */
function starlingLook(palette: Palette, widthScale: number): StarlingLook {
  const plumage = palette.plumage ?? { body: palette.ink, sheen: palette.paper };
  return {
    body: plumage.body,
    sheen: plumage.sheen,
    ink: palette.ink,
    paper: palette.paper,
    rim: palette.land ?? palette.background,
    water: bodyColor(palette.water, plumage.body, REFLECT_TINT),
    waterAlpha: REFLECT_ALPHA,
    line: BIRD_LINE * widthScale,
  };
}
/** A body with a rig of its own (Tove, the joined hero) flies this far above its shadow. */
const FLY_LIFT = 48;
/** The Hollow's press: a structure of kind bench with this id (ADR 0013 item 17), drawn as a press. */
const PRESS = 'press';
const PRESS_SCALE = 1.3;
/** A lane's two faint edges stand this far apart, in scene units (Part 1; a valley paves its lanes). */
const LANE_WIDTH = 30;
/** A square's outline has this many points. */
const SQUARE_POINTS = 32;
/**
 * A shadow at each creature's feet: an ink ellipse this wide and tall, as shares of its body
 * height, at this alpha (more in high contrast), so its feet read as on the ground. The sim's bank
 * keeps it off the water (tests/unit/render/bank.test.ts); on a bridge deck it lies on the deck.
 */
export const SHADOW_WIDTH = 0.9;
export const SHADOW_HEIGHT = 0.24;
const SHADOW_ALPHA = 0.3;
const SHADOW_ALPHA_HIGH_CONTRAST = 0.45;
const SHADOW_POINTS = 12;
/**
 * The Quiet Visitor (spec 6.4, ADR 0012 item 12) is drawn only: its rig, its walk speed in scene
 * units a second, how long it sits, and how far above a bench's feet it sits.
 */
const VISITOR_RIG = 'visitor';
export const VISITOR_SPEED = 50;
export const VISITOR_SIT_SECONDS = 20;
const SEAT_LIFT = 10;
/** The feather lies this far to the right of the seat. */
const FEATHER_OFFSET = 30;
/** A visit moves on at most this many seconds a frame, so a stalled or hidden page does not skip it. */
const VISIT_STEP_MAX = 0.25;

export interface MeadowView {
  update(prev: WorldLite, next: WorldLite, alpha: number, settings: Settings): void;
  /** The creature under a screen point, or null. */
  pick(x: number, y: number): string | null;
  /** The scene point under a screen point, through the camera of the last update. */
  toScene(x: number, y: number): [number, number];
  /** The screen point over a scene point, through the camera of the last update. */
  toScreen(x: number, y: number): [number, number];
  /** The creature the current beat is about: the only one drawn in the accent (spec 11.1). */
  setFocus(id: string | null): void;
  /** A camera shot from the scene's `cameras`, or null for the whole scene. */
  setShot(name: string | null): void;
  /** The screen pixels at the top that the scene keeps clear of (the Cosmos timeline band); 0 for none. */
  setTopInset(px: number): void;
  /** Redraws everything in a season's or a valley's colors. */
  setPalette(p: Palette): void;
  /** Redraws the ground and trees from `scene`, whose bench spots and camera shots are used from now on. */
  setScene(scene: SceneData): void;
  /**
   * Counts a live snapshot's lens center for the heat map. The caller passes each snapshot as it
   * arrives, so frames skipped at high speed still count and rewound or peeked worlds never do.
   */
  countLens(lite: WorldLite): void;
  /** Shows where the lens stayed this chapter. Turning it off clears the count, for the next chapter. */
  showHeatmap(on: boolean): void;
  /** The keyboard cursor, a still ink ring at a scene point, or null to hide it. */
  setCursor(p: { x: number; y: number } | null): void;
  /**
   * The Quiet Visitor walks in from the gate to the bench nearest it (or to the nearest bench spot,
   * where it sits on the grass), sits 20 seconds with a feather beside it, and walks out; with
   * reduced motion it shows seated, then is gone. It walks only on drawn frames, so a hidden or
   * stalled page does not skip it. Resolves when it has gone. It never enters the sim, and pick
   * never finds it.
   */
  visitor(): Promise<void>;
  /** Ends a visit under way, or one asked for, at once: the visitor and its feather go, and it resolves. */
  endVisit(): void;
}

/** The area inside a rig's outline, in rig units (loops cut out, as for the body fill). */
export function rigArea(rig: Rig): number {
  const p = fillOutline(rig.points);
  let twice = 0;
  for (let k = 0; k + 1 < p.length; k += 2) {
    const j = (k + 2) % p.length;
    twice += (p[k] ?? 0) * (p[j + 1] ?? 0) - (p[j] ?? 0) * (p[k + 1] ?? 0);
  }
  return Math.abs(twice) / 2;
}

/**
 * A body's height in scene units: as tall as gives it a villager's area (clamped), times its cast
 * scale. So a round body is not drawn heavier than a thin one, and the named cast read as the stars.
 */
export function bodyHeight(rig: Rig, villagerArea: number, castScale: number): number {
  const factor = Math.sqrt(villagerArea / rigArea(rig));
  return CREATURE_HEIGHT * Math.min(Math.max(factor, AREA_FACTOR_MIN), AREA_FACTOR_MAX) * castScale;
}

/** The Quiet Visitor's shell: no tightness, bristle, color, or softness. */
const VISITOR_SHELL = { tightness: 0, bristle: 0, color: 0, softness: 0 };

type Point = { x: number; y: number };
/** The visitor's walk is checked against the water every this many scene units. */
const ROUTE_STEP = 4;
/** A seat: a bench, or a bench spot or the gate, where it sits on the grass. */
type Seat = Point & { bench: boolean };

/**
 * True when a body with its feet at `p` covers water off every deck: feet in a bank (water grown by
 * the sim's bank, from the snapshot) and on no deck. The sim's rule for creatures (ADR 0012 item 3).
 */
const overWater = (p: Point, land: Pick<WorldLite, 'banks' | 'decks'>): boolean =>
  land.banks.some((b) => inRect(b, p.x, p.y)) && !land.decks.some((d) => inRect(d, p.x, p.y));

/**
 * The visitor's walk from `from` to `seat` as points, never over water off a deck: straight, or
 * else along one bridge deck from end to end (the shortest such), or null when neither is clear.
 */
function route(from: Point, seat: Point, land: Pick<WorldLite, 'banks' | 'decks'>): Point[] | null {
  const clear = (a: Point, b: Point): boolean => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / ROUTE_STEP);
    for (let i = 0; i <= n; i++) {
      const u = n === 0 ? 0 : i / n;
      if (overWater({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, land)) return false;
    }
    return true;
  };
  if (clear(from, seat)) return [from, seat];
  let best: Point[] | null = null;
  for (const d of land.decks) {
    // The deck's center line, end to end; its ends rest on clear ground past the bank.
    const ends: [Point, Point] = d.eastWest
      ? [
          { x: d.x, y: d.y + d.h / 2 },
          { x: d.x + d.w, y: d.y + d.h / 2 },
        ]
      : [
          { x: d.x + d.w / 2, y: d.y },
          { x: d.x + d.w / 2, y: d.y + d.h },
        ];
    for (const [a, b] of [ends, [ends[1], ends[0]] as const]) {
      const path = [from, a, b, seat];
      if (clear(from, a) && clear(b, seat) && (!best || pathLength(path) < pathLength(best))) best = path;
    }
  }
  return best;
}

/** True when rank `a` comes before rank `b`: at their first difference, `a` is smaller. */
function before(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return (a[i] ?? 0) < (b[i] ?? 0);
  return false;
}

const pathLength = (path: readonly Point[]): number =>
  path.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - (path[i]?.x ?? 0), p.y - (path[i]?.y ?? 0)), 0);

/** The point `dist` scene units along `path`. */
function along(path: readonly Point[], dist: number): Point {
  let left = dist;
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1] as Point, path[i] as Point];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len && len > 0)
      return { x: a.x + ((b.x - a.x) * left) / len, y: a.y + ((b.y - a.y) * left) / len };
    left -= len;
  }
  return path[path.length - 1] ?? { x: 0, y: 0 };
}

/** A phase in [0, 1) from a creature id, so creatures sway out of step. */
function phaseOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h / 997;
}

/**
 * Two numbers in [0, 1) from a creature id, well mixed (FNV-1a, then a final avalanche), so
 * neighbors in id order land apart.
 */
export function placeOf(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = (h ^ (h >>> 13)) >>> 0;
  return [(h & 0xffff) / 0x10000, (h >>> 16) / 0x10000];
}

/** Square ends and sharp corners: far fewer vertices than round ones, so a small prop stays in the batch. */
const plainStroke = (palette: Palette, width: number) =>
  ({ color: palette.ink, width, cap: 'square', join: 'miter' }) as const;

/**
 * Paper, far hills, squares, lanes, and grass tufts: the layer behind everything, in scene units.
 * A scene with depth (a valley) draws its own ground in color (valley.ts).
 */
function drawGround(g: Graphics, scene: SceneData, palette: Palette, w: number): void {
  if (scene.depth) {
    drawValleyGround(g, scene, palette, w);
    return;
  }
  g.clear().rect(0, 0, scene.width, scene.height).fill(palette.background);
  for (const hill of scene.hills) smoothLine(g, hill).stroke(inkStroke(palette, w, FAR_ALPHA));
  const faint = inkStroke(palette, w * 0.6, TUFT_ALPHA);
  for (const [x, y, rx, ry] of scene.squares) oval(g, x, y, rx, ry, SQUARE_POINTS).stroke(faint);
  for (const lane of scene.lanes) {
    const edges = limbOutline(lane, LANE_WIDTH, LANE_WIDTH);
    smoothLine(g, edges.slice(0, lane.length));
    smoothLine(g, edges.slice(lane.length)).stroke(faint);
  }
  for (const [x, y] of scene.tufts) {
    g.moveTo(x - 6, y)
      .lineTo(x - 9, y - 8)
      .moveTo(x, y)
      .lineTo(x, y - 11)
      .moveTo(x + 6, y)
      .lineTo(x + 9, y - 8)
      .stroke(inkStroke(palette, w * 0.7, TUFT_ALPHA));
  }
}

/** A branch's width where it leaves the trunk and at its tip, as fractions of the trunk's girth. */
const BRANCH_BASE = 0.42;
const BRANCH_TIP = 0.14;
/** The trunk narrows to this fraction of its girth at the top, and flares this much wider at the base. */
const TRUNK_TOP = 0.42;
const TRUNK_FLARE = 0.7;
/** Canopy bumps at least this big get a leaf curl inside. */
const LEAF_CURL_MIN = 24;
/** The ground line under a tree reaches this many girths each side of the trunk. */
const GROUND_REACH = 1.6;

/**
 * The outline of a limb around its center line, as flat x, y pairs: up one side and down the
 * other, from `from` wide at the first point to `to` wide at the last. `flare` widens the first
 * point, so a trunk spreads into roots where it meets the ground.
 */
function limbOutline(line: readonly number[], from: number, to: number, flare = 0): number[] {
  const n = line.length / 2;
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const dx = (line[b * 2] ?? 0) - (line[a * 2] ?? 0);
    const dy = (line[b * 2 + 1] ?? 0) - (line[a * 2 + 1] ?? 0);
    const len = Math.hypot(dx, dy) || 1;
    const half = (from + ((to - from) * i) / Math.max(1, n - 1) + (i === 0 ? flare : 0)) / 2;
    const [cx, cy] = [line[i * 2] ?? 0, line[i * 2 + 1] ?? 0];
    left.push(cx - (dy / len) * half, cy + (dx / len) * half);
    right.unshift(cx + (dy / len) * half, cy - (dx / len) * half);
  }
  return [...left, ...right];
}

/**
 * One tree, as one Graphics: branches, then a tapered trunk that flares at its base, both paper
 * (or bark, in a valley) with ink outlines, then a canopy of overlapping leaf-colored circles.
 * Each circle is outlined, then all are filled again a line's half-width smaller, so only the
 * outer scalloped edge stays. The trunk's first point is its base.
 */
function drawTree(
  g: Graphics,
  tree: SceneData['trees'][number],
  palette: Palette,
  w: number,
  bark = palette.paper,
): void {
  g.clear();
  const ink = inkStroke(palette, w);
  for (const branch of tree.branches) {
    smoothClosed(g, limbOutline(branch, tree.girth * BRANCH_BASE, tree.girth * BRANCH_TIP))
      .fill(bark)
      .stroke(ink);
  }
  // The base points go in twice, so the outline passes through them and the trunk stands flat.
  const trunk = limbOutline(tree.trunk, tree.girth, tree.girth * TRUNK_TOP, tree.girth * TRUNK_FLARE);
  const n = trunk.length;
  smoothClosed(g, [...trunk.slice(0, 2), ...trunk, ...trunk.slice(n - 2)])
    .fill(bark)
    .stroke(ink);
  // A short ground line under the base.
  const [bx, by] = [tree.trunk[0] ?? 0, tree.trunk[1] ?? 0];
  const reach = tree.girth * GROUND_REACH;
  g.moveTo(bx - reach, by)
    .lineTo(bx + reach, by)
    .stroke(inkStroke(palette, w * 0.7, TUFT_ALPHA));
  for (const [x, y, r] of tree.canopy) g.circle(x, y, r).fill(palette.leaf).stroke(ink);
  for (const [x, y, r] of tree.canopy) g.circle(x, y, Math.max(0, r - w / 2)).fill(palette.leaf);
  // A faint curl under each big bump hints at clumps of leaves.
  for (const [x, y, r] of tree.canopy) {
    if (r < LEAF_CURL_MIN) continue;
    const c = r * 0.45;
    g.moveTo(x - c * Math.cos(0.5), y + r * 0.1 + c * Math.sin(0.5))
      .arc(x, y + r * 0.1, c, Math.PI - 0.5, 0.5, true)
      .stroke(inkStroke(palette, w * 0.6, TUFT_ALPHA));
  }
}

/** A feather lying on a seat or the grass, its quill end at the left, with its middle at (x, y). */
function drawFeather(g: Graphics, x: number, y: number, palette: Palette, w: number): void {
  g.clear()
    .moveTo(x - 14, y)
    .quadraticCurveTo(x - 3, y - 12, x + 14, y - 5)
    .quadraticCurveTo(x, y + 4, x - 14, y)
    .fill(palette.paper)
    .stroke(inkStroke(palette, w * 0.4))
    .moveTo(x - 19, y + 2)
    .lineTo(x + 14, y - 5)
    .stroke(inkStroke(palette, w * 0.4));
}

/** One bench: a seat, a back, and two legs, with its feet at (x, y). */
function drawBench(g: Graphics, { x, y }: Structure, palette: Palette, w: number): void {
  g.moveTo(x - 22, y - 10)
    .lineTo(x + 22, y - 10)
    .moveTo(x - 20, y - 20)
    .lineTo(x + 20, y - 20)
    .moveTo(x - 16, y - 10)
    .lineTo(x - 16, y)
    .moveTo(x + 16, y - 10)
    .lineTo(x + 16, y)
    .stroke(inkStroke(palette, w));
}

/** Wood (the press, a valley's bark): a brown, mixed this far toward the palette's warm tint. */
const WOOD = 0x8a6646;
const WOOD_WARMTH = 0.35;
const woodOf = (palette: Palette): number => bodyColor(WOOD, palette.warmth, WOOD_WARMTH);

/**
 * The Hollow's press (ADR 0013 item 17), with its feet at (x, y): a wooden frame of two posts on a
 * sill under a heavy head, the screw down from the head with its bar, the platen over the bed, a
 * sheet on the bed, and a printed sheet hung from the head to dry.
 */
function drawPress(g: Graphics, { x, y }: Structure, palette: Palette, w: number): void {
  const ink = plainStroke(palette, w * 0.6);
  const wood = woodOf(palette);
  // The hung sheet, behind the frame.
  g.moveTo(x + 24, y - 80)
    .lineTo(x + 48, y - 80)
    .stroke(ink);
  g.rect(x + 30, y - 80, 18, 24)
    .fill(palette.paper)
    .stroke(ink);
  for (let k = 0; k < 4; k++) g.moveTo(x + 33, y - 75 + k * 5).lineTo(x + 45 - (k % 2) * 4, y - 75 + k * 5);
  g.stroke(plainStroke(palette, w * 0.25));
  // Sill, posts, and head.
  g.rect(x - 34, y - 7, 68, 7)
    .fill(wood)
    .stroke(ink);
  g.rect(x - 28, y - 82, 9, 76)
    .fill(wood)
    .stroke(ink);
  g.rect(x + 19, y - 82, 9, 76)
    .fill(wood)
    .stroke(ink);
  g.rect(x - 36, y - 94, 72, 13)
    .fill(wood)
    .stroke(ink);
  // The screw with its thread, and the bar through it.
  g.rect(x - 4, y - 81, 8, 26)
    .fill(palette.paper)
    .stroke(ink);
  for (let k = 0; k < 5; k++) g.moveTo(x - 4, y - 78 + k * 5).lineTo(x + 4, y - 75 + k * 5);
  g.stroke(plainStroke(palette, w * 0.3));
  g.moveTo(x + 4, y - 68)
    .lineTo(x + 30, y - 74)
    .stroke(plainStroke(palette, w * 0.7));
  g.rect(x + 28, y - 78, 7, 7)
    .fill(wood)
    .stroke(ink);
  // The platen, the bed on its rails, and the sheet on the bed.
  g.rect(x - 16, y - 55, 32, 7)
    .fill(palette.paper)
    .stroke(ink);
  g.rect(x - 40, y - 36, 80, 8)
    .fill(wood)
    .stroke(ink);
  g.rect(x - 14, y - 40, 28, 4)
    .fill(palette.paper)
    .stroke(plainStroke(palette, w * 0.35));
}

/**
 * Points round a small shape's outline. Pixi gives a circle of radius r about 18 sqrt(r) points,
 * and a Graphics over 200 vertices cannot batch, so props use plain polygons and stay in the batch.
 */
const GLOW_POINTS = 16;
const DEW_POINTS = 5;
const CAP_POINTS = 12;

/** A polygon of `n` points round (x, y) on an ellipse with radii `rx` and `ry`: a cheap ellipse. */
function oval(g: Graphics, x: number, y: number, rx: number, ry: number, n: number): Graphics {
  const p: number[] = [];
  for (let i = 0; i < n; i++)
    p.push(x + rx * Math.cos((2 * Math.PI * i) / n), y + ry * Math.sin((2 * Math.PI * i) / n));
  return g.poly(p);
}

/** A regular polygon of `n` points round (x, y): a cheap circle. */
const disc = (g: Graphics, x: number, y: number, r: number, n: number): Graphics => oval(g, x, y, r, r, n);

/** A lantern's lamp height above its foot, and its glow: rings out to this radius. */
const LANTERN_HEIGHT = 40;
const GLOW_RADIUS = 30;
const GLOW_RINGS = 3;

/** One lantern: a post on a short foot, a lamp at the top, and a small warm glow round the lamp. */
function drawLantern(g: Graphics, { x, y }: Structure, palette: Palette, w: number): void {
  const top = y - LANTERN_HEIGHT;
  const glow = { color: palette.light.color, alpha: (2 * palette.light.alpha) / GLOW_RINGS };
  for (let i = GLOW_RINGS; i >= 1; i--)
    disc(g, x, top, (GLOW_RADIUS * i) / GLOW_RINGS, GLOW_POINTS).fill(glow);
  g.moveTo(x - 9, y)
    .lineTo(x + 9, y)
    .moveTo(x, y)
    .lineTo(x, top + 8)
    .stroke(plainStroke(palette, w));
  g.rect(x - 7, top - 8, 14, 16)
    .fill(palette.light.color)
    .stroke(plainStroke(palette, w * 0.8));
}

/** A bush: three leafy lobes [dx, dy, r] from its foot, and where up to five berries show. */
const BUSH_LOBES: [number, number, number][] = [
  [-11, -11, 11],
  [0, -19, 13],
  [11, -11, 11],
];
const BUSH_POINTS = 10;
const BERRY_SPOTS: [number, number][] = [
  [-11, -12],
  [2, -22],
  [11, -10],
  [-3, -11],
  [7, -19],
];
const BERRY_RADIUS = 2.6;

/** One bush in the leaf color, with an ink dot for each berry it has, up to five. */
function drawBush(g: Graphics, b: WorldLite['bushes'][number], palette: Palette, w: number): void {
  // Outlined, then filled, so only the outer edge of the lobes stays.
  for (const [dx, dy, r] of BUSH_LOBES)
    disc(g, b.x + dx, b.y + dy, r, BUSH_POINTS).stroke(plainStroke(palette, 2 * w));
  for (const [dx, dy, r] of BUSH_LOBES) disc(g, b.x + dx, b.y + dy, r, BUSH_POINTS).fill(palette.leaf);
  for (const [dx, dy] of BERRY_SPOTS.slice(0, Math.floor(b.berries))) {
    disc(g, b.x + dx, b.y + dy, BERRY_RADIUS, DEW_POINTS).fill(palette.ink);
  }
}

/** The mushroom's cap radius, stem size, and the spacing and radius of its dew dots. */
const CAP_RADIUS = 30;
const STEM_WIDTH = 14;
const STEM_HEIGHT = 18;
const DEW_STEP = 7;
const DEW_RADIUS = 3;

/** Dew is the water color, deepened this far toward ink so it shows on the cap. */
const DEW_DEPTH = 0.45;
export const dewColor = (palette: Palette): number => bodyColor(palette.water, palette.ink, DEW_DEPTH);

/** Dew spots on the cap, in rows from the rim up, as offsets from the cap's center: room for 25. */
const DEW_SPOTS: [number, number][] = [];
for (let dy = 4; dy < CAP_RADIUS - 2; dy += DEW_STEP) {
  const half = Math.sqrt(CAP_RADIUS * CAP_RADIUS - dy * dy) - 4;
  const n = Math.floor((2 * half) / DEW_STEP) + 1;
  for (let i = 0; i < n; i++) DEW_SPOTS.push([(i - (n - 1) / 2) * DEW_STEP, -dy]);
}

/** The dew mushroom: a stem, a round cap, and one blue dot on the cap per drop left today. */
function drawMushroom(
  g: Graphics,
  m: { x: number; y: number; drops: number },
  palette: Palette,
  w: number,
): void {
  const capY = m.y - STEM_HEIGHT;
  g.clear()
    .rect(m.x - STEM_WIDTH / 2, capY - 2, STEM_WIDTH, STEM_HEIGHT + 2)
    .fill(palette.paper)
    .stroke(plainStroke(palette, w));
  const cap: number[] = [];
  for (let i = 0; i <= CAP_POINTS; i++) {
    const a = Math.PI + (Math.PI * i) / CAP_POINTS;
    cap.push(m.x + CAP_RADIUS * Math.cos(a), capY + CAP_RADIUS * Math.sin(a));
  }
  g.poly(cap).fill(palette.warmth).stroke(plainStroke(palette, w));
  const dew = dewColor(palette);
  for (const [dx, dy] of DEW_SPOTS.slice(0, m.drops))
    disc(g, m.x + dx, capY + dy, DEW_RADIUS, DEW_POINTS).fill(dew);
}

/** The fog over (x, y), from the fog grid that spans `width` scene units. */
function fogUnder(fog: WorldLite['fog'], width: number, x: number, y: number): number {
  if (fog.w === 0 || fog.h === 0) return 0;
  const cell = width / fog.w;
  const col = Math.min(fog.w - 1, Math.max(0, Math.floor(x / cell)));
  const row = Math.min(fog.h - 1, Math.max(0, Math.floor(y / cell)));
  return fog.cells[row * fog.w + col] ?? 0;
}

/**
 * The Meadow view (spec 11.3): the valley and its creatures in ink and one accent, in the season's
 * or the valley's palette, over the scene it was last given. It draws snapshots only and never
 * changes the world. A creature uses its id's rig, then its species', then the villager's; in the
 * Fen a starling with no rig of its own is an ink tick, all of them in one Graphics with the
 * reflection, and a flier with a rig is lifted above its shadow; Hearsay Hollow's drama sky is
 * the lens in an accent ring, and its press is drawn as a press (spec 7.3). Water and bridges lie
 * flat on the ground; each creature's shadow lies under
 * them, or on its deck when it stands on one. Creatures, trees, benches, lanterns, and the
 * mushroom share one layer sorted by base y, so nearer things hide farther ones (spec 11.1
 * depth). Every body shows its shell color as a muted warm tint (spec 5.2); only the focus
 * creature wears the accent (spec 11.1). A creature in thick fog is drawn in dashes, and a dancing
 * one hops. The heat map counts the lens center over a 16 x 9 grid in every live snapshot and shows
 * each cell's share of the most watched cell as an ink wash. The keyboard cursor is a still ink
 * ring over everything. Reduced motion stops the boil, the sway, the hop, and camera moves, but
 * not the flock's slow drift; high contrast thickens every line by half again and darkens the
 * shadows.
 */
export function createMeadowView(
  app: Application,
  firstScene: SceneData,
  rigs: Map<string, Rig>,
  firstPalette: Palette,
  options: {
    lensRadius: number;
    cast: Map<string, Cast>;
    gate: { x: number; y: number };
  },
): MeadowView {
  let palette = firstPalette;
  let scene = firstScene;
  const world = new Container();
  const ground = new Graphics({ label: 'ground' });
  const land = new Graphics({ label: 'land' });
  const shadows = new Graphics({ label: 'shadows' });
  const deckShadows = new Graphics({ label: 'deck-shadows' });
  /** The Fen's starlings, their shadows, and the reflections, redrawn each frame. */
  const flock = new Graphics({ label: 'flock' });
  /**
   * The grounded starlings that stand nearer than a body they overlap, redrawn each frame in the
   * shared layer just before the nearest such body, so they hide its feet and not it theirs.
   */
  const flockNear = new Graphics({ label: 'flock-near' });
  const lensRing = new Graphics({ label: 'lens-ring', visible: false });
  const actors = new Container({ sortableChildren: true });
  let light = createLight(palette, options.lensRadius);
  let fog = createWash(palette.fog, scene.width);
  let heat = createWash({ color: palette.ink, alpha: HEAT_ALPHA }, scene.width, 'heatmap');
  let heatShown = false;
  heat.sprite.visible = false;
  const cursor = new Graphics({ label: 'cursor', visible: false });
  let cursorAt: { x: number; y: number } | null = null;
  /** What the ring was drawn for; '' redraws it. */
  let cursorKey = '';
  world.addChild(
    ground,
    shadows,
    land,
    deckShadows,
    flock,
    light.graphics,
    lensRing,
    actors,
    fog.sprite,
    heat.sprite,
    cursor,
  );
  app.stage.addChild(world);

  /** A thing drawn in scene units with its foot at (x, y), sized to its depth about that foot. */
  const standAt = (g: Graphics, x: number, y: number): void => {
    g.pivot.set(x, y);
    g.position.set(x, y);
    g.scale.set(depthAt(scene, y));
  };
  const plantTrees = (): { tree: SceneData['trees'][number]; g: Graphics }[] =>
    scene.trees.map((tree) => {
      const [bx, by] = [tree.trunk[0] ?? 0, tree.trunk[1] ?? 0];
      const g = new Graphics({ label: tree.id, zIndex: by });
      standAt(g, bx, by);
      actors.addChild(g);
      return { tree, g };
    });
  let trees = plantTrees();
  /**
   * Each reed bed's front stems, standing in the shared layer at the line where its front begins,
   * so its birds stand behind them and a body nearer than the bed stands before them.
   */
  const plantBeds = (): { bed: SceneData['beds'][number]; g: Graphics }[] =>
    scene.beds.map((bed, i) => {
      const g = new Graphics({ label: `reeds-${String(i)}`, zIndex: bed.y + REED_FRONT * bed.ry });
      // Batched with the bodies beside it, so a bed costs no draw call of its own.
      g.context.batchMode = 'batch';
      actors.addChild(g);
      return { bed, g };
    });
  let beds = plantBeds();
  actors.addChild(flockNear);
  /** Benches, lanterns, and bushes by id, each with the key it was drawn for. Bridges are drawn with the water. */
  const props = new Map<string, { g: Graphics; key: string }>();
  const mushroom = new Graphics({ label: 'mushroom', visible: false });
  actors.addChild(mushroom);
  let landKey = '';
  let mushroomKey = '';
  const feather = new Graphics({ label: 'feather', visible: false });
  actors.addChild(feather);
  /** What the feather was drawn for; '' redraws it. */
  let featherKey = '';
  /**
   * The visit under way: its seconds so far and the clock at its last frame, its seat, its path
   * from the gate to the seat and that path's length, and its walk each way in seconds.
   */
  let visit: {
    done: () => void;
    t: number;
    last: number;
    seat: Seat;
    path: Point[];
    length: number;
    walk: number;
  } | null = null;
  let visitAsked: (() => void) | null = null;

  const villager = rigs.get(VILLAGER_RIG);
  const villagerArea = villager ? rigArea(villager) : 1;
  const views = new Map<string, { view: ReturnType<typeof createLineView>; height: number; rig: Rig }>();
  let drawn: (DrawnCreature & { height: number })[] = [];
  let camera: ViewTransform | null = null;
  let focus: string | null = null;
  let shot: string | null = null;
  let topInset = 0;
  let lineWidth = 0;
  let look: StarlingLook = starlingLook(palette, 1);
  /** Each rig's body outline, for a reflection of a body with a rig. */
  const outlines = new Map<Rig, number[]>();
  const outlineOf = (rig: Rig): number[] => {
    let o = outlines.get(rig);
    if (!o) {
      o = fillOutline(rig.points);
      outlines.set(rig, o);
    }
    return o;
  };
  const heatCounts = new Uint32Array(HEAT_COLS * HEAT_ROWS);
  /**
   * The Fen's frame scratch, reused so the flock allocates nothing per frame: who flies; grounded
   * birds and their reflections as flat x, y, size, facing quads; fliers as flat x, y, size, lift
   * quads; the grounded birds' drawing order; and each bird's place.
   */
  const flying = new Set<string>();
  const perched: number[] = [];
  const reflected: number[] = [];
  const fliers: number[] = [];
  const order: number[] = [];
  /** Each body with a rig drawn this frame, as flat feet y, left, right, top, bottom quints. */
  const bodies: number[] = [];
  const places = new Map<string, [number, number]>();
  const placeFor = (id: string): [number, number] => {
    let p = places.get(id);
    if (!p) {
      p = placeOf(id);
      places.set(id, p);
    }
    return p;
  };

  /** The creature's view, made anew when its rig changes (a new hero of another kind). */
  function viewFor(
    id: string,
    speciesId: string,
  ): { view: ReturnType<typeof createLineView>; height: number; rig: Rig } | undefined {
    let entry = views.get(id);
    const rig = rigFor(rigs, id, speciesId, VILLAGER_RIG);
    if (entry && entry.rig !== rig) {
      entry.view.container.destroy({ children: true });
      views.delete(id);
      entry = undefined;
    }
    if (!entry && rig) {
      const height = bodyHeight(rig, villagerArea, options.cast.get(id)?.scale ?? 1);
      const colors = { ink: palette.ink, accent: palette.accent, paper: palette.paper };
      entry = { view: createLineView(rig, colors, height), height, rig };
      entry.view.container.label = id;
      views.set(id, entry);
      actors.addChild(entry.view.container);
    }
    return entry;
  }

  /** The shot's scene point: fixed, or the body center of the creature it follows. */
  function framing(): Shot | undefined {
    const s = shot === null ? undefined : scene.cameras[shot];
    if (!s || !('follow' in s)) return s;
    const c = drawn.find((d) => d.id === s.follow);
    return c ? { x: c.x, y: c.y - c.height / 2, zoom: s.zoom } : undefined;
  }

  /** Each cell's share of the most watched cell's count, as a wash. */
  function drawHeat(): void {
    const most = Math.max(1, ...heatCounts);
    const cells = Float32Array.from(heatCounts, (n) => n / most);
    heat.update({ w: HEAT_COLS, h: HEAT_ROWS, cells }, false);
  }

  return {
    update(prev, next, alpha, settings) {
      const seconds = Math.max(0, app.ticker.lastTime) / 1000;
      const motion = !settings.reducedMotion;
      const widthScale = settings.highContrast ? HIGH_CONTRAST_WIDTH : 1;
      const w = SCENERY_WIDTH * widthScale;

      if (w !== lineWidth) {
        lineWidth = w;
        drawGround(ground, scene, palette, w);
        // A valley's trees have bark in the press's wood; Part 1's are paper.
        const bark = scene.depth ? woodOf(palette) : palette.paper;
        for (const { tree, g } of trees) drawTree(g, tree, palette, w, bark);
        for (const { bed, g } of beds) drawStems(g.clear(), bed, scene, palette, w, true);
        look = starlingLook(palette, widthScale);
        lensRing.clear().circle(0, 0, options.lensRadius).stroke({ color: palette.accent, width: w });
        for (const { g } of props.values()) g.destroy();
        props.clear();
        landKey = mushroomKey = '';
      }
      const key = JSON.stringify([next.water, next.decks, next.islets]);
      if (key !== landKey) {
        landKey = key;
        // A valley's water is calm, with the sky in it.
        const surface = scene.depth
          ? (g: Graphics, r: (typeof next.water)[number]): void => {
              drawWaterSurface(g, r, scene, palette, w);
            }
          : undefined;
        drawLand(land, next.water, next.decks, next.islets, palette, w, scene, surface);
      }
      const standing = new Set<string>();
      /** A new Graphics for a prop drawn for another key (or not yet), or null when it is current. */
      const redraw = (id: string, x: number, y: number, key: string): Graphics | null => {
        standing.add(id);
        if (props.get(id)?.key === key) return null;
        props.get(id)?.g.destroy();
        const g = new Graphics({ label: id, zIndex: y });
        standAt(g, x, y);
        props.set(id, { g, key });
        actors.addChild(g);
        return g;
      };
      for (const s of next.structures) {
        if (s.kind === 'bridge') continue;
        const g = redraw(s.id, s.x, s.y, `${s.kind},${String(s.x)},${String(s.y)}`);
        if (g && s.kind === 'lantern') drawLantern(g, s, palette, w);
        else if (g && s.id === PRESS) {
          // Batched with the bodies beside it, as small props are, though it has more vertices.
          g.context.batchMode = 'batch';
          // Larger than its depth alone, so its head stands clear of a crowd at it; its lines
          // stay the scenery's width.
          drawPress(g, s, palette, w / PRESS_SCALE);
          g.scale.set(g.scale.x * PRESS_SCALE);
        } else if (g) drawBench(g, s, palette, w);
      }
      for (const b of next.bushes) {
        const berries = Math.min(Math.floor(b.berries), BERRY_SPOTS.length);
        const g = redraw(b.id, b.x, b.y, `${String(b.x)},${String(b.y)},${String(berries)}`);
        if (g) drawBush(g, b, palette, w);
      }
      // A prop from an earlier chapter that this one does not have.
      for (const [id, { g }] of props) {
        if (standing.has(id)) continue;
        g.destroy();
        props.delete(id);
      }
      const m = next.mushroom;
      mushroom.visible = m !== null;
      if (m && `${String(m.x)},${String(m.y)},${String(m.drops)}` !== mushroomKey) {
        mushroomKey = `${String(m.x)},${String(m.y)},${String(m.drops)}`;
        drawMushroom(mushroom, m, palette, w);
        mushroom.zIndex = m.y;
      }
      light.update(next.light);
      // In Hearsay Hollow the drama sky is the lens (ADR 0013 item 6).
      const lens = next.pack?.id === 'hollow' ? next.light : null;
      lensRing.visible = lens !== null;
      if (lens) lensRing.position.set(lens.x, lens.y);
      fog.update(next.fog, settings.highContrast);
      cursor.visible = cursorAt !== null;
      const ringKey = cursorAt ? `${String(cursorAt.x)},${String(cursorAt.y)},${String(w)}` : '';
      if (cursorAt && ringKey !== cursorKey) {
        cursor.clear().circle(cursorAt.x, cursorAt.y, CURSOR_RADIUS).stroke(plainStroke(palette, w));
      }
      cursorKey = ringKey;

      drawn = [];
      shadows.clear();
      deckShadows.clear();
      const shade = {
        color: palette.ink,
        alpha: settings.highContrast ? SHADOW_ALPHA_HIGH_CONTRAST : SHADOW_ALPHA,
      };
      for (const { view } of views.values()) view.container.visible = false;
      const fen = next.pack?.id === 'fen' ? next.pack : null;
      flying.clear();
      if (fen) for (const id of fen.flying) flying.add(id);
      perched.length = 0;
      reflected.length = 0;
      fliers.length = 0;
      bodies.length = 0;
      flock.clear();
      flockNear.clear();
      const skyTop = scene.sky[0];
      const skyBottom = scene.sky[1];
      const skyDepth = depthAt(scene, scene.depth?.horizon ?? 0);
      for (const c of interpolateCreatures(prev, next, alpha)) {
        if (c.state === 'away') continue;
        const up = flying.has(c.id);
        // A grounded starling that sees at least half its neighbors flying in the water.
        const sees = c.speciesId === STARLING && !up && (fen?.perceived[c.id] ?? 0) >= REFLECT_AT;
        if (c.speciesId === STARLING && !rigs.has(c.id)) {
          const place = placeFor(c.id);
          const across = place[0];
          const high = place[1];
          const phase = phaseOf(c.id);
          if (up) {
            // Each bird keeps its own place in the band, above its place on the ground, and drifts about it.
            const turn = 2 * Math.PI * (seconds / DRIFT_SECONDS + phase);
            const x = c.x + SPREAD * (across - 0.5);
            const y = skyTop + (skyBottom - skyTop) * high;
            const k = BIRD * skyDepth * (FLIER_MIN + FLIER_RANGE * ((phase * 7) % 1));
            fliers.push(x + DRIFT * Math.sin(turn), y + (DRIFT / 4) * Math.cos(turn), k, (phase * 13) % 1);
          } else {
            // Fanned about its feet, inside its reed bed; drawn, reflected, and picked there.
            const x = c.x + 2 * GROUND_SPREAD * (across - 0.5);
            const y = c.y + 2 * GROUND_SPREAD_Y * (high - 0.5);
            const k = BIRD * depthAt(scene, y);
            const dir = phase < 0.5 ? -1 : 1;
            perched.push(x, y, k, dir);
            if (sees) reflected.push(x, y, k, dir);
            drawn.push({ ...c, x, y, height: PERCHED_HEIGHT * k });
          }
          continue;
        }
        const entry = viewFor(c.id, c.speciesId);
        if (!entry) continue;
        // Sized to its depth: drawn, shadowed, picked, and framed at that size.
        const h = entry.height * depthAt(scene, c.y);
        // A flier is drawn, picked, and framed where it flies; its shadow stays on the ground.
        const lift = up ? FLY_LIFT * (h / entry.height) : 0;
        drawn.push({ ...c, y: c.y - lift, height: h });
        const half = (SHADOW_WIDTH * h) / 2;
        bodies.push(c.y, c.x - half, c.x + half, c.y - lift - h, c.y - lift);
        if (sees) {
          // Under its shadow: its body flipped in the water.
          const below = c.y + (SHADOW_HEIGHT * h) / 2 + REFLECT_GAP;
          drawOutlineReflection(flock, outlineOf(entry.rig), c.x, below, h, look);
        }
        // On the ground, so a hop lifts the body off its shadow.
        const onDeck = next.decks.some(
          (d) => c.x >= d.x && c.x <= d.x + d.w && c.y >= d.y && c.y <= d.y + d.h,
        );
        const layer = onDeck ? deckShadows : shadows;
        oval(layer, c.x, c.y, (SHADOW_WIDTH * h) / 2, (SHADOW_HEIGHT * h) / 2, SHADOW_POINTS).fill(shade);
        const { container } = entry.view;
        container.visible = true;
        container.scale.set(h, -h);
        // Dancers hop together.
        const hop =
          c.dancing && motion ? HOP_HEIGHT * Math.abs(Math.sin((Math.PI * seconds) / HOP_SECONDS)) : 0;
        container.position.set(c.x, c.y - hop - lift);
        container.zIndex = c.y;
        // Creatures in a meeting sway in time (spec 11.1 harmony); the rest sway out of step.
        const phase = c.state === 'meet' ? 0 : phaseOf(c.id);
        container.rotation = motion
          ? SWAY_ANGLE * Math.sin(2 * Math.PI * (seconds / SWAY_SECONDS + phase))
          : 0;
        const body =
          c.id === focus
            ? bodyColor(palette.paper, palette.accent, FOCUS_MIX + FOCUS_MIX_COLOR * c.shell.color)
            : bodyColor(palette.paper, palette.warmth, c.shell.color);
        const fogHere = fogUnder(next.fog, scene.width, c.x, c.y - h / 2);
        entry.view.update(c.shell, seconds, settings.reducedMotion, fogHere, { body, widthScale });
      }
      // The flock, in one Graphics: reflections, then each grounded bird's shadow, then the
      // grounded birds farthest first, then the fliers. A grounded bird nearer than a body it
      // overlaps goes in the near flock instead, which stands just before the nearest such body.
      for (let i = 0; i + 3 < reflected.length; i += 4)
        drawPerchedReflection(
          flock,
          reflected[i] ?? 0,
          reflected[i + 1] ?? 0,
          reflected[i + 2] ?? 0,
          reflected[i + 3] ?? 1,
          look,
        );
      order.length = 0;
      for (let i = 0; i + 3 < perched.length; i += 4) {
        const k = perched[i + 2] ?? 0;
        flock.ellipse(perched[i] ?? 0, perched[i + 1] ?? 0, 9 * k, 2.2 * k);
        // Insertion by y, so a nearer bird overlaps a farther one.
        let j = order.length;
        order.push(i);
        while (j > 0 && (perched[(order[j - 1] ?? 0) + 1] ?? 0) > (perched[i + 1] ?? 0)) {
          order[j] = order[j - 1] ?? 0;
          j--;
        }
        order[j] = i;
      }
      if (perched.length > 0) flock.fill(shade);
      let nearAt = -Infinity;
      for (let j = 0; j < order.length; j++) {
        const i = order[j] ?? 0;
        const x = perched[i] ?? 0;
        const y = perched[i + 1] ?? 0;
        const k = perched[i + 2] ?? 0;
        let before = -Infinity;
        for (let b = 0; b + 4 < bodies.length; b += 5) {
          const feet = bodies[b] ?? 0;
          if (
            y > feet &&
            x + BIRD_REACH * k > (bodies[b + 1] ?? 0) &&
            x - BIRD_REACH * k < (bodies[b + 2] ?? 0) &&
            y > (bodies[b + 3] ?? 0) &&
            y - PERCHED_HEIGHT * k < (bodies[b + 4] ?? 0)
          )
            before = Math.max(before, feet);
        }
        if (before > nearAt) nearAt = before;
        drawPerched(before > -Infinity ? flockNear : flock, x, y, k, perched[i + 3] ?? 1, look);
      }
      if (nearAt > -Infinity) flockNear.zIndex = nearAt + NEAR_STEP;
      for (let i = 0; i + 3 < fliers.length; i += 4)
        drawFlier(flock, fliers[i] ?? 0, fliers[i + 1] ?? 0, fliers[i + 2] ?? 0, fliers[i + 3] ?? 0, look);

      if (visitAsked) {
        // A seat it can reach without crossing water off a deck: first one on the gate's side
        // (a straight walk), then a bench before a bench spot, then the shortest walk. With none,
        // it sits at the gate.
        const { gate } = options;
        const seats: Seat[] = [
          ...next.structures
            .filter((st) => st.kind === 'bench')
            .map((b) => ({ x: b.x, y: b.y, bench: true })),
          ...scene.benchSpots.map((p) => ({ x: p.x, y: p.y, bench: false })),
        ];
        let best: { seat: Seat; path: Point[] } = { seat: { ...gate, bench: false }, path: [gate] };
        let bestRank: number[] | null = null;
        for (const seat of seats) {
          const path = route(gate, seat, next);
          if (!path) continue;
          const rank = [path.length === 2 ? 0 : 1, seat.bench ? 0 : 1, pathLength(path)];
          if (!bestRank || before(rank, bestRank)) {
            best = { seat, path };
            bestRank = rank;
          }
        }
        const length = pathLength(best.path);
        visit = {
          done: visitAsked,
          t: 0,
          last: seconds,
          ...best,
          length,
          walk: motion ? length / VISITOR_SPEED : 0,
        };
        visitAsked = null;
      }
      feather.visible = false;
      if (visit) {
        visit.t += Math.min(Math.max(0, seconds - visit.last), VISIT_STEP_MAX);
        visit.last = seconds;
        const { seat, walk, t, path, length } = visit;
        const entry = viewFor(VISITOR_RIG, VISITOR_RIG);
        if (t >= 2 * walk + VISITOR_SIT_SECONDS || !entry) {
          visit.done();
          visit = null;
        } else {
          // 0 at the gate, 1 on the seat.
          const share =
            t < walk
              ? t / walk
              : t < walk + VISITOR_SIT_SECONDS
                ? 1
                : 1 - (t - walk - VISITOR_SIT_SECONDS) / walk;
          const seated = share === 1;
          const { x, y } = along(path, share * length);
          const { container } = entry.view;
          const h = entry.height * depthAt(scene, y);
          container.visible = true;
          container.rotation = 0;
          container.scale.set(h, -h);
          const onBench = seated && seat.bench;
          // The seat, its lift, and the feather beside it are sized to the seat's depth.
          const seatDepth = depthAt(scene, seat.y);
          container.position.set(x, onBench ? y - SEAT_LIFT * seatDepth : y);
          // In front of the bench it sits on.
          container.zIndex = y + 1;
          if (!onBench) {
            oval(shadows, x, y, (SHADOW_WIDTH * h) / 2, (SHADOW_HEIGHT * h) / 2, SHADOW_POINTS).fill(shade);
          }
          entry.view.update(VISITOR_SHELL, seconds, settings.reducedMotion, 0, {
            body: palette.paper,
            widthScale,
          });
          // The feather stays on the seat from when it sits until it has gone.
          feather.visible = t >= walk;
          const key = `${scene.id},${String(seat.x)},${String(seat.y)},${String(seat.bench)},${String(w)}`;
          if (key !== featherKey) {
            featherKey = key;
            const fy = seat.bench ? seat.y - SEAT_LIFT * seatDepth : seat.y;
            const fx = seat.x + FEATHER_OFFSET * seatDepth;
            drawFeather(feather, fx, fy, palette, w);
            feather.pivot.set(fx, fy);
            feather.position.set(fx, fy);
            feather.scale.set(seatDepth);
            feather.zIndex = seat.y + 2;
          }
        }
      }

      const { width, height } = app.screen;
      const target = viewTransform(scene.width, scene.height, width, height, framing(), topInset);
      const k = 1 - Math.exp((-CAMERA_RATE * app.ticker.deltaMS) / 1000);
      camera = camera && motion ? lerpTransform(camera, target, k) : target;
      world.scale.set(camera.scale);
      world.position.set(camera.x, camera.y);
    },
    pick(x, y) {
      if (!camera) return null;
      const [sx, sy] = toScene(camera, x, y);
      let best: string | null = null;
      let bestD = Infinity;
      for (const c of drawn) {
        // A body's center is half its height above its feet; its hit radius is half its height.
        const d = Math.hypot(c.x - sx, c.y - c.height / 2 - sy);
        if (d <= c.height / 2 && d < bestD) {
          bestD = d;
          best = c.id;
        }
      }
      return best;
    },
    toScene(x, y) {
      return camera ? toScene(camera, x, y) : [x, y];
    },
    toScreen(x, y) {
      return camera ? toScreen(camera, x, y) : [x, y];
    },
    setFocus(id) {
      focus = id;
    },
    setShot(name) {
      shot = name;
    },
    setTopInset(px) {
      topInset = px;
    },
    setCursor(p) {
      cursorAt = p;
    },
    setScene(s) {
      if (s === scene) return;
      scene = s;
      for (const { g } of trees) g.destroy();
      trees = plantTrees();
      for (const { g } of beds) g.destroy();
      beds = plantBeds();
      // The next update redraws the ground, the trees, and the water over the new scene.
      lineWidth = 0;
    },
    setPalette(p) {
      if (p === palette) return;
      palette = p;
      cursorKey = featherKey = '';
      // The next update redraws the scenery; creatures get new views in the new ink.
      lineWidth = 0;
      for (const { view } of views.values()) view.container.destroy({ children: true });
      views.clear();
      const oldLight = light.graphics;
      light = createLight(p, options.lensRadius);
      world.addChildAt(light.graphics, world.getChildIndex(oldLight));
      oldLight.destroy();
      const oldFog = fog.sprite;
      fog = createWash(p.fog, scene.width);
      world.addChildAt(fog.sprite, world.getChildIndex(oldFog));
      oldFog.destroy({ texture: true, textureSource: true });
      const oldHeat = heat.sprite;
      heat = createWash({ color: p.ink, alpha: HEAT_ALPHA }, scene.width, 'heatmap');
      world.addChildAt(heat.sprite, world.getChildIndex(oldHeat));
      oldHeat.destroy({ texture: true, textureSource: true });
      heat.sprite.visible = false;
      if (heatShown) drawHeat();
    },
    countLens(lite) {
      if (!lite.light) return;
      const { x, y } = lite.light;
      const col = Math.min(HEAT_COLS - 1, Math.max(0, Math.floor((x / scene.width) * HEAT_COLS)));
      const row = Math.min(HEAT_ROWS - 1, Math.max(0, Math.floor((y / scene.height) * HEAT_ROWS)));
      heatCounts[row * HEAT_COLS + col] = (heatCounts[row * HEAT_COLS + col] ?? 0) + 1;
      if (heatShown) drawHeat();
    },
    endVisit() {
      visit?.done();
      visit = null;
      visitAsked?.();
      visitAsked = null;
      const v = views.get(VISITOR_RIG);
      if (v) v.view.container.visible = false;
      feather.visible = false;
    },
    visitor() {
      return new Promise((resolve) => {
        // A new visit replaces one under way, which counts as gone.
        visit?.done();
        visit = null;
        visitAsked?.();
        visitAsked = resolve;
      });
    },
    showHeatmap(on) {
      heatShown = on;
      if (!on) heatCounts.fill(0);
      if (on) drawHeat();
      else heat.sprite.visible = false;
    },
  };
}
