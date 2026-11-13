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
 * 7.3) reeds, lanes, and squares on the ground and the sky band where a flock flies; bench spots
 * for the place verb, and named camera shots that beats ask for. A shot centers a
 * fixed point, or follows a creature by id. `credit` names who made the layout; a placeholder
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
  /** Reeds [x, y, h]: a stem from its foot at (x, y), h tall, with a seed head. */
  reeds: z.array(z.tuple([z.number(), z.number(), z.number().positive()])).default([]),
  /** Lane center lines, drawn as faint edges `LANE_WIDTH` apart. */
  lanes: z.array(Polyline).default([]),
  /** Open squares [x, y, rx, ry]: a faint oval on the ground. */
  squares: z
    .array(z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]))
    .default([]),
  /** The band [top, bottom] in scene y where a flying flock is drawn, above everything on the ground. */
  sky: z.tuple([z.number(), z.number()]).default([24, 150]),
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
