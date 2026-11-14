import { expect, test } from 'vitest';
import fenJson from '../../../content/scenarios/fen.json';
import halcyonJson from '../../../content/scenarios/halcyon.json';
import hollowJson from '../../../content/scenarios/hollow.json';
import m0Json from '../../../content/scenarios/m0.json';
import sceneJson from '../../../content/scenes/kith-meadow.json';
import tuningJson from '../../../content/tuning.json';
import type { FromWorker, SimPort, WorldLite } from '../../../src/sim-host/protocol.ts';
import type { Command, Scenario, Tuning } from '../../../src/sim/types.ts';
import type { Carry } from '../../../src/story/carry.ts';
import {
  DEFAULT_SWITCHES,
  KNOBS,
  KNOB_IDS,
  SandboxSetupSchema,
  createSandboxRunner,
  knobValue,
  sandboxScenario,
  sandboxTuning,
} from '../../../src/story/sandbox.ts';
import type { KnobId, SandboxSetup } from '../../../src/story/sandbox.ts';

const base: Tuning = tuningJson;
const bases = {
  kith: m0Json as Scenario,
  fen: fenJson as Scenario,
  hollow: hollowJson as Scenario,
  halcyon: halcyonJson as Scenario,
};
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

test('giftValue index 4 sets gift.value 2 and gift.valueWinter 1; index 0 sets both to 0', () => {
  const four = sandboxTuning(setup({ knobs: { giftValue: 4 } }), base);
  expect(four.gift).toEqual({ ...base.gift, value: 2, valueWinter: 1 });
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

test('the setup schema refuses a knob index out of range and a structure id with a space', () => {
  const good = setup({
    knobs: { giftValue: 12, seasonLength: 0 },
    structures: [{ id: 'path-1', kind: 'path', x: 10, y: 20, x2: 300, y2: 400 }],
  });
  expect(SandboxSetupSchema.parse(good)).toEqual(good);
  const refused = (s: unknown) => {
    expect(SandboxSetupSchema.safeParse(s).success).toBe(false);
  };
  refused({ ...good, knobs: { giftValue: 13 } });
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

test('the runner sends rain and path, and refuses wake and walk', () => {
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
  for (const cb of listeners) cb({ t: 'snapshot', tick: 1, lite: {} as WorldLite });
  expect(runner.verb({ verb: 'rain', x: 1, y: 2 })).toBe(true);
  expect(runner.verb({ verb: 'path', x: 1, y: 2, x2: 300, y2: 4 })).toBe(true);
  expect(runner.verb({ verb: 'welcome', on: false })).toBe(true);
  runner.setPlaceKind('bush');
  expect(runner.verb({ verb: 'place', x: 5, y: 6 })).toBe(true);
  expect(runner.verb({ verb: 'wake', who: 'pim' })).toBe(false);
  expect(runner.verb({ verb: 'walk', x: 1, y: 2 })).toBe(false);
  expect(sent).toEqual([
    { t: 'rain', x: 1, y: 2 },
    { t: 'path', x: 1, y: 2, x2: 300, y2: 4 },
    { t: 'welcome', on: false },
    { t: 'place', kind: 'bush', x: 5, y: 6 },
  ]);
  runner.dispose();
  expect(listeners.size).toBe(0);
  expect(runner.verb({ verb: 'rain', x: 1, y: 2 })).toBe(false);
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
