// Shell values at dusk (ADR 0004 item 11).
import type { DailyRule } from './index.ts';
import { friendCount, activeCreatures } from '../world.ts';

/** Color moves toward the friend count; tightness, bristle, and softness relax toward rest. No draws. */
export const updateShells: DailyRule = (world, t) => {
  const { colorRate, colorFullAt, relaxRate } = t.shell;
  for (const c of activeCreatures(world)) {
    const s = c.shell;
    const target = Math.min(friendCount(world, c, t), colorFullAt) / colorFullAt;
    s.color += colorRate * (target - s.color);
    s.tightness += relaxRate * (c.restShell.tightness - s.tightness);
    s.bristle += relaxRate * (c.restShell.bristle - s.bristle);
    s.softness += relaxRate * (c.restShell.softness - s.softness);
  }
  return [];
};
