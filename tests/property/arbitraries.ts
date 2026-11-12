// fast-check arbitraries for the T2 determinism property (spec 18, plan task M0.8).
import fc from 'fast-check';
import tuningJson from '../../content/tuning.json';
import { parseTuning } from '../../src/sim/tuning.ts';
import type { Command, Scenario, Season } from '../../src/sim/types.ts';

export const tuning = parseTuning(tuningJson);

const SEASONS: Season[] = ['spring', 'summer', 'lateSummer', 'autumn', 'winter', 'thaw'];
const unit = fc.double({ min: 0, max: 1, noNaN: true });
const sx = fc.double({ min: 0, max: tuning.scene.width, noNaN: true });
const sy = fc.double({ min: 0, max: tuning.scene.height, noNaN: true });

/** Ticks per day in every generated scenario: short days, so dusk comes often. */
export const T2_TICKS_PER_DAY = 20;
/** The longest run: 8 days, so a run can pass the weekly return dusk (day % 7 === 6). */
export const T2_MAX_TICKS = 8 * T2_TICKS_PER_DAY;

/** 2 to 12 creatures and T2_TICKS_PER_DAY, so every daily rule can fire inside a short run. */
export const scenarioArb: fc.Arbitrary<Scenario> = fc.record({
  valleyId: fc.constant('kith'),
  season: fc.constantFrom(...SEASONS),
  ticksPerDay: fc.constant(T2_TICKS_PER_DAY),
  creatures: fc
    .array(
      fc.record({
        x: sx,
        y: sy,
        berries: fc.integer({ min: 0, max: 5 }),
        dials: fc.record({ opener: unit, forgiveness: unit, memory: unit, ear: unit, wanderlust: unit }),
        shell: fc.record({ tightness: unit, bristle: unit, color: unit, softness: unit }),
      }),
      { minLength: 2, maxLength: 12 },
    )
    .map((cs) => cs.map((c, i) => ({ ...c, id: `c${String(i)}`, speciesId: 'kith', name: `C${String(i)}` }))),
  bushes: fc
    .array(fc.record({ x: sx, y: sy, berries: fc.integer({ min: 0, max: 6 }) }), { maxLength: 4 })
    .map((bs) => bs.map((b, i) => ({ ...b, id: `bush-s${String(i)}` }))),
  structures: fc
    .array(fc.record({ x: sx, y: sy }), { maxLength: 2 })
    .map((ss) => ss.map((s, i) => ({ ...s, id: `bench-s${String(i)}`, kind: 'bench' as const }))),
});

/** A coordinate-sized number, NaN 5% of the time. */
const num = (min: number, max: number) =>
  fc.oneof(
    { weight: 19, arbitrary: fc.double({ min, max, noNaN: true }) },
    { weight: 1, arbitrary: fc.constant(NaN) },
  );

/** Every Command kind. Ids come from `ids`, plus newcomer ids and a bad id 5% of the time. */
export function commandArb(ids: readonly string[]): fc.Arbitrary<Command> {
  const id = fc.oneof(
    { weight: 17, arbitrary: fc.constantFrom(...ids) },
    { weight: 2, arbitrary: fc.constantFrom('newcomer-1', 'newcomer-2') },
    { weight: 1, arbitrary: fc.constant('nobody') },
  );
  const x = num(-50, tuning.scene.width + 50);
  const y = num(-50, tuning.scene.height + 50);
  const d = num(-300, 300);
  return fc.oneof(
    fc.record({ t: fc.constant('shine' as const), x, y }),
    fc.record({ t: fc.constant('paintFog' as const), x, y, r: num(0, 200), amount: num(-1, 1) }),
    fc.record({ t: fc.constant('blow' as const), x, y, dx: d, dy: d }),
    fc.record({
      t: fc.constant('place' as const),
      kind: fc.constantFrom('bench' as const, 'bush' as const),
      x,
      y,
    }),
    fc.record({ t: fc.constant('thread' as const), a: id, b: id, on: fc.boolean() }),
    fc.record({
      t: fc.constant('whisper' as const),
      target: id,
      about: id,
      sign: fc.constantFrom(1 as const, -1 as const),
    }),
    fc.record({
      t: fc.constant('respond' as const),
      to: id,
      reply: fc.constantFrom('toward' as const, 'away' as const, 'against' as const),
    }),
    fc.record({ t: fc.constant('arrangeMeeting' as const), a: id, b: id }),
    fc.record({ t: fc.constant('setSeason' as const), season: fc.constantFrom(...SEASONS) }),
    fc.record({ t: fc.constant('wake' as const), who: id }),
    fc.record({ t: fc.constant('promptSkyBid' as const), who: id }),
    fc.record({ t: fc.constant('overPoke' as const) }),
  );
}

export interface Run {
  seed: number;
  scenario: Scenario;
  schedule: { tick: number; cmd: Command }[];
  ticks: number;
}

/** A seed, a scenario, 1 to T2_MAX_TICKS ticks, and 0 to 15 commands scheduled inside the run. */
export const runArb: fc.Arbitrary<Run> = fc
  .record({
    seed: fc.integer({ min: 0, max: 0xffffffff }),
    scenario: scenarioArb,
    ticks: fc.integer({ min: 1, max: T2_MAX_TICKS }),
  })
  .chain(({ seed, scenario, ticks }) =>
    fc
      .array(
        fc.record({
          tick: fc.integer({ min: 0, max: ticks - 1 }),
          cmd: commandArb(scenario.creatures.map((c) => c.id)),
        }),
        { maxLength: 15 },
      )
      .map((schedule) => ({ seed, scenario, ticks, schedule })),
  );
