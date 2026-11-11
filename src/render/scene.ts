import { z } from 'zod';
import type { Shell } from '../sim/types.ts';
import type { WorldLite } from '../sim-host/protocol.ts';

const Spot = z.strictObject({ id: z.string().min(1), x: z.number(), y: z.number() });
/** Flat x, y pairs. */
const Polyline = z.array(z.number()).refine((a) => a.length >= 4 && a.length % 2 === 0, 'x, y pairs');

/**
 * A scene layout in scene units, y down (spec 11.1 item 3): far hills, grass tufts, trees,
 * bench spots for the place verb, and named camera shots that beats ask for.
 */
export const SceneSchema = z.strictObject({
  id: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  hills: z.array(Polyline),
  tufts: z.array(z.tuple([z.number(), z.number()])),
  trees: z.array(
    z.strictObject({
      id: z.string().min(1),
      trunk: Polyline,
      crown: z.strictObject({ x: z.number(), y: z.number(), r: z.number().positive() }),
    }),
  ),
  benchSpots: z.array(Spot),
  cameras: z.record(z.string(), z.strictObject({ x: z.number(), y: z.number(), zoom: z.number().min(1) })),
});

export type SceneData = z.infer<typeof SceneSchema>;

type LiteCreature = WorldLite['creatures'][number];

export interface DrawnCreature {
  id: string;
  x: number;
  y: number;
  state: LiteCreature['state'];
  shell: Shell;
}

/**
 * Creature positions between two snapshots, matched by id: `alpha` 0 is `prev`, 1 is `next`.
 * A creature in only one snapshot is drawn where that snapshot has it. State and shell come
 * from the newer snapshot that has the creature.
 */
export function interpolateCreatures(prev: WorldLite, next: WorldLite, alpha: number): DrawnCreature[] {
  const before = new Map(prev.creatures.map((c) => [c.id, c]));
  const out: DrawnCreature[] = next.creatures.map((b) => {
    const a = before.get(b.id) ?? b;
    before.delete(b.id);
    return {
      id: b.id,
      x: a.x + (b.x - a.x) * alpha,
      y: a.y + (b.y - a.y) * alpha,
      state: b.state,
      shell: b.shell,
    };
  });
  for (const a of before.values()) out.push({ id: a.id, x: a.x, y: a.y, state: a.state, shell: a.shell });
  return out;
}
