// Chapter config schema (spec 10.1). One JSON file per chapter in content/chapters/.
import { z } from 'zod';
import type { MetricSpec } from '../sim/metrics.ts';
import type { CreatureState, Season, SimEvent } from '../sim/types.ts';
import { FLAG_KEYS } from './flags.ts';
import { VERBS, WORLD_VERBS } from './verbs.ts';

const knot = z.string().regex(/^[a-z0-9_-]+$/);
const id = z.string().regex(/^[a-z0-9_-]+$/);
const verb = z.enum(VERBS);
const flagKey = z.enum(FLAG_KEYS);
const point = z.strictObject({ x: z.number(), y: z.number() });
const structureKind = z.enum(['bench', 'bridge', 'lantern']);

// A Record over every SimEvent kind: a missing kind is a compile error.
const EVENT_KIND_SET: Record<SimEvent['t'], true> = {
  bid: true,
  gift: true,
  opinion: true,
  imitate: true,
  arrive: true,
  leave: true,
  return: true,
  art: true,
  skyBid: true,
  wake: true,
  lit: true,
  dance: true,
  mushroom: true,
};
const EVENT_KINDS = Object.keys(EVENT_KIND_SET) as [SimEvent['t'], ...SimEvent['t'][]];
// The same for seasons and creature states (story may not import sim values, so a Record here).
const SEASON_SET: Record<Season, true> = {
  spring: true,
  summer: true,
  lateSummer: true,
  autumn: true,
  winter: true,
  thaw: true,
};
const season = z.enum(Object.keys(SEASON_SET) as [Season, ...Season[]]);
const STATE_SET: Record<CreatureState, true> = {
  wander: true,
  meet: true,
  sleep: true,
  leave: true,
  away: true,
};
const creatureState = z.enum(Object.keys(STATE_SET) as [CreatureState, ...CreatureState[]]);

export const MetricSpecSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('maxBerries') }),
  z.strictObject({ kind: z.literal('averageWarmth') }),
  z.strictObject({ kind: z.literal('friendPairs') }),
]) satisfies z.ZodType<MetricSpec>;

export const BeatSchema = z.strictObject({
  id,
  trigger: z.union([
    z.strictObject({ at: z.number().nonnegative() }),
    z.strictObject({ event: z.enum(EVENT_KINDS), who: id.optional() }),
    z.strictObject({ verb }),
    // Fires once when the chapter's twist check succeeds, so a beat never tells of a twist the sim did not show.
    z.strictObject({ twist: z.literal(true) }),
  ]),
  actions: z.array(
    z.union([
      z.strictObject({ camera: z.string() }),
      // The creature the beat is about: the only one drawn in the accent (spec 11.1); null clears it.
      z.strictObject({ focus: id.nullable() }),
      z.strictObject({ ink: knot }),
      z.strictObject({ arrange: z.tuple([id, id]) }),
      z.strictObject({ pause: z.literal(true) }),
      z.strictObject({ openBet: z.literal(true) }),
      z.strictObject({ promptSkyBid: id }),
      z.strictObject({
        rumor: z.strictObject({ target: id, about: id, sign: z.union([z.literal(1), z.literal(-1)]) }),
      }),
      z.strictObject({ dance: id }),
    ]),
  ),
});
export type ChapterBeat = z.infer<typeof BeatSchema>;

export const FlagConditionSchema = z.strictObject({
  flag: flagKey,
  op: z.enum(['eq', 'gte', 'lte']),
  value: z.union([z.number(), z.boolean()]),
});
export type FlagCondition = z.infer<typeof FlagConditionSchema>;

