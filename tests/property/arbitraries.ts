// fast-check arbitraries for the T2 determinism property (spec 18, plan task M0.8).
import fc from 'fast-check';
import tuningJson from '../../content/tuning.json';
import { parseTuning } from '../../src/sim/tuning.ts';
import { inRect } from '../../src/sim/land.ts';
import { step } from '../../src/sim/step.ts';
import type { Command, Rect, Scenario, Season, World } from '../../src/sim/types.ts';
import { DIAL_KEYS, HERO, HERO_KINDS } from '../../src/sim/types.ts';
import { createWorld } from '../../src/sim/world.ts';

export const tuning = parseTuning(tuningJson);

const SEASONS: Season[] = ['spring', 'summer', 'lateSummer', 'autumn', 'winter', 'thaw'];
const unit = fc.double({ min: 0, max: 1, noNaN: true });
const sx = fc.double({ min: 0, max: tuning.scene.width, noNaN: true });
const sy = fc.double({ min: 0, max: tuning.scene.height, noNaN: true });

/** Ticks per day in every generated scenario: short days, so dusk comes often. */
export const T2_TICKS_PER_DAY = 20;
/** The longest run: 8 days, so a run can pass the weekly return dusk (day % 7 === 6). */
export const T2_MAX_TICKS = 8 * T2_TICKS_PER_DAY;

const sideArb = fc.record({ warmth: fc.double({ min: -2, max: 2, noNaN: true }), slights: fc.nat(3) });

/** A hero of any kind, half the time with a rumor of any value and strength. */
const heroArb: fc.Arbitrary<NonNullable<Scenario['hero']>> = fc.record({
  kind: fc.constantFrom(...HERO_KINDS),
  name: fc.constant('Wren'),
  x: sx,
  y: sy,
  berries: fc.integer({ min: 0, max: 5 }),
  keepsakes: fc.constant([]),
  rumor: fc.option(fc.record({ value: fc.double({ min: -1, max: 1, noNaN: true }), strength: unit }), {
    freq: 2,
    nil: null,
  }),
});

/**
 * 2 to 12 creatures and T2_TICKS_PER_DAY, so every daily rule can fire inside a short run. Sky
 * warmth runs past [-1, 1] and some scenario ties name an unknown id, to test the clamp and drop.
 * Half the scenarios have a hero. Two fifths have no pack. A fifth are in Murmuration Fen: some
 * creatures are starlings, some of the ids (and an unknown one) are restless, and some have a fixed
 * threshold. A fifth are in Hearsay Hollow, and a fifth in Halcyon, where the seeker is any id (or
 * an unknown one), Kith's warmth is any, and the hero holds two keepsakes. A quarter are sandbox
 * worlds, with 1 to 4 days a season, any base fog, any of the network switches, and no hero, as in
 * the sandbox (ADR 0014 items 1 and 3).
 */
