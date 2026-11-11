// Fog lookup, light boosts, and sky warmth from the light (spec 9.4, ADR 0003 item 5, ADR 0004 items 9 and 12).
import type { Behavior, World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { clamp, dist2 } from './math.ts';
import { activeCreatures } from './world.ts';

/** Fog (0..1) in the fog cell under (x, y); points outside the scene use the nearest edge cell. */
export function fogAt(world: World, x: number, y: number, t: Tuning): number {
  const { fog, fogW, fogH } = world.fields;
  const col = clamp(Math.floor(x / t.fog.cellSize), 0, fogW - 1);
  const row = clamp(Math.floor(y / t.fog.cellSize), 0, fogH - 1);
  return fog[row * fogW + col] ?? 0;
}

function inLens(world: World, x: number, y: number, t: Tuning): boolean {
  const light = world.fields.light;
  if (!light) return false;
  return dist2(x, y, light.x, light.y) <= t.light.lensRadius * t.light.lensRadius;
}

/** Sum of live boosts for `behavior` within light.radius of (x, y), capped at light.cap. */
export function boostAt(world: World, behavior: Behavior, x: number, y: number, t: Tuning): number {
  const r2 = t.light.radius * t.light.radius;
  let sum = 0;
  for (const b of world.boosts) {
    if (b.behavior !== behavior || b.untilDay < world.day) continue;
    if (dist2(x, y, b.x, b.y) <= r2) sum += t.light.boost;
  }
  return Math.min(sum, t.light.cap);
}

/** A meeting at (x, y) inside the lens adds one boost per listed behavior. */
export function recordLitMeeting(world: World, x: number, y: number, behaviors: Behavior[], t: Tuning): void {
  if (!inLens(world, x, y, t)) return;
  const untilDay = world.day + t.light.days;
  for (const behavior of behaviors) world.boosts.push({ behavior, x, y, untilDay });
}

/** Per tick: each active creature in the lens gains sky warmth, up to sky.lightDailyCap per day. */
export function lightSkyWarmth(world: World, t: Tuning): void {
  const perTick = t.sky.lightPerSecond / t.sim.stepsPerSecond;
  for (const c of activeCreatures(world)) {
    if (!inLens(world, c.x, c.y, t) || (c.lensAvoidUntilDay ?? -1) >= world.day) continue;
    const gain = Math.min(perTick, t.sky.lightDailyCap - c.skyLightToday);
    if (gain <= 0) continue;
    c.skyLightToday += gain;
    c.skyWarmth = clamp(c.skyWarmth + gain, -1, 1);
  }
}
