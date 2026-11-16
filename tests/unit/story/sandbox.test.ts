import { expect, test } from 'vitest';
import { SANDBOX_BASES } from '../../golden/run-sandbox.ts';
import fenJson from '../../../content/scenarios/fen.json';
import halcyonJson from '../../../content/scenarios/halcyon.json';
import m0Json from '../../../content/scenarios/m0.json';
import sceneJson from '../../../content/scenes/kith-meadow.json';
import tuningJson from '../../../content/tuning.json';
import type { FromWorker, SimPort, WorldLite } from '../../../src/sim-host/protocol.ts';
import { parseTuning } from '../../../src/sim/tuning.ts';
import type { Command, Scenario, Tuning } from '../../../src/sim/types.ts';
import type { Carry } from '../../../src/story/carry.ts';
import {
  DEFAULT_SWITCHES,
  GUST_REACH,
  KNOBS,
  KNOB_IDS,
  MAX_CARDS,
  MAX_ENTRIES,
  SandboxSetupSchema,
  createSandboxRunner,
  knobText,
  knobValue,
  sandboxScenario,
  sandboxTuning,
} from '../../../src/story/sandbox.ts';
import type { KnobId, SandboxSetup } from '../../../src/story/sandbox.ts';

const base: Tuning = tuningJson;
const bases = SANDBOX_BASES;
const spots = sceneJson.benchSpots;
const knob = (id: KnobId) => {
  const k = KNOBS.find((x) => x.id === id);
  if (!k) throw new Error(id);
  return k;
};
const imitation = knob('imitationRate');
const setup = (over: Partial<SandboxSetup> = {}): SandboxSetup => ({
  seed: 1,
  valley: 'kith',
  kith: null,
  challenge: null,
  knobs: {},
  switches: { ...DEFAULT_SWITCHES },
  structures: [],
  bushes: [],
  ...over,
});
const build = (over: Partial<SandboxSetup> = {}): Scenario => sandboxScenario(setup(over), bases, spots);

test('knobValue gives the decimal double: imitationRate index 6 is exactly 0.3', () => {
  expect(knobValue(imitation, 6)).toBe(0.3);
  expect(KNOBS.map((k) => k.id)).toEqual(KNOB_IDS);
});

test('every knob at every index gives the exact decimal double', () => {
  for (const k of KNOBS) {
    const steps = k.steps === 'benchSpots' ? spots.length : k.steps;
    for (let i = 0; i <= steps; i++) {
      expect(knobValue(k, i), `${k.id} ${String(i)}`).toBe(Number(((k.low + i * k.step) / 100).toFixed(2)));
    }
  }
});

test("every tuning knob at every index gives a tuning the worker's schema takes", () => {
  for (const k of KNOBS) {
    if (k.steps === 'benchSpots') continue; // a scenario knob
    for (let i = 0; i <= k.steps; i++) {
      const t = sandboxTuning(setup({ valley: k.valley ?? 'kith', knobs: { [k.id]: i } }), base);
      expect(() => parseTuning(t), `${k.id} ${String(i)}`).not.toThrow();
    }
  }
});

test('giftValue index 2 sets gift.value 2 and gift.valueWinter 1; index 0 sets both to 0', () => {
  const two = sandboxTuning(setup({ knobs: { giftValue: 2 } }), base);
  expect(two.gift).toEqual({ ...base.gift, value: 2, valueWinter: 1 });
  const zero = sandboxTuning(setup({ knobs: { giftValue: 0 } }), base);
  expect([zero.gift.value, zero.gift.valueWinter]).toEqual([0, 0]);
  expect(base.gift.value).toBe(3); // the base is never changed
});

test('an unset knob leaves the tuning deep-equal to the base', () => {
  const t = sandboxTuning(setup(), base);
  expect(t).toEqual(base);
  expect(t).not.toBe(base);
  expect(t.gift).not.toBe(base.gift);
});

