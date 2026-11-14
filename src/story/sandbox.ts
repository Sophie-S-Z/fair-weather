// The sandbox (spec 13.1, ADR 0014 items 1 to 5): its setup, which a seed link holds, the knobs,
// the scenario a setup starts from, and the runner that sends the player's tools.
import { z } from 'zod';
import type { SimPort } from '../sim-host/protocol.ts';
import type { Command, NetworkSwitches, Scenario, Structure, Tuning } from '../sim/types.ts';
import { DIALS_SHAPE, SHELL_SHAPE, applyCarry } from './carry.ts';
import type { Carry } from './carry.ts';
import { verbCommand } from './chapter-runner.ts';
import { chapterTicksPerDay, checkLand } from './scenario.ts';
import { tuning } from './tuning.ts';
import type { VerbInput } from './verbs.ts';

export const SANDBOX_VALLEYS = ['kith', 'fen', 'hollow', 'halcyon'] as const;
export const PANELS = ['population', 'rules', 'weather', 'network'] as const;
export const CHALLENGE_IDS = ['winter', 'bell', 'krit'] as const;
export type SandboxValley = (typeof SANDBOX_VALLEYS)[number];
export type Panel = (typeof PANELS)[number];
export type ChallengeId = (typeof CHALLENGE_IDS)[number];

export const KNOB_IDS = [
  'giftValue',
  'fogLevel',
  'benchDensity',
  'gossipThreshold',
  'imitationRate',
  'windStrength',
  'seasonLength',
  'flockLow',
  'flockHigh',
  'skyAgainst',
  'skyKeep',
  'skyAway',
  'giftWarmth',
] as const;
export type KnobId = (typeof KNOB_IDS)[number];

/**
 * A knob (ADR 0014 item 2): `low` and `step` in hundredths, index 0 to `steps` (for bench density,
 * the scene's bench spot count), and `unset`, the value it shows while the setup leaves it unset.
 * `valley` null shows it in every valley.
 */
export interface Knob {
  id: KnobId;
  label: string;
  panel: Panel;
  valley: SandboxValley | null;
  low: number;
  step: number;
  steps: number | 'benchSpots';
  unset: number;
}

export const KNOBS: readonly Knob[] = [
  {
    id: 'giftValue',
    label: 'Gift value',
    panel: 'rules',
    valley: null,
    low: 0,
    step: 50,
    steps: 12,
    unset: 3,
  },
  {
    id: 'fogLevel',
    label: 'Fog level',
    panel: 'weather',
    valley: null,
    low: 0,
    step: 10,
    steps: 10,
    unset: 0,
  },
  {
    id: 'benchDensity',
    label: 'Bench density',
    panel: 'population',
    valley: null,
    low: 0,
    step: 100,
    steps: 'benchSpots',
    unset: 0,
  },
  {
    id: 'gossipThreshold',
    label: 'Gossip threshold',
    panel: 'network',
    valley: null,
    low: 0,
    step: 5,
    steps: 20,
    unset: 0.5,
  },
  {
    id: 'imitationRate',
    label: 'Imitation rate',
    panel: 'rules',
    valley: null,
    low: 0,
    step: 5,
    steps: 20,
    unset: 0.3,
  },
  {
    id: 'windStrength',
    label: 'Wind strength',
    panel: 'weather',
    valley: null,
    low: 0,
    step: 5,
    steps: 20,
    unset: 0.2,
  },
  {
    id: 'seasonLength',
    label: 'Season length',
    panel: 'rules',
    valley: null,
    low: 200,
    step: 100,
    steps: 12,
    unset: 7,
  },
  {
    id: 'flockLow',
    label: 'Lowest flock threshold',
    panel: 'rules',
    valley: 'fen',
    low: 0,
    step: 5,
    steps: 20,
    unset: 0.2,
  },
  {
    id: 'flockHigh',
    label: 'Highest flock threshold',
    panel: 'rules',
    valley: 'fen',
    low: 0,
    step: 5,
    steps: 20,
    unset: 0.8,
  },
  {
    id: 'skyAgainst',
    label: 'Sky likes an against reply',
    panel: 'rules',
    valley: 'hollow',
    low: 0,
    step: 100,
    steps: 3,
    unset: 3,
  },
  {
    id: 'skyKeep',
    label: 'Sky likes a keep',
    panel: 'rules',
    valley: 'hollow',
    low: 0,
    step: 100,
    steps: 3,
    unset: 2,
  },
  {
    id: 'skyAway',
    label: 'Sky likes an away reply',
    panel: 'rules',
    valley: 'hollow',
    low: 0,
    step: 100,
    steps: 3,
    unset: 1,
  },
  {
    id: 'giftWarmth',
    label: 'Gift warmth',
    panel: 'rules',
    valley: 'halcyon',
    low: 0,
    step: 10,
    steps: 10,
    unset: 0.2,
  },
];
const KNOB = Object.fromEntries(KNOBS.map((k) => [k.id, k])) as Record<KnobId, Knob>;

/** The knob's value at `index`, the same double as its decimal in every engine. */
export const knobValue = (knob: Knob, index: number): number => (knob.low + index * knob.step) / 100;

