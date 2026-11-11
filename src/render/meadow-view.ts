import { Container, Graphics, type Application } from 'pixi.js';
import type { Structure } from '../sim/types.ts';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Settings } from '../ui/settings.ts';
import { lerpTransform, toScene, viewTransform, type ViewTransform } from './camera.ts';
import { createFog } from './effects/fog.ts';
import { createLight } from './effects/light.ts';
import { createLineView } from './line/line-view.ts';
import type { Rig } from './line/rig.ts';
import type { Palette } from './palette.ts';
import { interpolateCreatures, type DrawnCreature, type SceneData } from './scene.ts';

/** A creature's height in scene units (a rig is 1 unit tall). */
export const CREATURE_HEIGHT = 80;
/** How far from a creature's body center a click still picks it, in scene units. */
export const PICK_RADIUS = 40;
/** The light glow's radius: the sim's lens radius (tuning light.lensRadius). */
export const LENS_RADIUS = 120;
/** The rig for every creature that has no rig of its own. */
export const VILLAGER_RIG = 'villager';
/** The focus creature's accent is at least this, so it reads even with shell color 0 (spec 11.1). */
const FOCUS_ACCENT = 0.5;
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
  /** The creature the current beat is about: the only one drawn in the accent (spec 11.1). */
  setFocus(id: string | null): void;
  /** A camera shot from the scene's `cameras`, or null for the whole scene. */
  setShot(name: string | null): void;
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

/** Paper, far hills, grass tufts, and trees, in scene units. */
function drawGround(g: Graphics, scene: SceneData, palette: Palette, w: number): void {
  const ink = { color: palette.ink, cap: 'round', join: 'round' } as const;
  g.clear().rect(0, 0, scene.width, scene.height).fill(palette.background);
  for (const hill of scene.hills) smoothLine(g, hill).stroke({ ...ink, width: w, alpha: FAR_ALPHA });
  for (const [x, y] of scene.tufts) {
    g.moveTo(x - 6, y)
      .lineTo(x - 9, y - 8)
      .moveTo(x, y)
      .lineTo(x, y - 11)
      .moveTo(x + 6, y)
      .lineTo(x + 9, y - 8)
      .stroke({ ...ink, width: w * 0.7, alpha: TUFT_ALPHA });
  }
  for (const tree of scene.trees) {
    smoothLine(g, tree.trunk).stroke({ ...ink, width: w * 1.5 });
    g.circle(tree.crown.x, tree.crown.y, tree.crown.r)
      .fill(palette.paper)
      .stroke({ ...ink, width: w });
  }
}

/** Benches from the snapshot: a seat, a back, and two legs, with feet at (x, y). */
function drawBenches(g: Graphics, benches: readonly Structure[], palette: Palette, w: number): void {
  g.clear();
  for (const { x, y } of benches) {
    g.moveTo(x - 22, y - 10)
      .lineTo(x + 22, y - 10)
      .moveTo(x - 20, y - 20)
      .lineTo(x + 20, y - 20)
      .moveTo(x - 16, y - 10)
      .lineTo(x - 16, y)
      .moveTo(x + 16, y - 10)
      .lineTo(x + 16, y)
      .stroke({ color: palette.ink, width: w, cap: 'round', join: 'round' });
  }
}

/**
 * The Meadow view (spec 11.3): the valley and its creatures in ink and one accent. It draws
 * snapshots only and never changes the world. Creatures use their own rig, or the villager rig.
 * Reduced motion stops the boil, the sway, and camera moves; high contrast doubles every line.
 */
export function createMeadowView(
  app: Application,
  scene: SceneData,
  rigs: Map<string, Rig>,
  palette: Palette,
): MeadowView {
  const world = new Container();
  const ground = new Graphics();
  const benches = new Graphics();
  const creatures = new Container({ sortableChildren: true });
  const light = createLight(palette, LENS_RADIUS);
  const fog = createFog(palette, scene.width);
  world.addChild(ground, light.graphics, benches, creatures, fog.graphics);
  app.stage.addChild(world);

  const colors = { ink: palette.ink, accent: palette.accent, paper: palette.paper };
  const views = new Map<string, ReturnType<typeof createLineView>>();
  let drawn: DrawnCreature[] = [];
  let camera: ViewTransform | null = null;
  let focus: string | null = null;
  let shot: string | null = null;
  let groundKey = '';
  let benchKey = '';

  function viewFor(id: string): ReturnType<typeof createLineView> | undefined {
    let view = views.get(id);
    const rig = rigs.get(id) ?? rigs.get(VILLAGER_RIG);
    if (!view && rig) {
      view = createLineView(rig, colors, CREATURE_HEIGHT);
      views.set(id, view);
      creatures.addChild(view.container);
    }
    return view;
  }

  return {
    update(prev, next, alpha, settings) {
      const seconds = Math.max(0, app.ticker.lastTime) / 1000;
      const motion = !settings.reducedMotion;
      const widthScale = settings.highContrast ? HIGH_CONTRAST_WIDTH : 1;

      const framing = shot === null ? undefined : scene.cameras[shot];
      const target = viewTransform(scene.width, scene.height, app.screen.width, app.screen.height, framing);
      const k = 1 - Math.exp((-CAMERA_RATE * app.ticker.deltaMS) / 1000);
      camera = camera && motion ? lerpTransform(camera, target, k) : target;
      world.scale.set(camera.scale);
      world.position.set(camera.x, camera.y);

      const w = SCENERY_WIDTH * widthScale;
      if (groundKey !== String(w)) {
        groundKey = String(w);
        drawGround(ground, scene, palette, w);
      }
      const placed = next.structures; // every structure is a bench in M1
      const key = `${String(w)}:${placed.map((s) => `${String(s.x)},${String(s.y)}`).join(';')}`;
      if (key !== benchKey) {
        benchKey = key;
        drawBenches(benches, placed, palette, w);
      }
      light.update(next.light);
      fog.update(next.fog);

      drawn = interpolateCreatures(prev, next, alpha).filter((c) => c.state !== 'away');
      for (const view of views.values()) view.container.visible = false;
      for (const c of drawn) {
        const view = viewFor(c.id);
        if (!view) continue;
        const { container } = view;
        container.visible = true;
        container.position.set(c.x, c.y);
        container.zIndex = c.y;
        // Creatures in a meeting sway in time (spec 11.1 harmony); the rest sway out of step.
        const phase = c.state === 'meet' ? 0 : phaseOf(c.id);
        container.rotation = motion
          ? SWAY_ANGLE * Math.sin(2 * Math.PI * (seconds / SWAY_SECONDS + phase))
          : 0;
        const accent = c.id === focus ? FOCUS_ACCENT + (1 - FOCUS_ACCENT) * c.shell.color : 0;
        view.update(c.shell, seconds, settings.reducedMotion, { accent, widthScale });
      }
    },
    pick(x, y) {
      if (!camera) return null;
      const [sx, sy] = toScene(camera, x, y);
      let best: string | null = null;
      let bestD = PICK_RADIUS;
      for (const c of drawn) {
        const d = Math.hypot(c.x - sx, c.y - CREATURE_HEIGHT / 2 - sy);
        if (d <= bestD) {
          bestD = d;
          best = c.id;
        }
      }
      return best;
    },
    setFocus(id) {
      focus = id;
    },
    setShot(name) {
      shot = name;
    },
  };
}
