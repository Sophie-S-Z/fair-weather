// Whole-world metrics the story reads (ADR 0011 item 3). The bet measure is story's measureBet
// (src/story/bets.ts); WorldLite carries friendPairs and averageWarmth.
import type { Shell, World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { byId, side } from './world.ts';

export type MetricSpec =
  | { kind: 'maxBerries' }
  | { kind: 'averageWarmth' }
  | { kind: 'friendPairs' }
  | { kind: 'maxShell'; shell: keyof Shell }
  | { kind: 'rumorShare' }
  | { kind: 'warmth'; from: string; to: string }
  | { kind: 'awayCount' };

/** Ties where both sides are above friend.threshold and neither creature is away. */
export function friendPairs(world: World, tuning: Tuning): number {
  let n = 0;
  for (const tie of world.ties.values()) {
    const a = byId(world, tie.a);
    const b = byId(world, tie.b);
    if (!a || !b || a.state === 'away' || b.state === 'away') continue;
    if (side(tie, a.id).warmth > tuning.friend.threshold && side(tie, b.id).warmth > tuning.friend.threshold)
      n++;
  }
  return n;
}
