import { Container, Graphics, type Application } from 'pixi.js';
import type { Structure } from '../sim/types.ts';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Settings } from '../ui/settings.ts';
import { lerpTransform, toScene, viewTransform, type Shot, type ViewTransform } from './camera.ts';
import type { Cast } from './cast.ts';
import { createFog } from './effects/fog.ts';
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
const SCENERY_WIDTH = 3;
const FAR_ALPHA = 0.35;
const TUFT_ALPHA = 0.5;
/** High contrast doubles every line (spec 11.6). */
const HIGH_CONTRAST_WIDTH = 2;

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
  g.clear()
    .moveTo(x - 22, y - 10)
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
 * The Meadow view (spec 11.3): the valley and its creatures in ink and one accent. It draws
 * snapshots only and never changes the world. Creatures use their own rig, or the villager rig.
 * Creatures, trees, and benches share one layer sorted by base y, so nearer things hide farther
 * ones (spec 11.1 depth). Every body shows its shell color as a muted warm tint (spec 5.2); only
 * the focus creature wears the accent (spec 11.1). Reduced motion stops the boil, the sway, and
 * camera moves; high contrast doubles every line.
 */
export function createMeadowView(
  app: Application,
  scene: SceneData,
  rigs: Map<string, Rig>,
  palette: Palette,
  options: { lensRadius: number; cast: Map<string, Cast> },
): MeadowView {
  const world = new Container();
  const ground = new Graphics();
  const actors = new Container({ sortableChildren: true });
  const light = createLight(palette, options.lensRadius);
  const fog = createFog(palette, scene.width);
  world.addChild(ground, light.graphics, actors, fog.sprite);
  app.stage.addChild(world);

  const trees = scene.trees.map((tree) => {
    const g = new Graphics({ label: tree.id, zIndex: tree.trunk[1] ?? 0 });
    actors.addChild(g);
    return { tree, g };
  });
  const benches = new Map<string, Graphics>();

  const colors = { ink: palette.ink, accent: palette.accent, paper: palette.paper };
  const villager = rigs.get(VILLAGER_RIG);
  const villagerArea = villager ? rigArea(villager) : 1;
  const views = new Map<string, { view: ReturnType<typeof createLineView>; height: number }>();
  let drawn: (DrawnCreature & { height: number })[] = [];
  let camera: ViewTransform | null = null;
  let focus: string | null = null;
  let shot: string | null = null;
  let lineWidth = 0;

  function viewFor(id: string): { view: ReturnType<typeof createLineView>; height: number } | undefined {
    let entry = views.get(id);
    const rig = rigs.get(id) ?? villager;
    if (!entry && rig) {
      const height = bodyHeight(rig, villagerArea, options.cast.get(id)?.scale ?? 1);
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
        for (const g of benches.values()) g.destroy();
        benches.clear();
      }
      for (const s of next.structures) {
        if (benches.has(s.id)) continue;
        const g = new Graphics({ label: s.id, zIndex: s.y });
        drawBench(g, s, palette, w);
        benches.set(s.id, g);
        actors.addChild(g);
      }
      light.update(next.light);
      fog.update(next.fog, settings.highContrast);

      drawn = [];
      for (const { view } of views.values()) view.container.visible = false;
      for (const c of interpolateCreatures(prev, next, alpha)) {
        const entry = c.state === 'away' ? undefined : viewFor(c.id);
        if (!entry) continue;
        drawn.push({ ...c, height: entry.height });
        const { container } = entry.view;
        container.visible = true;
        container.position.set(c.x, c.y);
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
        entry.view.update(c.shell, seconds, settings.reducedMotion, { body, widthScale });
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
  };
}
