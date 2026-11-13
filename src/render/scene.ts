import { z } from 'zod';
import type { Shell } from '../sim/types.ts';
import type { WorldLite } from '../sim-host/protocol.ts';

const Spot = z.strictObject({ id: z.string().min(1), x: z.number(), y: z.number() });
/** Flat x, y pairs. */
const Polyline = z.array(z.number()).refine((a) => a.length >= 4 && a.length % 2 === 0, 'x, y pairs');

const zoom = z.number().min(1);

/**
 * A scene layout in scene units, y down (spec 11.1 item 3): far hills, grass tufts, trees
 * (a tapered trunk, branches, and a canopy of overlapping circles), and for the valleys (spec
 * 7.3) reed beds, pools, lanes, and squares on the ground, the sky band where a flock flies, and
 * depth; bench spots for the place verb, and named camera shots that beats ask for. A shot centers
 * a fixed point, or follows a creature by id. `credit` names who made the layout; a placeholder
 * layout says so, so the production guard sees it (ADR 0010).
 */
export const SceneSchema = z.strictObject({
  id: z.string().min(1),
  credit: z.string().optional(),
  width: z.number().positive(),
  height: z.number().positive(),
  hills: z.array(Polyline),
  tufts: z.array(z.tuple([z.number(), z.number()])),
  trees: z.array(
    z.strictObject({
      id: z.string().min(1),
      /** The trunk's center line, base first; `girth` is its width at the base. */
      trunk: Polyline,
      girth: z.number().positive(),
      /** Branch center lines, each from where it leaves the trunk. */
      branches: z.array(Polyline),
      /** The leaves: overlapping circles [x, y, r] drawn as one scalloped outline. */
      canopy: z.array(z.tuple([z.number(), z.number(), z.number().positive()])).min(1),
    }),
  ),
  /**
   * Reed beds: a clump of `stems` reeds with their feet in the oval about (x, y) with radii rx and
   * ry, the tallest `height` tall at the scene's depth reference. The back stems stand behind the
   * birds in the bed and the front stems before them.
   */
  beds: z
    .array(
      z.strictObject({
        x: z.number(),
        y: z.number(),
        rx: z.number().positive(),
        ry: z.number().positive(),
        stems: z.number().int().positive(),
        height: z.number().positive(),
      }),
    )
    .default([]),
  /** Still pools [x, y, rx, ry] on the ground, drawn only (the sim's water is the snapshot's). */
  pools: z.array(z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()])).default([]),
  /** Lane center lines, drawn as faint edges `LANE_WIDTH` apart. */
  lanes: z.array(Polyline).default([]),
  /** Open squares [x, y, rx, ry]: a faint oval on the ground. */
  squares: z
    .array(z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]))
    .default([]),
  /** The band [top, bottom] in scene y where a flying flock is drawn, above everything on the ground. */
  sky: z.tuple([z.number(), z.number()]).default([24, 150]),
  /**
   * Depth (spec 11.1): the land meets the sky at `horizon`, and a thing standing at y is drawn
   * `depthAt(scene, y)` times its size: `far` at the horizon, 1 at `reference`, `near` at the
   * scene's foot, straight between. A scene with depth draws its sky, its hills in aerial
   * perspective, and its ground in color. A scene with water keeps its reference at or below where
   * bodies stand beside the water, so no body outgrows the sim's bank (bank.test.ts).
   */
  depth: z
    .strictObject({
      horizon: z.number(),
      reference: z.number(),
      far: z.number().positive(),
      near: z.number().positive(),
    })
    .optional(),
  benchSpots: z.array(Spot),
  cameras: z.record(
    z.string(),
    z.union([
      z.strictObject({ x: z.number(), y: z.number(), zoom }),
      z.strictObject({ follow: z.string().min(1), zoom }),
    ]),
  ),
});

export type SceneData = z.infer<typeof SceneSchema>;

/**
 * How many times its size a thing standing at scene y is drawn: 1 without depth; with it, `far`
 * at the horizon (and above it), 1 at the reference, `near` at the scene's foot (and below it).
 */
export function depthAt(scene: Pick<SceneData, 'depth' | 'height'>, y: number): number {
  const d = scene.depth;
  if (!d) return 1;
  if (y <= d.reference) {
    const u = Math.max(0, (y - d.horizon) / (d.reference - d.horizon));
    return d.far + (1 - d.far) * u;
  }
  const u = Math.min(1, (y - d.reference) / Math.max(1, scene.height - d.reference));
  return 1 + (d.near - 1) * u;
}

type LiteCreature = WorldLite['creatures'][number];

export interface DrawnCreature {
  id: string;
  speciesId: string;
  x: number;
  y: number;
  state: LiteCreature['state'];
  shell: Shell;
  dancing: boolean;
}

/**
 * Creature positions between two snapshots, matched by id: `alpha` 0 is `prev`, 1 is `next`.
 * A creature in only one snapshot is drawn where that snapshot has it. State, shell, and dancing
 * come from the newer snapshot that has the creature.
 */
export function interpolateCreatures(prev: WorldLite, next: WorldLite, alpha: number): DrawnCreature[] {
  const before = new Map(prev.creatures.map((c) => [c.id, c]));
  const out: DrawnCreature[] = next.creatures.map((b) => {
    const a = before.get(b.id) ?? b;
    before.delete(b.id);
    return {
      id: b.id,
      speciesId: b.speciesId,
      x: a.x + (b.x - a.x) * alpha,
      y: a.y + (b.y - a.y) * alpha,
      state: b.state,
      shell: b.shell,
      dancing: b.dancing,
    };
  });
  for (const a of before.values())
    out.push({
      id: a.id,
      speciesId: a.speciesId,
      x: a.x,
      y: a.y,
      state: a.state,
      shell: a.shell,
      dancing: a.dancing,
    });
  return out;
}
