// Rain on the bushes (ADR 0014 item 5, ADR 0015 item 4): the sandbox's rain verb and the council's
// cloud. Its own file, so the council's pack can use it without an import cycle through commands.
import type { World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { dist2 } from './math.ts';

/**
 * Every bush within rain.radius of (x, y) gains rain.berries, up to bush.limit, but a Seedcarrier's
 * gift, which never regrows (ADR 0013 item 3). No draw.
 */
export function rain(world: World, x: number, y: number, t: Tuning): void {
  const r2 = t.rain.radius * t.rain.radius;
  for (const b of world.bushes) {
    if (!b.gift && dist2(b.x, b.y, x, y) <= r2 && b.berries < t.bush.limit) {
      b.berries = Math.min(b.berries + t.rain.berries, t.bush.limit);
    }
  }
}