/** The four advanced switches (ADR 0014 item 3), as the Network panel labels them. */
export interface Switches {
  oneWay: boolean;
  weighted: boolean;
  mixed: boolean;
  drift: boolean;
}
export const DEFAULT_SWITCHES: Switches = { oneWay: true, weighted: false, mixed: true, drift: false };

/** A run's whole start (ADR 0014 item 2); knob values are step indices, and an absent knob is unset. */
export interface SandboxSetup {
  seed: number;
  valley: SandboxValley;
  kith: Carry | null;
  challenge: ChallengeId | null;
  knobs: Partial<Record<KnobId, number>>;
  switches: Switches;
  structures: Structure[];
  /** The bushes the player placed, which a rule change keeps; each starts empty. */
  bushes: { id: string; x: number; y: number }[];
}

/** The most entries in any of a setup's arrays: Kith's 30 creatures have 435 ties. */
const MAX_ENTRIES = 1000;
const id = z.string().regex(/^[a-z0-9-]{1,40}$/);
const signed = z.number().min(-1).max(1);
const x = z.number().min(0).max(tuning.scene.width);
const y = z.number().min(0).max(tuning.scene.height);
const knobIndex = (k: Knob) =>
  z
    .number()
    .int()
    .min(0)
    .max(k.steps === 'benchSpots' ? MAX_ENTRIES : k.steps);

/**
 * The setup as a seed link holds it (ADR 0014 item 7): strict objects, ids only, and every number
 * bounded. A link is canonical: only Kith keeps a carry, a valley's knobs are set only in that
 * valley, and no id is both a structure's and a bush's or used twice. Passing the schema is not
 * enough: sandboxScenario still throws on a bench density past the scene's spot count and on land
 * that checkLand refuses, and a caller must treat that throw as a refused setup too.
 */
export const SandboxSetupSchema = z
  .strictObject({
    seed: z
      .number()
      .int()
      .nonnegative()
      .max(2 ** 32 - 1),
    valley: z.enum(SANDBOX_VALLEYS),
    kith: z
      .strictObject({
        creatures: z
          .array(
            z.strictObject({
              id,
              dials: z.strictObject(DIALS_SHAPE),
              shell: z.strictObject(SHELL_SHAPE),
              skyWarmth: signed,
              away: z.boolean(),
              gone: z.boolean(),
              diary: z.array(z.string()).max(0),
            }),
          )
          .max(MAX_ENTRIES),
        ties: z.array(z.strictObject({ a: id, b: id, ab: signed, ba: signed })).max(MAX_ENTRIES),
      })
      .nullable(),
    challenge: z.enum(CHALLENGE_IDS).nullable(),
    knobs: z.strictObject(
      Object.fromEntries(KNOBS.map((k) => [k.id, knobIndex(k).exactOptional()])) as Record<
        KnobId,
        z.ZodExactOptional<z.ZodNumber>
      >,
    ),
    switches: z.strictObject({
      oneWay: z.boolean(),
      weighted: z.boolean(),
      mixed: z.boolean(),
      drift: z.boolean(),
    }),
    structures: z
      .array(
        z.discriminatedUnion('kind', [
          z.strictObject({ id, kind: z.enum(['bench', 'bridge', 'lantern']), x, y }),
          z.strictObject({ id, kind: z.literal('path'), x, y, x2: x, y2: y }),
        ]),
      )
      .max(MAX_ENTRIES),
    bushes: z.array(z.strictObject({ id, x, y })).max(MAX_ENTRIES),
  })
  .superRefine((s, ctx) => {
    if (s.kith !== null && s.valley !== 'kith')
      ctx.addIssue({ code: 'custom', message: 'Only Kith keeps a carry' });
    for (const k of KNOBS) {
      if (s.knobs[k.id] !== undefined && k.valley !== null && k.valley !== s.valley)
        ctx.addIssue({ code: 'custom', message: `${k.id} is a ${k.valley} knob` });
    }
    const ids = [...s.structures, ...s.bushes].map((x) => x.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'An id is used twice' });
  }) satisfies z.ZodType<SandboxSetup>;

/** A set knob's value, or undefined while it is unset. */
function setValue(setup: SandboxSetup, id: KnobId): number | undefined {
  const index = setup.knobs[id];
  return index === undefined ? undefined : knobValue(KNOB[id], index);
}

