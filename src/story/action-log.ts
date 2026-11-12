// The action log (spec 10.4, 14.3): accepted commands, player verbs, bet results, and twist outcomes.
// Plain data, so saves and the myth grammar can read it.
import type { Command } from '../sim/types.ts';
import type { VerbInput } from './verbs.ts';

/** `tick` is the sim tick: `accepted.tick` for commands, the latest snapshot tick otherwise. */
export type LogEntry =
  | { kind: 'accepted'; tick: number; list: Command[] }
  | { kind: 'verb'; tick: number; input: VerbInput }
  | { kind: 'bet'; tick: number; id: string; answer: string; result: string }
  | { kind: 'twist'; tick: number; id: string; fired: boolean; retries: number };

export type ActionLog = LogEntry[];

/** Every chapter's log, in play order (spec 10.4): what the myth reads. */
export type YearLog = { chapterId: string; log: ActionLog }[];