export const OverridesSchema = z.strictObject({
  positions: z.record(id, point).optional(),
  dials: z
    .record(
      id,
      z.strictObject({
        opener: z.number().min(0).max(1).optional(),
        forgiveness: z.number().min(0).max(1).optional(),
        memory: z.number().min(0).max(1).optional(),
        ear: z.number().min(0).max(1).optional(),
        wanderlust: z.number().min(0).max(1).optional(),
      }),
    )
    .optional(),
  /** `'*'` sets every creature; a named id wins over it. */
  state: z.record(z.string().regex(/^(\*|[a-z0-9_-]+)$/), creatureState).optional(),
  /** Added to the base structures. */
  structures: z.array(z.strictObject({ id, kind: structureKind, x: z.number(), y: z.number() })).optional(),
  /** Replaces the base bushes. */
  bushes: z
    .array(z.strictObject({ id, x: z.number(), y: z.number(), berries: z.number().nonnegative() }))
    .optional(),
  water: z
    .array(
      z.strictObject({
        x: z.number(),
        y: z.number(),
        w: z.number().nonnegative(),
        h: z.number().nonnegative(),
      }),
    )
    .optional(),
  ridgeX: z.number().optional(),
  /** Over the ridge for good (ADR 0012 item 3): sets `gone` and `away`. */
  gone: z.array(id).optional(),
  /** The holder's side of its tie with `against` starts with `slights` (ADR 0012 item 7). */
  grudges: z
    .array(z.strictObject({ holder: id, against: id, slights: z.number().int().positive() }))
    .optional(),
  danceThreshold: z.record(id, z.number().int().positive()).optional(),
  mushroom: point.optional(),
  ambientSkyBids: z.literal(true).optional(),
  weather: z
    .strictObject({
      light: z.strictObject({ x: z.number(), y: z.number() }).nullable().optional(),
      season: season.optional(),
    })
    .optional(),
});

export const ExitSpecSchema = z.union([
  z.strictObject({ onTwist: z.literal(true) }),
  z.strictObject({ onBeat: id }),
  z.strictObject({ afterDays: z.number().positive() }),
]);

const ChapterObject = z.strictObject({
  id,
  /** The chapter's name (spec 6.2), shown in the heading. */
  title: z.string().min(1),
  season,
  scene: id,
  dayLengthSeconds: z.number().positive(),
  /** Starts from the last snapshot of the chapter before (ADR 0012 item 1). */
  carry: z.boolean(),
  /** At most three world verbs, the tray's limit (ADR 0012 item 8). */
  verbs: z.array(verb),
  newVerb: verb.nullable(),
  overrides: OverridesSchema,
  /** What `place` sets, and how many; absent means one bench. */
  place: z.strictObject({ kind: structureKind, limit: z.number().int().positive() }).optional(),
  beats: z.array(BeatSchema),
  bet: z
    .strictObject({
      id,
      knot,
      options: z.array(id).min(2),
      metric: MetricSpecSchema,
      afterDays: z.number().positive(),
    })
    .optional(),
  twist: z
    .strictObject({
      id: z.enum(['kritExploitsPim', 'benchWarmsVillage']),
      withinDays: z.number().positive(),
      retryArrange: z.tuple([id, id]),
      /** The window opens on the first use of this verb; without it, at chapter start. */
      opensOn: z.strictObject({ verb }).optional(),
    })
    .optional(),
  reads: z.array(flagKey),
  writes: z.array(flagKey),
  /** `when` holds when every condition holds. */
  variants: z
    .array(
      z.strictObject({
        when: z.union([FlagConditionSchema, z.array(FlagConditionSchema).min(1)]),
        overrides: OverridesSchema,
      }),
    )
    .max(2),
  exit: ExitSpecSchema,
  feeling: z.string(),
  notes: z.array(z.string()).min(2).max(4),
});

const WORLD_VERB_SET: ReadonlySet<string> = new Set(WORLD_VERBS);

export const ChapterSchema = ChapterObject.refine(
  (c) => c.verbs.filter((v) => WORLD_VERB_SET.has(v)).length <= 3,
  {
    message: 'a chapter lists at most three world verbs (ADR 0012 item 8)',
    path: ['verbs'],
  },
)
  .refine(
    (c) => {
      const exit = c.exit;
      return !('onBeat' in exit) || c.beats.some((b) => b.id === exit.onBeat);
    },
    { message: 'exit.onBeat must name a beat in this chapter', path: ['exit', 'onBeat'] },
  )
  .refine((c) => !c.twist || c.beats.some((b) => 'twist' in b.trigger), {
    // Honesty (spec 10.2): the twist is told when the sim shows it, never on a timer or a verb.
    message: 'a chapter with a twist needs a beat with the { twist: true } trigger',
    path: ['beats'],
  });
export type Chapter = z.infer<typeof ChapterObject>;
export type Overrides = z.infer<typeof OverridesSchema>;