/** A deep copy of `base` with each set knob's tuning value (ADR 0014 item 2). */
export function sandboxTuning(setup: SandboxSetup, base: Tuning): Tuning {
  const t = structuredClone(base);
  const value = (id: KnobId) => setValue(setup, id);
  const gift = value('giftValue');
  if (gift !== undefined) {
    t.gift.value = gift;
    t.gift.valueWinter = Math.max(0, gift - 1);
  }
  t.imitation.rate = value('imitationRate') ?? t.imitation.rate;
  t.wind.dialShiftChance = value('windStrength') ?? t.wind.dialShiftChance;
  const low = value('flockLow');
  const high = value('flockHigh');
  if (low !== undefined || high !== undefined) {
    // With one set, the other is its unset value; both unset leave the tuning as it is.
    const lo = low ?? KNOB.flockLow.unset;
    t.fen.thresholdMin = lo;
    // Rounded to hundredths, so 0.8 − 0.2 gives 0.6 and not 0.6000000000000001.
    t.fen.thresholdSpan = Math.max(0, Math.round(((high ?? KNOB.flockHigh.unset) - lo) * 100) / 100);
  }
  t.hollow.drama.against = value('skyAgainst') ?? t.hollow.drama.against;
  t.hollow.drama.keep = value('skyKeep') ?? t.hollow.drama.keep;
  t.hollow.drama.away = value('skyAway') ?? t.hollow.drama.away;
  t.halcyon.giftWarmthMultiplier = value('giftWarmth') ?? t.halcyon.giftWarmthMultiplier;
  return t;
}

/**
 * The scenario `setup` starts from (ADR 0014 items 1 to 3): a deep copy of its valley's base (Kith's
 * is `m0`) with the Kith carry, spring for Kith, a sandbox day, the season length, the fog level,
 * the network switches, one Ear for all while Mixed thresholds is off, a bench at each of the first
 * bench density `benchSpots`, then the setup's structures. A valley keeps its pack, Halcyon's with
 * `kithWarmth` 0, and the sandbox has no hero. Throws when the bench density is past the scene's
 * spot count and on land that checkLand refuses.
 */
export function sandboxScenario(
  setup: SandboxSetup,
  bases: Record<SandboxValley, Scenario>,
  benchSpots: readonly { id: string; x: number; y: number }[],
): Scenario {
  const s = structuredClone(bases[setup.valley]);
  const value = (id: KnobId) => setValue(setup, id) ?? KNOB[id].unset;
  if (setup.kith && setup.valley === 'kith') applyCarry(s, setup.kith);
  if (setup.valley === 'kith') s.season = 'spring';
  s.ticksPerDay = chapterTicksPerDay(tuning.story);
  s.sandbox = true;
  s.seasonDays = value('seasonLength');
  const fog = setValue(setup, 'fogLevel');
  if (fog !== undefined) s.baseFog = fog;
  const { oneWay, weighted, mixed, drift } = setup.switches;
  const network: NetworkSwitches = {};
  if (!oneWay) network.mutual = true;
  if (weighted) network.weighted = true;
  if (drift) network.drift = true;
  if (Object.keys(network).length > 0) s.network = network;
  if (!mixed) for (const c of s.creatures) c.dials.ear = value('gossipThreshold');
  const benches = value('benchDensity');
  if (benches > benchSpots.length)
    throw new Error(
      `Bench density ${String(benches)} is past the scene's ${String(benchSpots.length)} bench spots`,
    );
  for (const p of benchSpots.slice(0, benches))
    s.structures.push({ id: `sandbox-bench-${p.id}`, kind: 'bench', x: p.x, y: p.y });
  s.structures.push(...setup.structures.map((st) => ({ ...st })));
  // Empty, as the sim's `place` command sets a new bush.
  s.bushes.push(...setup.bushes.map((b) => ({ ...b, berries: 0 })));
  delete s.hero;
  if (s.pack?.id === 'halcyon') s.pack.kithWarmth = 0;
  checkLand(s);
  return s;
}

/** The sandbox tools in panel order, so keys 1 to 8 follow it (ADR 0014 item 5). */
export const SANDBOX_TOOLS = ['place', 'path', 'shine', 'fog', 'blow', 'rain', 'thread', 'whisper'] as const;
export type SandboxTool = (typeof SANDBOX_TOOLS)[number];
export const TOOL_PANEL: Record<SandboxTool, Panel> = {
  place: 'population',
  path: 'population',
  shine: 'weather',
  fog: 'weather',
  blow: 'weather',
  rain: 'weather',
  thread: 'network',
  whisper: 'network',
};

/** The verbs the runner sends: the tools and the gate. */
const SANDBOX_VERBS: ReadonlySet<VerbInput['verb']> = new Set([...SANDBOX_TOOLS, 'welcome']);

export interface SandboxRunner {
  readonly setup: SandboxSetup;
  /** False before the first snapshot, after dispose, and for a verb outside the tools and `welcome`. */
  verb(v: VerbInput): boolean;
  /** What `place` sets, picked in the Population panel; a bench until then. */
  setPlaceKind(kind: Extract<Command, { t: 'place' }>['kind']): void;
  dispose(): void;
}

export function createSandboxRunner(port: SimPort, setup: SandboxSetup): SandboxRunner {
  let placeKind: Extract<Command, { t: 'place' }>['kind'] = 'bench';
  let ready = false;
  const off = port.onMessage((m) => {
    if (m.t === 'snapshot') ready = true;
  });
  return {
    setup,
    verb(v) {
      if (!ready || !SANDBOX_VERBS.has(v.verb)) return false;
      const cmd = verbCommand(v, undefined, placeKind);
      if (!cmd) return false;
      port.send([cmd]);
      return true;
    },
    setPlaceKind(kind) {
      placeKind = kind;
    },
    dispose() {
      ready = false;
      off();
    },
  };
}
