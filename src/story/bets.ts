// Bet measures (spec 10.4) read from a snapshot (ADR 0011 item 3). They only read the world.
import type { WorldLite } from '../sim-host/protocol.ts';
import type { MetricSpec } from '../sim/metrics.ts';

/**
 * maxBerries: the id of the creature with the most berries; ties go to the lower id by code unit,
 * as in src/sim/metrics.ts; '' with no creatures. averageWarmth and friendPairs: from lite.metrics.
 */
export function measureBet(m: MetricSpec, lite: WorldLite): string | number {
  switch (m.kind) {
    case 'maxBerries': {
      let best: { id: string; berries: number } | undefined;
      for (const c of lite.creatures) {
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
