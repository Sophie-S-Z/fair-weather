// The action log (spec 10.4, 14.3): accepted commands, player verbs, bet results, twist outcomes,
// the year's sim events, and activity results. Plain data, so saves and the myth grammar can read it.
import type { Command, SimEvent } from '../sim/types.ts';
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