test('flockHigh below flockLow gives thresholdSpan 0', () => {
  const below = sandboxTuning(setup({ valley: 'fen', knobs: { flockLow: 10, flockHigh: 4 } }), base);
  expect(below.fen).toEqual({ ...base.fen, thresholdMin: 0.5, thresholdSpan: 0 });
  // The span is exact in hundredths: 0.8 − 0.2 gives 0.6, not 0.6000000000000001.
  const fen = (knobs: SandboxSetup['knobs']) => sandboxTuning(setup({ valley: 'fen', knobs }), base).fen;
  expect(fen({ flockLow: 4, flockHigh: 16 }).thresholdSpan).toBe(0.6);
  // With one knob set, the other counts as its unset value (low 0.2, high 0.8).
  expect(fen({ flockHigh: 18 }).thresholdSpan).toBe(0.7);
  expect(fen({ flockLow: 10 })).toEqual({ ...base.fen, thresholdMin: 0.5, thresholdSpan: 0.3 });
});

test('a Kith setup with a carry starts in spring with the carry, sandbox true, seasonDays 7', () => {
  const pim = m0Json.creatures.find((c) => c.id === 'pim');
  if (!pim) throw new Error('pim');
  const dials = { ...pim.dials, opener: 0.25 };
  const shell = { tightness: 0.1, bristle: 0.2, color: 0.3, softness: 0.4 };
  const kith: Carry = {
    creatures: [{ id: 'pim', dials, shell, skyWarmth: 0.5, away: false, gone: false, diary: [] }],
    ties: [{ a: 'krit', b: 'pim', ab: 0.4, ba: 0.6 }],
  };
  const s = sandboxScenario(setup({ kith }), { ...bases, kith: { ...bases.kith, season: 'winter' } }, spots);
  expect(s.season).toBe('spring');
  expect(s.creatures.find((c) => c.id === 'pim')).toMatchObject({ dials, shell, skyWarmth: 0.5 });
  expect(s.ties).toEqual([
    { a: 'krit', b: 'pim', ab: { warmth: 0.4, slights: 0 }, ba: { warmth: 0.6, slights: 0 } },
  ]);
  expect(s.sandbox).toBe(true);
  expect(s.seasonDays).toBe(7);
  expect(s.ticksPerDay).toBe(400);
  expect('network' in s).toBe(false);
  expect('baseFog' in s).toBe(false);
  expect(build({ knobs: { seasonLength: 0, fogLevel: 7 } })).toMatchObject({ seasonDays: 2, baseFog: 0.7 });
  expect(bases.kith.sandbox).toBeUndefined(); // the base is never changed
});

test('benchDensity 2 puts sandbox-bench-under-crooked-tree and sandbox-bench-east-meadow at their spots', () => {
  const placed = { id: 'lamp-1', kind: 'lantern', x: 300, y: 300 } as const;
  const s = build({ knobs: { benchDensity: 2 }, structures: [placed] });
  expect(s.structures).toEqual([
    { id: 'sandbox-bench-under-crooked-tree', kind: 'bench', x: 600, y: 430 },
    { id: 'sandbox-bench-east-meadow', kind: 'bench', x: 1050, y: 540 },
    placed,
  ]);
  expect(() => build({ knobs: { benchDensity: spots.length + 1 } })).toThrow('bench spots');
});

test('mixed off sets every Ear to the gossip threshold; mixed on keeps them', () => {
  const ears = (s: Scenario) => s.creatures.map((c) => c.dials.ear);
  const off = { ...DEFAULT_SWITCHES, mixed: false };
  expect(new Set(ears(build({ switches: off, knobs: { gossipThreshold: 3 } })))).toEqual(new Set([0.15]));
  expect(new Set(ears(build({ switches: off })))).toEqual(new Set([0.5])); // the knob's unset value
  expect(ears(build({ knobs: { gossipThreshold: 3 } }))).toEqual(m0Json.creatures.map((c) => c.dials.ear));
});

