import { Container, Graphics, type Application } from 'pixi.js';
import type { Rect, Structure } from '../sim/types.ts';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Settings } from '../ui/settings.ts';
import { lerpTransform, toScene, viewTransform, type Shot, type ViewTransform } from './camera.ts';
import type { Cast } from './cast.ts';
import { createWash } from './effects/fog.ts';
import { createLight } from './effects/light.ts';
import { bodyColor, fillOutline } from './line/fill.ts';
import { createLineView } from './line/line-view.ts';
import type { Rig } from './line/rig.ts';
import type { Palette } from './palette.ts';
import { interpolateCreatures, type DrawnCreature, type SceneData } from './scene.ts';

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
const SWAY_ANGLE = 0.04;
const SWAY_SECONDS = 3;
/** How fast the camera closes on a new shot, per second. */
const CAMERA_RATE = 3;
/** Scenery line width in scene units, and the alpha of the far layer (spec 11.1 depth). */
const SCENERY_WIDTH = 6;
const FAR_ALPHA = 0.35;
const TUFT_ALPHA = 0.5;
/** High contrast thickens every line by half again, on top of the bold default (spec 11.6). */
const HIGH_CONTRAST_WIDTH = 1.5;
/** A dancing creature hops this high, in scene units, once every this many seconds. */
const HOP_HEIGHT = 7;
const HOP_SECONDS = 0.5;
/** The heat map grid over the scene, and the alpha of its most watched cell. */
const HEAT_COLS = 16;
const HEAT_ROWS = 9;
const HEAT_ALPHA = 0.4;

export interface MeadowView {
  update(prev: WorldLite, next: WorldLite, alpha: number, settings: Settings): void;
  /** The creature under a screen point, or null. */
  pick(x: number, y: number): string | null;
  /** The scene point under a screen point, through the camera of the last update. */
  toScene(x: number, y: number): [number, number];
  /** The creature the current beat is about: the only one drawn in the accent (spec 11.1). */
  setFocus(id: string | null): void;
  /** A camera shot from the scene's `cameras`, or null for the whole scene. */
  setShot(name: string | null): void;
  /** Redraws everything in a season's colors. */
  setPalette(p: Palette): void;
  /** Shows where the lens stayed this chapter. Turning it off clears the count, for the next chapter. */
  showHeatmap(on: boolean): void;
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

/** A phase in [0, 1) from a creature id, so creatures sway out of step. */
function phaseOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h / 997;
}

/** A smooth line through flat x, y pairs: quadratic curves through the segment midpoints. */
function smoothLine(g: Graphics, p: readonly number[]): Graphics {
  const at = (i: number): number => p[i] ?? 0;
  g.moveTo(at(0), at(1));
  for (let k = 2; k + 3 < p.length; k += 2) {
    g.quadraticCurveTo(at(k), at(k + 1), (at(k) + at(k + 2)) / 2, (at(k + 1) + at(k + 3)) / 2);
  }
  return g.lineTo(at(p.length - 2), at(p.length - 1));
}

const inkStroke = (palette: Palette, width: number, alpha = 1) =>
  ({ color: palette.ink, width, alpha, cap: 'round', join: 'round' }) as const;
/** Square ends and sharp corners: far fewer vertices than round ones, so a small prop stays in the batch. */
const plainStroke = (palette: Palette, width: number) =>
  ({ color: palette.ink, width, cap: 'square', join: 'miter' }) as const;

