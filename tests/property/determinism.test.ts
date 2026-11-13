// T2 (spec 18): the same seed and commands give the same hash; invariants hold every tick.
import fc from 'fast-check';
import { expect, test } from 'vitest';
import { hashWorld } from '../../src/sim/hash.ts';
import { checkInvariants } from '../../src/sim/invariants.ts';
import { step } from '../../src/sim/step.ts';
import { createWorld } from '../../src/sim/world.ts';
import {
  commandsAt,
  landRunArb,
  playOn,
  replay,
  T2_MAX_TICKS,
  T2_TICKS_PER_DAY,
  tuning,
} from './arbitraries.ts';

test('T2 runs can reach the weekly return dusk', () => {
  // The return rule fires on the dusk of day returnEveryDays - 1, the last tick of that day.
  expect(T2_MAX_TICKS).toBeGreaterThanOrEqual(tuning.population.returnEveryDays * T2_TICKS_PER_DAY);
});

test('T2: the same seed and commands give the same hash', () => {
  fc.assert(
    fc.property(landRunArb, (run) => {
      const a = replay(run);
      const b = replay(run);
      expect(hashWorld(a)).toBe(hashWorld(b));
    }),
    { numRuns: 10_000 },
  );
});

test('T2: invariants hold every tick', () => {
  fc.assert(
    fc.property(landRunArb, (run) => {
      replay(run, (w) => {
        expect(checkInvariants(w, tuning)).toEqual([]);
      });
    }),
    { numRuns: 10_000 },
  );
});

test('T2: a structured clone at any tick resumes to the same hash (checkpoint, ADR 0009 item 5)', () => {
  const arb = landRunArb.chain((run) =>
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