test('oneWay off sets network.mutual; weighted and drift set theirs', () => {
  const net = (over: Partial<SandboxSetup['switches']>) =>
    build({ switches: { ...DEFAULT_SWITCHES, ...over } }).network;
  expect(net({ oneWay: false })).toEqual({ mutual: true });
  expect(net({ weighted: true })).toEqual({ weighted: true });
  expect(net({ drift: true })).toEqual({ drift: true });
  expect(net({ oneWay: false, weighted: true, drift: true })).toEqual({
    mutual: true,
    weighted: true,
    drift: true,
  });
});

test('a fen setup keeps the fen pack and has no hero; halcyon gets kithWarmth 0', () => {
  const fen = build({ valley: 'fen' });
  expect(fen.pack).toEqual(fenJson.pack);
  expect(fen.season).toBe(fenJson.season);
  expect(fen.hero).toBeUndefined();
  const withHero = {
    ...bases.fen,
    hero: { kind: 'kite', name: 'Ada', x: 40, y: 450, berries: 3, keepsakes: [], rumor: null },
  } as Scenario;
  expect(sandboxScenario(setup({ valley: 'fen' }), { ...bases, fen: withHero }, spots).hero).toBeUndefined();
  const halcyon = build({ valley: 'halcyon' });
  expect(halcyon.pack).toEqual({ ...halcyonJson.pack, kithWarmth: 0 });
  expect(halcyon.season).toBe('summer');
});

test('knobText shows a named knob by name and an unset knob to two places', () => {
  expect(knobText(knob('votingRule'), undefined)).toBe('Plurality');
  expect(knobText(knob('votingRule'), 2)).toBe('Instant runoff');
  expect(knobText(knob('minShare'), undefined)).toBe('0.33');
  expect(knobText(knob('minShare'), 4)).toBe('0.2');
  expect(knobText(knob('snailSight'), 1)).toBe('2');
});

test('the Stage 2 knobs set sight, the voting rule, and the frog shares; maxShare turns the variety rule on', () => {
  const t = sandboxTuning(setup({ valley: 'foglight', knobs: { snailSight: 2 } }), base);
  expect(t.foglight.sight).toBe(3);
  const council = build({ valley: 'council', knobs: { votingRule: 3 } });
  expect(council.pack?.id === 'council' && council.pack.rule).toBe('score');
  const shares = sandboxTuning(setup({ valley: 'shallows', knobs: { minShare: 6, maxShare: 2 } }), base);
  expect([shares.shallows.minShare, shares.shallows.maxShare]).toEqual([0.3, 0.6]);
  const pond = (knobs: SandboxSetup['knobs']) => {
    const p = build({ valley: 'shallows', knobs }).pack;
    return p?.id === 'shallows' && p.variety === true;
  };
  expect(pond({})).toBe(false);
  expect(pond({ maxShare: 8 })).toBe(true);
});

test('rule cards come into the scenario as copies; none leaves the field unset; the schema takes at most MAX_CARDS', () => {
  expect(build().cards).toBeUndefined();
  expect(build({ cards: [] }).cards).toBeUndefined();
  const cards = [{ when: 'hungry', then: 'keep' }] as const satisfies SandboxSetup['cards'];
  const s = setup({ cards: [...cards] });
  const scenario = sandboxScenario(s, bases, spots);
  expect(scenario.cards).toEqual(cards);
  expect(scenario.cards).not.toBe(s.cards);
  expect(SandboxSetupSchema.parse(s)).toEqual(s);
  const many = setup({
    cards: Array.from({ length: MAX_CARDS + 1 }, () => ({ when: 'full', then: 'give' })),
  });
  expect(SandboxSetupSchema.safeParse(many).success).toBe(false);
  expect(
    SandboxSetupSchema.safeParse(setup({ cards: [{ when: 'kind', then: 'give' }] } as never)).success,
  ).toBe(false);
});