/** Paper, far hills, and grass tufts: the layer behind everything, in scene units. */
function drawGround(g: Graphics, scene: SceneData, palette: Palette, w: number): void {
  g.clear().rect(0, 0, scene.width, scene.height).fill(palette.background);
  for (const hill of scene.hills) smoothLine(g, hill).stroke(inkStroke(palette, w, FAR_ALPHA));
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

/** A closed smooth shape through flat x, y pairs: quadratic curves through the segment midpoints. */
function smoothClosed(g: Graphics, p: readonly number[]): Graphics {
  const n = p.length / 2;
  const x = (i: number): number => p[(i % n) * 2] ?? 0;
  const y = (i: number): number => p[(i % n) * 2 + 1] ?? 0;
  g.moveTo((x(0) + x(1)) / 2, (y(0) + y(1)) / 2);
  for (let i = 1; i <= n; i++) g.quadraticCurveTo(x(i), y(i), (x(i) + x(i + 1)) / 2, (y(i) + y(i + 1)) / 2);
  return g.closePath();
}

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
 * with ink outlines, then a canopy of overlapping leaf-colored circles. Each circle is outlined,
 * then all are filled again a line's half-width smaller, so only the outer scalloped edge stays.
 * The trunk's first point is its base.
 */
function drawTree(g: Graphics, tree: SceneData['trees'][number], palette: Palette, w: number): void {
  g.clear();
  const ink = inkStroke(palette, w);
  for (const branch of tree.branches) {
    smoothClosed(g, limbOutline(branch, tree.girth * BRANCH_BASE, tree.girth * BRANCH_TIP))
      .fill(palette.paper)
      .stroke(ink);
  }
  // The base points go in twice, so the outline passes through them and the trunk stands flat.
  const trunk = limbOutline(tree.trunk, tree.girth, tree.girth * TRUNK_TOP, tree.girth * TRUNK_FLARE);
  const n = trunk.length;
  smoothClosed(g, [...trunk.slice(0, 2), ...trunk, ...trunk.slice(n - 2)])
    .fill(palette.paper)
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

/**
 * Points round a small shape's outline. Pixi gives a circle of radius r about 18 sqrt(r) points,
 * and a Graphics over 200 vertices cannot batch, so props use plain polygons and stay in the batch.
 */
const GLOW_POINTS = 16;
const DEW_POINTS = 5;
const CAP_POINTS = 12;

/** A regular polygon of `n` points round (x, y): a cheap circle. */
function disc(g: Graphics, x: number, y: number, r: number, n: number): Graphics {
  const p: number[] = [];
  for (let i = 0; i < n; i++)
    p.push(x + r * Math.cos((2 * Math.PI * i) / n), y + r * Math.sin((2 * Math.PI * i) / n));
  return g.poly(p);
}

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

/** How far a bridge reaches past each bank, and half its deck's width. */
const BRIDGE_REACH = 14;
const BRIDGE_HALF = 16;
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
 * short way, reaching a little onto each bank.
 */
function drawBridge(g: Graphics, { x, y }: Structure, r: Rect, palette: Palette, w: number): void {
  // A tall rectangle (a brook running north to south) is crossed east to west.
  const eastWest = r.w <= r.h;
  const [from, to] = eastWest ? [r.x, r.x + r.w] : [r.y, r.y + r.h];
  const at = (u: number, v: number): [number, number] => (eastWest ? [u, y + v] : [x + v, u]);
  const a = from - BRIDGE_REACH;
  const b = to + BRIDGE_REACH;
  g.poly([...at(a, -BRIDGE_HALF), ...at(b, -BRIDGE_HALF), ...at(b, BRIDGE_HALF), ...at(a, BRIDGE_HALF)])
    .fill(palette.paper)
    .stroke(inkStroke(palette, w));
  for (let u = a + PLANK_STEP; u < b - PLANK_STEP / 2; u += PLANK_STEP) {
    g.moveTo(...at(u, -BRIDGE_HALF)).lineTo(...at(u, BRIDGE_HALF));
  }
  g.stroke(inkStroke(palette, w * 0.5, TUFT_ALPHA));
}

const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/**
 * The water and the bridges over it: flat on the ground, under everything that stands. Each
 * rectangle is outlined at twice the line width and then filled, so where rectangles meet their
 * outlines are covered and one bank line runs round the whole water.
 */
function drawLand(
  g: Graphics,
  water: readonly Rect[],
  bridges: Structure[],
  palette: Palette,
  w: number,
): void {
  g.clear();
  for (const r of water) g.rect(r.x, r.y, r.w, r.h).stroke(inkStroke(palette, 2 * w));
  for (const r of water) g.rect(r.x, r.y, r.w, r.h).fill(palette.water);
  for (const r of water) {
    const cols = Math.max(1, Math.round(r.w / RIPPLE_STEP));
    const rows = Math.max(1, Math.round(r.h / RIPPLE_STEP));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++)
        drawRipple(g, r.x + ((i + 0.5) * r.w) / cols, r.y + ((j + 0.5) * r.h) / rows);
    }
  }
  g.stroke(inkStroke(palette, w * 0.6, FAR_ALPHA));
  for (const s of bridges) {
    const r = water.find((rect) => inRect(rect, s.x, s.y));
    if (r) drawBridge(g, s, r, palette, w);
  }
}

