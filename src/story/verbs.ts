// Verb types for story and input (ADR 0011 item 4). One source: the verb tuples.
import type { BidReply } from '../sim/types.ts';

/** Verbs that act on the world: the only tray tools (ADR 0012 item 8). */
export const WORLD_VERBS = ['wake', 'respond', 'place', 'shine', 'whisper', 'thread', 'fog', 'blow'] as const;
/** Verbs that only read the world; never tray tools. */
export const MIND_VERBS = ['peek', 'zoom', 'rewind'] as const;
export const VERBS = [...WORLD_VERBS, 'bet', 'listen', ...MIND_VERBS] as const;
export type WorldVerb = (typeof WORLD_VERBS)[number];
export type MindVerb = (typeof MIND_VERBS)[number];
export type Verb = (typeof VERBS)[number];

export type VerbInput =
  | { verb: 'wake'; who: string }
  | { verb: 'respond'; reply: BidReply }
  | { verb: 'place'; x: number; y: number }
  | { verb: 'shine'; x: number; y: number }
  | { verb: 'whisper'; target: string; about: string; sign: 1 | -1 }
  | { verb: 'thread'; a: string; b: string; on: boolean }
  | { verb: 'fog'; x: number; y: number; clear: boolean }
  | { verb: 'blow'; x: number; y: number; dx: number; dy: number };