test('the setup schema refuses a knob index out of range and a structure id with a space', () => {
  const good = setup({
    knobs: { giftValue: 6, seasonLength: 0 },
    structures: [{ id: 'path-1', kind: 'path', x: 10, y: 20, x2: 300, y2: 400 }],
  });
  expect(SandboxSetupSchema.parse(good)).toEqual(good);
  const refused = (s: unknown) => {
    expect(SandboxSetupSchema.safeParse(s).success).toBe(false);
  };
  refused({ ...good, knobs: { giftValue: 7 } });
  refused({ ...good, knobs: { imitationRate: 2.5 } });
  refused({ ...good, knobs: { noSuchKnob: 1 } });
  refused({ ...good, structures: [{ id: 'my bench', kind: 'bench', x: 10, y: 10 }] });
  refused({ ...good, structures: [{ id: 'b', kind: 'bench', x: 1601, y: 10 }] });
  refused({ ...good, seed: -1 });
  refused({ ...good, seed: 2 ** 32 });
  expect(SandboxSetupSchema.safeParse({ ...good, seed: 2 ** 32 - 1 }).success).toBe(true);
  refused({ ...good, bushes: [{ id: 'path-1', x: 50, y: 50 }] }); // an id twice
  refused({ ...good, bushes: [{ id: 'bush-1', x: 50, y: -1 }] });
  refused({ ...good, note: 'hi' });
  const creature = {
    id: 'pim',
    dials: { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 },
    shell: { tightness: 0, bristle: 0, color: 0, softness: 0 },
    skyWarmth: 0,
    away: false,
    gone: false,
    diary: [],
  };
  expect(SandboxSetupSchema.safeParse({ ...good, kith: { creatures: [creature], ties: [] } }).success).toBe(
    true,
  );
  refused({ ...good, kith: { creatures: [{ ...creature, diary: ['Danced.'] }], ties: [] } });
});

test('the runner sends rain, path, and a gust clamped to the link bound, and refuses wake and walk', () => {
  const sent: Command[] = [];
  const listeners = new Set<(m: FromWorker) => void>();
  const port: SimPort = {
    send: (list) => sent.push(...list),
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    speed: () => undefined,
    requestHash: () => Promise.reject(new Error('no hash')),
  };
  const runner = createSandboxRunner(port, setup());
  expect(runner.verb({ verb: 'rain', x: 1, y: 2 })).toBe(false); // before the first snapshot
  for (const cb of listeners) cb({ t: 'snapshot', tick: 1, lite: { water: [] } as unknown as WorldLite });
  expect(runner.verb({ verb: 'rain', x: 1, y: 2 })).toBe(true);
  expect(runner.verb({ verb: 'path', x: 1, y: 2, x2: 300, y2: 4 })).toBe(true);
  expect(runner.verb({ verb: 'welcome', on: false })).toBe(true);
  runner.setPlaceKind('bush');
  expect(runner.verb({ verb: 'place', x: 5, y: 6 })).toBe(true);
  expect(runner.verb({ verb: 'wake', who: 'pim' })).toBe(false);
  expect(runner.verb({ verb: 'walk', x: 1, y: 2 })).toBe(false);
  // A drag past the link's bound is sent clamped to it, axis by axis; a short one as it is.
  expect(runner.verb({ verb: 'blow', x: 5, y: 6, dx: 9000, dy: -9000 })).toBe(true);
  expect(runner.verb({ verb: 'blow', x: 5, y: 6, dx: -300, dy: 40 })).toBe(true);
  expect(sent).toEqual([
    { t: 'rain', x: 1, y: 2 },
    { t: 'path', x: 1, y: 2, x2: 300, y2: 4 },
    { t: 'welcome', on: false },
    { t: 'place', kind: 'bush', x: 5, y: 6 },
    { t: 'blow', x: 5, y: 6, dx: GUST_REACH.dx, dy: -GUST_REACH.dy },
    { t: 'blow', x: 5, y: 6, dx: -300, dy: 40 },
  ]);
  expect(GUST_REACH).toEqual({ dx: 3200, dy: 1800 });
  runner.dispose();
  expect(listeners.size).toBe(0);
  expect(runner.verb({ verb: 'rain', x: 1, y: 2 })).toBe(false);
});

