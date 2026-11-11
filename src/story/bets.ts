// Bet measures (spec 10.4) read from a snapshot (ADR 0011 item 3). They only read the world.
import type { WorldLite } from '../sim-host/protocol.ts';
import type { MetricSpec } from '../sim/metrics.ts';

/**
 * maxBerries: among the bet's `options` only, so the answer is always one the player could pick,
 * the id with the most berries; ties go to the lower id by code unit, as in src/sim/metrics.ts;
 * '' when no option is in the snapshot. averageWarmth and friendPairs: from lite.metrics.
 */
export function measureBet(m: MetricSpec, lite: WorldLite, options: readonly string[]): string | number {
  switch (m.kind) {
    case 'maxBerries': {
      let best: { id: string; berries: number } | undefined;
      for (const c of lite.creatures) {
        if (!options.includes(c.id)) continue;
        if (!best || c.berries > best.berries || (c.berries === best.berries && c.id < best.id)) best = c;
      }
      return best?.id ?? '';
    }
    case 'averageWarmth':
      return lite.metrics.averageWarmth;
    case 'friendPairs':
      return lite.metrics.friendPairs;
  }
}
