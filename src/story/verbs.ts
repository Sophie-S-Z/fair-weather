// Verb types for story and input (ADR 0011 item 4). One source: the VERBS tuple.
import type { BidReply } from '../sim/types.ts';

export const VERBS = ['wake', 'respond', 'bet', 'place'] as const;
export type Verb = (typeof VERBS)[number];

export type VerbInput =
  | { verb: 'wake'; who: string }
  | { verb: 'respond'; reply: BidReply }
  | { verb: 'place'; x: number; y: number };
