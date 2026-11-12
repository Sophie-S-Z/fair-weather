// One sim tick (spec 9, ADR 0004 item 1). Mutates the world and returns its events in order.
import type { Command, SimEvent, World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { applyCommand } from './commands.ts';
import { runDusk } from './daily/index.ts';
import { createGrid } from './grid.ts';
import { crossRidge } from './land.ts';
import { lightSkyWarmth } from './light.ts';
import { findMeetings, resolveMeeting } from './meeting.ts';
import { moveCreatures } from './move.ts';
import { createRng } from './rng.ts';

/**
 * Commands in list order, movement, crossing the ridge, meetings, light sky warmth, gust expiry,
 * dusk on the last tick of the day, then `tick += 1`. All draws come from one PRNG resumed from
 * `world.rngState`.
 */
export function step(world: World, commands: readonly Command[], tuning: Tuning): SimEvent[] {
  const rng = createRng(world.rngState);
  const events: SimEvent[] = [];
  for (const cmd of commands) events.push(...applyCommand(world, cmd, tuning, rng));
  moveCreatures(world, tuning, rng);
  events.push(...crossRidge(world));
  const grid = createGrid(tuning.scene.width, tuning.scene.height, tuning.meet.radius);
  for (const [a, b] of findMeetings(world, grid, tuning)) {
    events.push(...resolveMeeting(world, a, b, tuning, rng));
  }
  lightSkyWarmth(world, tuning);
  world.fields.gusts = world.fields.gusts.filter((g) => g.untilTick > world.tick);
  if (world.tick % world.ticksPerDay === world.ticksPerDay - 1) events.push(...runDusk(world, tuning, rng));
  world.tick += 1;
  world.rngState = rng.state();
  return events;
}
