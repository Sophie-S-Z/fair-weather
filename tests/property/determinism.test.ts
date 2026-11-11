// T2 (spec 18): the same seed and commands give the same hash; invariants hold every tick.
import fc from 'fast-check';
import { expect, test } from 'vitest';
import { hashWorld } from '../../src/sim/hash.ts';
import { checkInvariants } from '../../src/sim/invariants.ts';
import { step } from '../../src/sim/step.ts';
import type { Command, World } from '../../src/sim/types.ts';
import { createWorld } from '../../src/sim/world.ts';
import { type Run, runArb, tuning } from './arbitraries.ts';

function commandsAt(run: Run, tick: number): Command[] {
  return run.schedule.filter((s) => s.tick === tick).map((s) => s.cmd);
}

/** Steps `w` from its current tick to `run.ticks`, calling `onTick` after every step. */
function playOn(w: World, run: Run, onTick?: (w: World) => void): World {
  while (w.tick < run.ticks) {
    step(w, commandsAt(run, w.tick), tuning);
    onTick?.(w);
  }
  return w;
}

/** Plays `run` from a fresh world, calling `onTick` on the start state and after every step. */
function replay(run: Run, onTick?: (w: World) => void): World {
  const w = createWorld(run.seed, tuning, run.scenario);
  onTick?.(w);
  return playOn(w, run, onTick);
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

test('T2: a structured clone at any tick resumes to the same hash (checkpoint, ADR 0009 item 5)', () => {
  const arb = runArb.chain((run) =>
    fc.record({ run: fc.constant(run), at: fc.integer({ min: 0, max: run.ticks }) }),
  );
  fc.assert(
    fc.property(arb, ({ run, at }) => {
      const original = createWorld(run.seed, tuning, run.scenario);
      while (original.tick < at) step(original, commandsAt(run, original.tick), tuning);
      const checkpoint = structuredClone(original);
      expect(hashWorld(checkpoint)).toBe(hashWorld(original));
      expect(hashWorld(playOn(checkpoint, run))).toBe(hashWorld(playOn(original, run)));
    }),
    { numRuns: 10_000 },
  );
});