/** A runner on a port that keeps what it sends, after one snapshot with `water`. */
function runnerWith(s: SandboxSetup, water: WorldLite['water']) {
  const sent: Command[] = [];
  const listeners = new Set<(m: FromWorker) => void>();
  const port: SimPort = {
    send: (list) => sent.push(...list),
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    speed: () => undefined,
    requestHash: () => Promise.reject(new Error('no hash')),
  };
  const runner = createSandboxRunner(port, s);
  for (const cb of listeners) cb({ t: 'snapshot', tick: 1, lite: { water } as unknown as WorldLite });
  return { runner, sent };
}

test("the runner refuses a bench or bush in Halcyon's water, so the setup a rule change builds still starts", () => {
  const { runner, sent } = runnerWith(setup({ valley: 'halcyon' }), halcyonJson.water);
  const wet = { verb: 'place', x: 800, y: 850 } as const;
  const dry = { verb: 'place', x: 800, y: 500 } as const;
  expect(runner.verb(wet)).toBe(false);
  expect(runner.verb(dry)).toBe(true);
  runner.setPlaceKind('bush');
  expect(runner.verb(wet)).toBe(false);
  expect(runner.verb({ verb: 'place', x: 800, y: 800 })).toBe(false); // the water's edge is water
  expect(runner.verb(dry)).toBe(true);
  runner.setPlaceKind('lantern'); // checkLand lets a lantern stand anywhere
  expect(runner.verb(wet)).toBe(true);
  // What the sim placed, as a rule change keeps it.
  const placed = sent.flatMap((c, i) =>
    c.t === 'place' ? [{ ...c, id: `${c.kind}-${String(i + 9)}` }] : [],
  );
  const restarted = setup({
    valley: 'halcyon',
    structures: placed.flatMap(({ id, kind, x, y }) => (kind === 'bush' ? [] : [{ id, kind, x, y }])),
    bushes: placed.flatMap(({ id, kind, x, y }) => (kind === 'bush' ? [{ id, x, y }] : [])),
  });
  expect(() => sandboxScenario(restarted, bases, spots)).not.toThrow();
});

test('the runner refuses a place or a path past MAX_ENTRIES placed structures or bushes', () => {
  const many = Array.from({ length: MAX_ENTRIES }, (_, i) => ({
    id: `bench-${String(i + 1)}`,
    x: 10,
    y: 10,
  }));
  const full = runnerWith(setup({ structures: many.map((b) => ({ ...b, kind: 'bench' as const })) }), []);
  expect(full.runner.verb({ verb: 'place', x: 50, y: 50 })).toBe(false);
  expect(full.runner.verb({ verb: 'path', x: 50, y: 50, x2: 500, y2: 50 })).toBe(false);
  full.runner.setPlaceKind('bush');
  expect(full.runner.verb({ verb: 'place', x: 50, y: 50 })).toBe(true);
  const bushes = runnerWith(
    setup({ bushes: many.map((b) => ({ ...b, id: b.id.replace('bench', 'bush') })) }),
    [],
  );
  bushes.runner.setPlaceKind('bush');
  expect(bushes.runner.verb({ verb: 'place', x: 50, y: 50 })).toBe(false);
  bushes.runner.setPlaceKind('bench');
  expect(bushes.runner.verb({ verb: 'place', x: 50, y: 50 })).toBe(true);
  // One short of the limit takes one more, then no more.
  const almost = runnerWith(
    setup({ structures: many.slice(1).map((b) => ({ ...b, kind: 'bench' as const })) }),
    [],
  );
  expect(almost.runner.verb({ verb: 'path', x: 50, y: 50, x2: 500, y2: 50 })).toBe(true);
  expect(almost.runner.verb({ verb: 'place', x: 50, y: 50 })).toBe(false);
});