export const scenarioArb: fc.Arbitrary<Scenario> = fc
  .record({
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
          skyWarmth: fc.double({ min: -2, max: 2, noNaN: true }),
        }),
        { minLength: 2, maxLength: 12 },
      )
      .map((cs) =>
        cs.map((c, i) => ({ ...c, id: `c${String(i)}`, speciesId: 'kith', name: `C${String(i)}` })),
      ),
    bushes: fc
      .array(fc.record({ x: sx, y: sy, berries: fc.integer({ min: 0, max: 6 }) }), { maxLength: 4 })
      .map((bs) => bs.map((b, i) => ({ ...b, id: `bush-s${String(i)}` }))),
    structures: fc
      .array(fc.record({ x: sx, y: sy }), { maxLength: 2 })
      .map((ss) => ss.map((s, i) => ({ ...s, id: `bench-s${String(i)}`, kind: 'bench' as const }))),
  })
  .chain((scenario) => {
    const id = fc.oneof(
      { weight: 9, arbitrary: fc.constantFrom(...scenario.creatures.map((c) => c.id)) },
      { weight: 1, arbitrary: fc.constant('nobody') },
    );
    const ids = [...scenario.creatures.map((c) => c.id), 'nobody'];
    const fen = fc.record({
      starlings: fc.subarray(ids),
      restless: fc.subarray(ids),
      fixed: fc.dictionary(fc.constantFrom(...ids), unit, { maxKeys: 3 }),
    });
    return fc
      .record({
        ties: fc.array(fc.record({ a: id, b: id, ab: sideArb, ba: sideArb }), { maxLength: 8 }),
        hero: fc.option(heroArb, { freq: 2, nil: undefined }),
        sandbox: fc.oneof(
          { weight: 3, arbitrary: fc.constant(undefined) },
          {
            weight: 1,
            arbitrary: fc.record({
              seasonDays: fc.integer({ min: 1, max: 4 }),
              baseFog: unit,
              network: fc.record(
                {
                  mutual: fc.constant(true as const),
                  weighted: fc.constant(true as const),
                  drift: fc.constant(true as const),
                },
                { requiredKeys: [] },
              ),
            }),
          },
        ),
        pack: fc.oneof(
          { weight: 2, arbitrary: fc.constant(undefined) },
          { weight: 1, arbitrary: fen },
          { weight: 1, arbitrary: fc.constant('hollow' as const) },
          {
            weight: 1,
            arbitrary: fc.record({ seeker: id, kithWarmth: fc.double({ min: -1, max: 1, noNaN: true }) }),
          },
        ),
      })
      .map(({ ties, hero, sandbox, pack }): Scenario => {
        const out: Scenario = sandbox
          ? { ...scenario, ties, sandbox: true, ...sandbox }
          : hero
            ? { ...scenario, ties, hero }
            : { ...scenario, ties };
        if (!pack) return out;
        if (pack === 'hollow') return { ...out, pack: { id: 'hollow' } };
        if ('seeker' in pack) {
          const keepsakes = ['feather', 'acorn'];
          return {
            ...out,
            ...(out.hero ? { hero: { ...out.hero, keepsakes } } : {}),
            pack: { id: 'halcyon', ...pack },
          };
        }
        const creatures = out.creatures.map((c) =>
          pack.starlings.includes(c.id) ? { ...c, speciesId: 'starling' } : c,
        );
        return { ...out, creatures, pack: { id: 'fen', restless: pack.restless, fixed: pack.fixed } };
      });
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
      kind: fc.constantFrom('bench' as const, 'bush' as const, 'bridge' as const, 'lantern' as const),
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
    fc.record({ t: fc.constant('dance' as const), who: id }),
    fc.record({ t: fc.constant('walk' as const), x, y }),
    fc.record({ t: fc.constant('walk' as const), to: id }),
    fc.record({
      t: fc.constant('manner' as const),
      reply: fc.constantFrom('toward' as const, 'away' as const, 'against' as const),
      gift: fc.constantFrom('give' as const, 'keep' as const),
    }),
    fc.record({ t: fc.constant('plant' as const) }),
    fc.record({
      t: fc.constant('local' as const),
      verb: fc.oneof(
        fc.record({ verb: fc.constant('join' as const), on: fc.boolean() }),
        fc.record({ verb: fc.constant('pose' as const) }),
        fc.record({ verb: fc.constant('keepsake' as const), to: id, item: fc.constant('feather') }),
      ),
    }),
    fc.record({ t: fc.constant('nudge' as const), dial: fc.constantFrom(...DIAL_KEYS), amount: num(-1, 1) }),
    fc.record({ t: fc.constant('rain' as const), x, y }),
    fc.record({ t: fc.constant('welcome' as const), on: fc.boolean() }),
    fc.record({ t: fc.constant('path' as const), x, y, x2: x, y2: y }),
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
          cmd: commandArb([...scenario.creatures.map((c) => c.id), ...(scenario.hero ? [HERO] : [])]),
        }),
        { maxLength: 15 },
      )
      .map((schedule) => ({ seed, scenario, ticks, schedule })),
  );

