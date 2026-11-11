// Eating at dusk (ADR 0004 item 3).
import type { DailyRule } from './rule.ts';
import { clamp } from '../math.ts';
import { activeCreatures } from '../world.ts';

/**
 * A creature with no berries counts a hungry dusk (in a row) and bristles; then each eats if it can.
 * A sleeper neither eats nor gets hungry, so it never leaves in its sleep. No draws.
 */
export const eat: DailyRule = (world, t) => {
  for (const c of activeCreatures(world)) {
    if (c.state === 'sleep') continue;
    if (c.berries <= 0) {
      c.hungryDusks += 1;
      c.shell.bristle = clamp(c.shell.bristle + t.shell.hungerBristle, 0, 1);
    } else {
      c.hungryDusks = 0;
    }
    if (c.berries >= t.eat.perDusk) c.berries -= t.eat.perDusk;
  }
  return [];
};
