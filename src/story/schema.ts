// Chapter config schema (spec 10.1). One JSON file per chapter in content/chapters/.
import { z } from 'zod';
import type { MetricSpec } from '../sim/metrics.ts';
import type { SimEvent } from '../sim/types.ts';
import { FLAG_KEYS } from './flags.ts';
import { VERBS } from './verbs.ts';

const knot = z.string().regex(/^[a-z0-9_-]+$/);
const id = z.string().regex(/^[a-z0-9_-]+$/);
const verb = z.enum(VERBS);
const flagKey = z.enum(FLAG_KEYS as [string, ...string[]]);

const EVENT_KINDS = [
  'bid',
  'gift',
  'opinion',
  'imitate',
  'arrive',
  'leave',
  'return',
  'art',
  'skyBid',
] as const satisfies readonly SimEvent['t'][];

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
  ]),
  actions: z.array(
    z.union([
      z.strictObject({ camera: z.string() }),
      z.strictObject({ ink: knot }),
      z.strictObject({ arrange: z.tuple([id, id]) }),
      z.strictObject({ pause: z.literal(true) }),
      z.strictObject({ openBet: z.literal(true) }),
    ]),
  ),
});
export type ChapterBeat = z.infer<typeof BeatSchema>;

export const FlagConditionSchema = z.strictObject({
  flag: flagKey,
  op: z.enum(['eq', 'gte', 'lte']),
  value: z.union([z.number(), z.boolean()]),
});

export const OverridesSchema = z.strictObject({
  positions: z.record(id, z.strictObject({ x: z.number(), y: z.number() })).optional(),
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
  state: z.record(id, z.enum(['wander', 'meet', 'sleep', 'leave', 'away'])).optional(),
  weather: z
    .strictObject({
      light: z.strictObject({ x: z.number(), y: z.number() }).nullable().optional(),
      season: z.enum(['spring', 'summer', 'lateSummer', 'autumn', 'winter', 'thaw']).optional(),
    })
    .optional(),
});

export const ExitSpecSchema = z.union([
  z.strictObject({ onTwist: z.literal(true) }),
  z.strictObject({ onBeat: id }),
  z.strictObject({ afterDays: z.number().positive() }),
]);

export const ChapterSchema = z.strictObject({
  id,
  season: z.enum(['spring', 'summer', 'lateSummer', 'autumn', 'winter', 'thaw']),
  scene: id,
  dayLengthSeconds: z.number().positive(),
  verbs: z.array(verb),
  newVerb: verb.nullable(),
  overrides: OverridesSchema,
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
    })
    .optional(),
  reads: z.array(flagKey),
  writes: z.array(flagKey),
  variants: z.array(z.strictObject({ when: FlagConditionSchema, overrides: OverridesSchema })).max(2),
  exit: ExitSpecSchema,
  feeling: z.string(),
  notes: z.array(z.string()).min(2).max(4),
});
export type Chapter = z.infer<typeof ChapterSchema>;