/** A point inside `r`. */
const inside = (r: Rect) =>
  fc.record({
    x: fc.double({ min: r.x, max: r.x + r.w, noNaN: true }),
    y: fc.double({ min: r.y, max: r.y + r.h, noNaN: true }),
  });

/** 1 to 200 units wide and high, east of the gate, so returns and newcomers arrive on land. */
const rectArb: fc.Arbitrary<Rect> = fc
  .record({
    x: fc.double({ min: tuning.scene.gateX + 10, max: tuning.scene.width - 1, noNaN: true }),
    y: fc.double({ min: 0, max: tuning.scene.height - 1, noNaN: true }),
    w: fc.double({ min: 1, max: 200, noNaN: true }),
    h: fc.double({ min: 1, max: 200, noNaN: true }),
  })
  .map((r) => ({
    ...r,
    w: Math.min(r.w, tuning.scene.width - r.x),
    h: Math.min(r.h, tuning.scene.height - r.y),
  }));

/**
 * `runArb` with 0 to 2 water rectangles, 0 to 2 bridges in them, 0 to 2 lanterns, and sometimes
 * a ridge, a mushroom, ambient sky bids, and a dance threshold of 1 to 3 on the first creature.
 * Creatures, the hero among them, that would start in water are dropped.
 */
export const landRunArb: fc.Arbitrary<Run> = runArb.chain((run) =>
  fc.array(rectArb, { maxLength: 2 }).chain((water) =>
    fc
      .record({
        bridges:
          water.length > 0
            ? fc.array(fc.constantFrom(...water).chain(inside), { maxLength: 2 })
            : fc.constant<{ x: number; y: number }[]>([]),
        lanterns: fc.array(fc.record({ x: sx, y: sy }), { maxLength: 2 }),
        ridgeX: fc.option(fc.double({ min: 200, max: tuning.scene.width, noNaN: true }), { nil: undefined }),
        mushroom: fc.option(fc.record({ x: sx, y: sy }), { nil: undefined }),
        ambientSkyBids: fc.boolean(),
        danceThreshold: fc.option(fc.integer({ min: 1, max: 3 }), { nil: undefined }),
      })
      .map(({ bridges, lanterns, ridgeX, mushroom, ambientSkyBids, danceThreshold }) => {
        const scenario: Scenario = {
          ...run.scenario,
          creatures: run.scenario.creatures.filter((c) => !water.some((r) => inRect(r, c.x, c.y))),
          structures: [
            ...run.scenario.structures,
            ...bridges.map((p, i) => ({ ...p, id: `bridge-s${String(i)}`, kind: 'bridge' as const })),
            ...lanterns.map((p, i) => ({ ...p, id: `lantern-s${String(i)}`, kind: 'lantern' as const })),
          ],
        };
        const hero = scenario.hero;
        if (hero && water.some((r) => inRect(r, hero.x, hero.y))) delete scenario.hero;
        if (water.length > 0) scenario.water = water;
        if (ridgeX !== undefined) scenario.ridgeX = ridgeX;
        if (mushroom) scenario.mushroom = mushroom;
        if (ambientSkyBids) scenario.ambientSkyBids = true;
        const [first, ...rest] = scenario.creatures;
        if (first && danceThreshold !== undefined)
          scenario.creatures = [{ ...first, danceThreshold }, ...rest];
        return { ...run, scenario };
      }),
  ),
);

export function commandsAt(run: Run, tick: number): Command[] {
  return run.schedule.filter((s) => s.tick === tick).map((s) => s.cmd);
}

/** Steps `w` from its current tick to `run.ticks`, calling `onTick` after every step. */
export function playOn(w: World, run: Run, onTick?: (w: World) => void): World {
  while (w.tick < run.ticks) {
    step(w, commandsAt(run, w.tick), tuning);
    onTick?.(w);
  }
  return w;
}

/** Plays `run` from a fresh world, calling `onTick` on the start state and after every step. */
export function replay(run: Run, onTick?: (w: World) => void): World {
  const w = createWorld(run.seed, tuning, run.scenario);
  onTick?.(w);
  return playOn(w, run, onTick);
}
