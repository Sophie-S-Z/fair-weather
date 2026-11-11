// Twist checks (spec 10.2). Pure predicates over snapshots and events; they never change the world.
import type { WorldLite } from '../sim-host/protocol.ts';
import type { SimEvent } from '../sim/types.ts';

export type TwistId = 'kritExploitsPim' | 'benchWarmsVillage';

/**
 * kritExploitsPim: events carry no meeting id. A meeting emits its two `gift` events together, in
 * one tick's batch, so "the same meeting" means the same tick and the same pair: the caller passes
 * one tick's events, and both Pim's `give` to Krit and Krit's `keep` toward Pim must be in it.
 * benchWarmsVillage: friendPairs rose by at least 3 and averageWarmth by at least 0.1 since `before`.
 */
export function checkTwist(id: TwistId, before: WorldLite, now: WorldLite, events: SimEvent[]): boolean {
  switch (id) {
    case 'kritExploitsPim': {
      const gave = events.some(
        (e) => e.t === 'gift' && e.from === 'pim' && e.to === 'krit' && e.move === 'give',
      );
      const kept = events.some(
        (e) => e.t === 'gift' && e.from === 'krit' && e.to === 'pim' && e.move === 'keep',
      );
      return gave && kept;
    }
    case 'benchWarmsVillage':
      return (
        now.metrics.friendPairs - before.metrics.friendPairs >= 3 &&
        now.metrics.averageWarmth - before.metrics.averageWarmth >= 0.1
      );
  }
}
