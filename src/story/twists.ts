// Twist checks (spec 10.2). Pure predicates over snapshots and events; they never change the world.
import type { WorldLite } from '../sim-host/protocol.ts';
import type { SimEvent } from '../sim/types.ts';
import { creature, rumorShare, warmth } from './bets.ts';

export const TWIST_IDS = [
  'kritExploitsPim',
  'benchWarmsVillage',
  'thornsGrow',
  'rumorDrowns',
  'revengeLoop',
  'wispLeaves',
  'mossShares',
  'bellDances',
] as const;
export type TwistId = (typeof TWIST_IDS)[number];

/** Float slack so a rise of exactly 0.1 passes despite rounding (for example 0.3 - 0.2). */
const EPSILON = 1e-9;

const gave = (events: SimEvent[], from: string, to: string, move: 'give' | 'keep'): boolean =>
  events.some((e) => e.t === 'gift' && e.from === from && e.to === to && e.move === move);

/** The mean shell tightness of the creatures not away; 0 with none. */
function meanTightness(lite: WorldLite): number {
  const here = lite.creatures.filter((c) => c.state !== 'away');
  return here.length === 0 ? 0 : here.reduce((sum, c) => sum + c.shell.tightness, 0) / here.length;
}

/**
 * kritExploitsPim: events carry no meeting id. A meeting emits its two `gift` events together, in
 * one tick's batch, so "the same meeting" means the same tick and the same pair: the caller passes
 * one tick's events, and both Pim's `give` to Krit and Krit's `keep` toward Pim must be in it.
 * benchWarmsVillage: friendPairs rose by at least 3 and averageWarmth by at least 0.1 since `before`.
 * thornsGrow: the mean tightness of creatures not away rose by at least 0.03 since `before`.
 * rumorDrowns: the rumor's holders are at least half of the creatures not away, `about` left out.
 * revengeLoop: both warmths of the Echo and Krit tie are below 0.
 * wispLeaves: Wisp is gone over the ridge. mossShares: Moss gives to Krit. bellDances: Bell is dancing.
 */
export function checkTwist(id: TwistId, before: WorldLite, now: WorldLite, events: SimEvent[]): boolean {
  switch (id) {
    case 'kritExploitsPim':
      return gave(events, 'pim', 'krit', 'give') && gave(events, 'krit', 'pim', 'keep');
    case 'benchWarmsVillage':
      return (
        now.metrics.friendPairs - before.metrics.friendPairs >= 3 &&
        now.metrics.averageWarmth - before.metrics.averageWarmth >= 0.1 - EPSILON
      );
    case 'thornsGrow':
      return meanTightness(now) - meanTightness(before) >= 0.03 - EPSILON;
    case 'rumorDrowns':
      return rumorShare(now) >= 0.5;
    case 'revengeLoop':
      return warmth(now, 'echo', 'krit') < 0 && warmth(now, 'krit', 'echo') < 0; // 0 with no tie
    case 'wispLeaves':
      // Gone, not only away: the line says Wisp went over the ridge, and hunger or the carry can also
      // leave Wisp away.
      return creature(now, 'wisp')?.gone === true;
    case 'mossShares':
      return gave(events, 'moss', 'krit', 'give');
    case 'bellDances':
      return creature(now, 'bell')?.dancing === true;
  }
}
