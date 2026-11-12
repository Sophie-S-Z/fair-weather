// The dew mushroom's next dawn (spec 6.2, ADR 0012 item 5).
import type { DailyRule } from './rule.ts';

/**
 * Sets the next dawn's drops from today's take: mushroom.doubleAtMost or fewer gives twice
 * mushroom.drops, fewer than mushroom.witherAtLeast gives mushroom.drops, and more withers it:
 * 0 drops at the next mushroom.witherDays dawns, then mushroom.drops. Returns one `mushroom`
 * event with today's take and the next dawn's drops. No draws.
 */
export const mushroomDawn: DailyRule = (world, t) => {
  const m = world.mushroom;
  if (!m) return [];
  const { drops, doubleAtMost, witherAtLeast, witherDays } = t.mushroom;
  const taken = m.taken;
  if (m.witherDays > 0) {
    m.witherDays -= 1;
    m.drops = m.witherDays > 0 ? 0 : drops;
  } else if (taken >= witherAtLeast) {
    m.witherDays = witherDays;
    m.drops = 0;
  } else {
    m.drops = taken <= doubleAtMost ? 2 * drops : drops;
  }
  m.taken = 0;
  return [{ t: 'mushroom', taken, drops: m.drops }];
};
