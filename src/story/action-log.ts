// The action log (spec 10.4, 14.3): accepted commands, player verbs, bet results, twist outcomes,
// the year's sim events, and activity results. Plain data, so saves and the myth grammar can read it.
import { z } from 'zod';
import type { Command, DialKey, Season, SimEvent } from '../sim/types.ts';
import { ACTIVITIES } from './schema.ts';
import type { Activity } from './schema.ts';
import type { VerbInput } from './verbs.ts';

/** The sim events the year log keeps: what the myth tells of (ADR 0012 item 11). */
export const YEAR_EVENTS = ['lit', 'arrive', 'leave', 'return', 'dance', 'mushroom'] as const;
export type YearEvent = Extract<SimEvent, { t: (typeof YEAR_EVENTS)[number] }>;

/** `tick` is the sim tick: `accepted.tick` and `events.tick` for those, the latest snapshot tick otherwise. */
export type LogEntry =
  | { kind: 'accepted'; tick: number; list: Command[] }
  | { kind: 'verb'; tick: number; input: VerbInput }
  | { kind: 'bet'; tick: number; id: string; answer: string; result: string }
  | { kind: 'twist'; tick: number; id: string; fired: boolean; retries: number }
  | { kind: 'event'; tick: number; e: YearEvent }
  | { kind: 'activity'; tick: number; activity: Activity; result: string };

export type ActionLog = LogEntry[];

/** Every chapter's log, in play order (spec 10.4): what the myth reads. */
export type YearLog = { chapterId: string; log: ActionLog }[];

const num = z.number();
const str = z.string();
const reply = z.enum(['toward', 'away', 'against']);
const at = { x: num, y: num };
// A Record over every dial: a missing dial is a compile error (story may not import sim values).
const DIAL_SET: Record<DialKey, true> = {
  opener: true,
  forgiveness: true,
  memory: true,
  ear: true,
  wanderlust: true,
};
const DIALS = Object.keys(DIAL_SET) as [DialKey, ...DialKey[]];

/**
 * Every command shape (sim/types.ts Command). `walk` has two shapes, which a discriminated union
 * cannot hold, so they sit beside it.
 */
const CommandSchema = z.union([
  z.strictObject({ t: z.literal('walk'), ...at }),
  z.strictObject({ t: z.literal('walk'), to: str }),
  z.discriminatedUnion('t', [
    z.strictObject({ t: z.literal('shine'), ...at }),
    z.strictObject({ t: z.literal('paintFog'), ...at, r: num, amount: num }),
    z.strictObject({ t: z.literal('blow'), ...at, dx: num, dy: num }),
    z.strictObject({ t: z.literal('place'), kind: z.enum(['bench', 'bush', 'bridge', 'lantern']), ...at }),
    z.strictObject({ t: z.literal('thread'), a: str, b: str, on: z.boolean() }),
    z.strictObject({
      t: z.literal('whisper'),
      target: str,
      about: str,
      sign: z.union([z.literal(1), z.literal(-1)]),
    }),
    z.strictObject({ t: z.literal('respond'), to: str, reply }),
    z.strictObject({ t: z.literal('arrangeMeeting'), a: str, b: str }),
    z.strictObject({
      t: z.literal('setSeason'),
      season: z.enum(['spring', 'summer', 'lateSummer', 'autumn', 'winter', 'thaw'] satisfies Season[]),
    }),
    z.strictObject({ t: z.literal('wake'), who: str }),
    z.strictObject({ t: z.literal('promptSkyBid'), who: str }),
    z.strictObject({ t: z.literal('overPoke') }),
    z.strictObject({ t: z.literal('dance'), who: str }),
    z.strictObject({ t: z.literal('manner'), reply, gift: z.enum(['give', 'keep']) }),
    z.strictObject({ t: z.literal('plant') }),
    z.strictObject({
      t: z.literal('local'),
      verb: z.discriminatedUnion('verb', [
        z.strictObject({ verb: z.literal('join'), on: z.boolean() }),
        z.strictObject({ verb: z.literal('pose') }),
        z.strictObject({ verb: z.literal('keepsake'), to: str, item: str }),
      ]),
    }),
    z.strictObject({
      t: z.literal('nudge'),
      dial: z.enum(DIALS),
      amount: num,
    }),
  ]),
]) satisfies z.ZodType<Command>;

/** Every verb input shape (verbs.ts VerbInput). */
const VerbInputSchema = z.discriminatedUnion('verb', [
  z.strictObject({ verb: z.literal('wake'), who: str }),
  z.strictObject({ verb: z.literal('respond'), reply }),
  z.strictObject({ verb: z.literal('place'), ...at }),
  z.strictObject({ verb: z.literal('shine'), ...at }),
  z.strictObject({
    verb: z.literal('whisper'),
    target: str,
    about: str,
    sign: z.union([z.literal(1), z.literal(-1)]),
  }),
  z.strictObject({ verb: z.literal('thread'), a: str, b: str, on: z.boolean() }),
  z.strictObject({ verb: z.literal('fog'), ...at, clear: z.boolean() }),
  z.strictObject({ verb: z.literal('blow'), ...at, dx: num, dy: num }),
]) satisfies z.ZodType<VerbInput>;

/** Every year event shape (YEAR_EVENTS). */
const YearEventSchema = z.discriminatedUnion('t', [
  z.strictObject({
    t: z.literal('lit'),
    a: str,
    b: str,
    behaviors: z.array(z.enum(['toward', 'against', 'give', 'keep'])),
  }),
  z.strictObject({ t: z.enum(['arrive', 'leave', 'return']), who: str }),
  z.strictObject({ t: z.literal('dance'), who: str }),
  z.strictObject({ t: z.literal('mushroom'), taken: num, drops: num }),
]) satisfies z.ZodType<YearEvent>;

/** One year log entry, checked in full: a save that holds a damaged one fails to load (spec 15.1). */
export const LogEntrySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('accepted'), tick: num, list: z.array(CommandSchema) }),
  z.strictObject({ kind: z.literal('verb'), tick: num, input: VerbInputSchema }),
  z.strictObject({ kind: z.literal('bet'), tick: num, id: str, answer: str, result: str }),
  z.strictObject({ kind: z.literal('twist'), tick: num, id: str, fired: z.boolean(), retries: num }),
  z.strictObject({ kind: z.literal('event'), tick: num, e: YearEventSchema }),
  z.strictObject({ kind: z.literal('activity'), tick: num, activity: z.enum(ACTIVITIES), result: str }),
]) satisfies z.ZodType<LogEntry>;

export const YearLogSchema = z.array(
  z.strictObject({ chapterId: str, log: z.array(LogEntrySchema) }),
) satisfies z.ZodType<YearLog>;