test('a Kith carry and a valley knob are refused outside their valley; a valley never takes the carry', () => {
  const wisp = m0Json.creatures.find((c) => c.id === 'wisp');
  if (!wisp) throw new Error('wisp');
  const kith: Carry = {
    creatures: [
      {
        id: 'wisp',
        dials: { ...wisp.dials, opener: 0.25 },
        shell: { tightness: 0, bristle: 0, color: 0, softness: 0 },
        skyWarmth: 0,
        away: true,
        gone: true,
        diary: [],
      },
    ],
    ties: [],
  };
  const ok = (s: SandboxSetup) => SandboxSetupSchema.safeParse(s).success;
  expect(ok(setup({ kith }))).toBe(true);
  expect(ok(setup({ valley: 'halcyon', kith }))).toBe(false);
  expect(ok(setup({ valley: 'fen', knobs: { flockLow: 2 } }))).toBe(true);
  expect(ok(setup({ knobs: { flockLow: 2 } }))).toBe(false);
  expect(ok(setup({ valley: 'fen', knobs: { giftWarmth: 2 } }))).toBe(false);
  const halcyon = sandboxScenario(setup({ valley: 'halcyon', kith }), bases, spots);
  expect(halcyon.creatures.find((c) => c.id === 'wisp')).toEqual(
    halcyonJson.creatures.find((c) => c.id === 'wisp'),
  );
});

test("the setup's bushes start empty, as a placed bush does", () => {
  const s = build({ bushes: [{ id: 'bush-3', x: 700, y: 300 }] });
  expect(s.bushes).toEqual([...m0Json.bushes, { id: 'bush-3', x: 700, y: 300, berries: 0 }]);
});

test('a runner that reads a Bell script with two bridges and the dance places no more bridges and does not dance again', () => {
  const bell = setup({ challenge: 'bell' });
  const water = [{ x: 780, y: 0, w: 60, h: 900 }];
  const bridge = { t: 'place', kind: 'bridge', x: 810, y: 300 } as const;
  const fresh = runnerWith(bell, water);
  fresh.runner.setPlaceKind('bridge');
  expect(fresh.runner.danced()).toBe(false);
  expect(fresh.runner.verb({ verb: 'place', x: 810, y: 600 })).toBe(true);

  const opened = runnerWith(bell, water);
  opened.runner.forwarded(
    [],
    [
      { tick: 5, list: [bridge] },
      {
        tick: 9,
        list: [
          { ...bridge, y: 600 },
          { t: 'dance', who: 'pim' },
        ],
      },
    ],
  );
  opened.runner.setPlaceKind('bridge');
  expect(opened.runner.danced()).toBe(true);
  expect(opened.runner.verb({ verb: 'place', x: 810, y: 450 })).toBe(false);
  expect(opened.runner.startDance()).toBe(false);
  expect(opened.sent).toEqual([]);
});

test('a runner that reads a script counts its structures and bushes toward MAX_ENTRIES', () => {
  const many = Array.from({ length: MAX_ENTRIES - 1 }, (_, i) => ({
    id: `bench-${String(i + 1)}`,
    x: 10,
    y: 10,
  }));
  const { runner } = runnerWith(
    setup({
      structures: many.map((b) => ({ ...b, kind: 'bench' as const })),
      bushes: many.map((b) => ({ ...b, id: b.id.replace('bench', 'bush') })),
    }),
    [],
  );
  runner.forwarded(
    [],
    [
      { tick: 3, list: [{ t: 'path', x: 50, y: 50, x2: 500, y2: 50 }] },
      { tick: 4, list: [{ t: 'place', kind: 'bush', x: 60, y: 60 }] },
    ],
  );
  expect(runner.verb({ verb: 'place', x: 50, y: 50 })).toBe(false);
  runner.setPlaceKind('bush');
  expect(runner.verb({ verb: 'place', x: 50, y: 50 })).toBe(false);
});