/** The mushroom's cap radius, stem size, and the spacing and radius of its dew dots. */
const CAP_RADIUS = 30;
const STEM_WIDTH = 14;
const STEM_HEIGHT = 18;
const DEW_STEP = 7;
const DEW_RADIUS = 3;

/** Dew is the water color, deepened toward ink so it shows on the cap. */
export const dewColor = (palette: Palette): number => bodyColor(palette.water, palette.ink, DEW_DEPTH);
const DEW_DEPTH = 0.45;

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
function fogAt(fog: WorldLite['fog'], width: number, x: number, y: number): number {
  if (fog.w === 0 || fog.h === 0) return 0;
  const cell = width / fog.w;
  const col = Math.min(fog.w - 1, Math.max(0, Math.floor(x / cell)));
  const row = Math.min(fog.h - 1, Math.max(0, Math.floor(y / cell)));
  return fog.cells[row * fog.w + col] ?? 0;
}

/**
 * The Meadow view (spec 11.3): the valley and its creatures in ink and one accent, in the season's
 * palette. It draws snapshots only and never changes the world. Creatures use their own rig, or
 * the villager rig. Water and bridges lie flat on the ground. Creatures, trees, benches, lanterns,
 * and the mushroom share one layer sorted by base y, so nearer things hide farther ones (spec 11.1
 * depth). Every body shows its shell color as a muted warm tint (spec 5.2); only the focus
 * creature wears the accent (spec 11.1). A creature in thick fog is drawn in dashes, and a dancing
 * one hops. The heat map counts the lens center over a 16 x 9 grid in every new snapshot and shows
 * each cell's share of the most watched cell as an ink wash. Reduced motion stops the boil, the
 * sway, the hop, and camera moves; high contrast thickens every line by half again.
 */
