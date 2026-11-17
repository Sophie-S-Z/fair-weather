import { DISCOVERIES } from '../../../src/toy/discoveries/index.ts';
import { DT, step } from '../../../src/toy/step.ts';
import { createTable, critter, type TableSetup } from '../../../src/toy/table.ts';
import type { Critter, StickerId, Table, ToyEvent } from '../../../src/toy/types.ts';

/** A quiet table: no idle wander, so only the test moves things. */
export const table = (setup: Omit<TableSetup, 'seed'> & { seed?: number }): Table =>
  createTable({ seed: 7, wander: false, ...setup });

/** Steps `seconds` of time and returns every event. */
export function run(t: Table, seconds: number): ToyEvent[] {
  const events: ToyEvent[] = [];
  for (let k = 0; k < Math.round(seconds / DT); k++) {
    step(t, DISCOVERIES);
    events.push(...t.events.splice(0));
  }
  return events;
}

export const found = (events: readonly ToyEvent[]): StickerId[] =>
  events.flatMap((e) => (e.kind === 'found' ? [e.id] : []));

export function get(t: Table, id: string): Critter {
  const c = critter(t, id);
  if (!c) throw new Error(`no ${id}`);
  return c;
}
