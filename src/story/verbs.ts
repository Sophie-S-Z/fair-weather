// Verb types for story and input (ADR 0011 item 4). One source: the verb tuples.
import type { BidReply, GiftMove } from '../sim/types.ts';

/**
 * Verbs that act on the world: the only tray tools (ADR 0012 item 8). Part 2 adds the hero's
 * (ADR 0013 items 2 to 7), and the sandbox rain, paths, and the gate (ADR 0014 item 5).
 */
export const WORLD_VERBS = [
  'wake',
  'respond',
  'place',
  'shine',
  'whisper',
  'thread',
  'fog',
  'blow',
  'walk',
  'manner',
  'join',
  'pose',
  'keepsake',
  'rain',
  'path',
  'welcome',
] as const;
/** Verbs that only read the world; never tray tools. */
export const MIND_VERBS = ['peek', 'zoom', 'rewind'] as const;
export const VERBS = [...WORLD_VERBS, 'bet', 'listen', ...MIND_VERBS] as const;
export type WorldVerb = (typeof WORLD_VERBS)[number];
export type MindVerb = (typeof MIND_VERBS)[number];
export type Verb = (typeof VERBS)[number];

/**
 * `walk` with `to` is a wave. `plant` (the Seedcarrier's knack, ADR 0013 item 3) is no verb of its
 * own: it is unlocked with `manner`.
 */
export type VerbInput =
  | { verb: 'wake'; who: string }
  | { verb: 'respond'; reply: BidReply }
  | { verb: 'place'; x: number; y: number }
  | { verb: 'shine'; x: number; y: number }
  | { verb: 'whisper'; target: string; about: string; sign: 1 | -1 }
  | { verb: 'thread'; a: string; b: string; on: boolean }
  | { verb: 'fog'; x: number; y: number; clear: boolean }
  | { verb: 'blow'; x: number; y: number; dx: number; dy: number }
  | { verb: 'walk'; x: number; y: number }
  | { verb: 'walk'; to: string }
  | { verb: 'manner'; reply: BidReply; gift: GiftMove }
  | { verb: 'plant' }
  | { verb: 'join'; on: boolean }
  | { verb: 'pose' }
  | { verb: 'keepsake'; to: string; item: string }
  | { verb: 'rain'; x: number; y: number }
  | { verb: 'path'; x: number; y: number; x2: number; y2: number }
  | { verb: 'welcome'; on: boolean };

/** The verb that unlocks an input: `manner` for `plant`, else its own. */
export const unlockingVerb = (v: VerbInput): Verb => (v.verb === 'plant' ? 'manner' : v.verb);
