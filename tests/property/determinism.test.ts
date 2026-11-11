// T2 (spec 18): the same seed and commands give the same hash; invariants hold every tick.
import fc from 'fast-check';
import { expect, test } from 'vitest';
import { hashWorld } from '../../src/sim/hash.ts';
import { checkInvariants } from '../../src/sim/invariants.ts';
import { step } from '../../src/sim/step.ts';
import type { Command, World } from '../../src/sim/types.ts';
import { createWorld } from '../../src/sim/world.ts';
import { type Run, runArb, tuning } from './arbitraries.ts';

/** Plays `run` from a fresh world, calling `onTick` on the start state and after every step. */
function replay(run: Run, onTick?: (w: World) => void): World {
  const w = createWorld(run.seed, tuning, run.scenario);
  onTick?.(w);
  for (let tick = 0; tick < run.ticks; tick++) {
    const cmds: Command[] = run.schedule.filter((s) => s.tick === tick).map((s) => s.cmd);
    step(w, cmds, tuning);
    onTick?.(w);
  }
  return w;
}

test('T2: the same seed and commands give the same hash', () => {
  fc.assert(
    fc.property(runArb, (run) => {
      const a = replay(run);
      const b = replay(run);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }),
    { numRuns: 10_000 },
  );
});

test('T2: invariants hold every tick', () => {
  fc.assert(
    fc.property(runArb, (run) => {
      replay(run, (w) => {
        expect(checkInvariants(w, tuning)).toEqual([]);
      });
    }),
    { numRuns: 10_000 },
  );
});