export function createMeadowView(
  app: Application,
  scene: SceneData,
  rigs: Map<string, Rig>,
  firstPalette: Palette,
  options: { lensRadius: number; cast: Map<string, Cast> },
): MeadowView {
  let palette = firstPalette;
  const world = new Container();
  const ground = new Graphics({ label: 'ground' });
  const land = new Graphics({ label: 'land' });
  const actors = new Container({ sortableChildren: true });
  let light = createLight(palette, options.lensRadius);
  let fog = createWash(palette.fog, scene.width);
  let heat = createWash({ color: palette.ink, alpha: HEAT_ALPHA }, scene.width, 'heatmap');
  let heatShown = false;
  heat.sprite.visible = false;
  world.addChild(ground, land, light.graphics, actors, fog.sprite, heat.sprite);
  app.stage.addChild(world);

  const trees = scene.trees.map((tree) => {
    const g = new Graphics({ label: tree.id, zIndex: tree.trunk[1] ?? 0 });
    actors.addChild(g);
    return { tree, g };
  });
  /** Benches and lanterns, by structure id. Bridges are drawn with the water. */
  const props = new Map<string, Graphics>();
  const mushroom = new Graphics({ label: 'mushroom', visible: false });
  actors.addChild(mushroom);
  let landKey = '';
  let mushroomKey = '';

  const villager = rigs.get(VILLAGER_RIG);
  const villagerArea = villager ? rigArea(villager) : 1;
  const views = new Map<string, { view: ReturnType<typeof createLineView>; height: number }>();
  let drawn: (DrawnCreature & { height: number })[] = [];
  let camera: ViewTransform | null = null;
  let focus: string | null = null;
  let shot: string | null = null;
  let lineWidth = 0;
  const heatCounts = new Uint32Array(HEAT_COLS * HEAT_ROWS);
  let counted: WorldLite | null = null;

  function viewFor(id: string): { view: ReturnType<typeof createLineView>; height: number } | undefined {
    let entry = views.get(id);
    const rig = rigs.get(id) ?? villager;
    if (!entry && rig) {
      const height = bodyHeight(rig, villagerArea, options.cast.get(id)?.scale ?? 1);
      const colors = { ink: palette.ink, accent: palette.accent, paper: palette.paper };
      entry = { view: createLineView(rig, colors, height), height };
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

  /** Counts the lens center of a snapshot not counted yet. */
  function countLens(next: WorldLite): void {
    if (next === counted) return;
    counted = next;
    if (!next.light) return;
    const col = Math.min(HEAT_COLS - 1, Math.max(0, Math.floor((next.light.x / scene.width) * HEAT_COLS)));
    const row = Math.min(HEAT_ROWS - 1, Math.max(0, Math.floor((next.light.y / scene.height) * HEAT_ROWS)));
    heatCounts[row * HEAT_COLS + col] = (heatCounts[row * HEAT_COLS + col] ?? 0) + 1;
    if (heatShown) drawHeat();
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
        for (const { tree, g } of trees) drawTree(g, tree, palette, w);
        for (const g of props.values()) g.destroy();
        props.clear();
        landKey = mushroomKey = '';
      }
      const bridges = next.structures.filter((s) => s.kind === 'bridge');
      const key = JSON.stringify([next.water, bridges]);
      if (key !== landKey) {
        landKey = key;
        drawLand(land, next.water, bridges, palette, w);
      }
      const standing = new Set<string>();
      for (const s of next.structures) {
        if (s.kind === 'bridge') continue;
        standing.add(s.id);
        if (props.has(s.id)) continue;
        const g = new Graphics({ label: s.id, zIndex: s.y });
        if (s.kind === 'lantern') drawLantern(g, s, palette, w);
        else drawBench(g, s, palette, w);
        props.set(s.id, g);
        actors.addChild(g);
      }
      // A structure from an earlier chapter that this one does not have.
      for (const [id, g] of props) {
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
      fog.update(next.fog, settings.highContrast);
      countLens(next);

      drawn = [];
      for (const { view } of views.values()) view.container.visible = false;
      for (const c of interpolateCreatures(prev, next, alpha)) {
        const entry = c.state === 'away' ? undefined : viewFor(c.id);
        if (!entry) continue;
        drawn.push({ ...c, height: entry.height });
        const { container } = entry.view;
        container.visible = true;
        // Dancers hop together.
        const hop =
          c.dancing && motion ? HOP_HEIGHT * Math.abs(Math.sin((Math.PI * seconds) / HOP_SECONDS)) : 0;
        container.position.set(c.x, c.y - hop);
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
        const fogHere = fogAt(next.fog, scene.width, c.x, c.y - entry.height / 2);
        entry.view.update(c.shell, seconds, settings.reducedMotion, fogHere, { body, widthScale });
      }

      const target = viewTransform(scene.width, scene.height, app.screen.width, app.screen.height, framing());
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
    setFocus(id) {
      focus = id;
    },
    setShot(name) {
      shot = name;
    },
    setPalette(p) {
      if (p === palette) return;
      palette = p;
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
    showHeatmap(on) {
      heatShown = on;
      if (!on) heatCounts.fill(0);
      if (on) drawHeat();
      else heat.sprite.visible = false;
    },
  };
}
