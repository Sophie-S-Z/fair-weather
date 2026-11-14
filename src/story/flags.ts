// Carry-forward flags (spec 6.2, P3). Defaults in content/flags.json are the gentle values for skips.
import { z } from 'zod';
// With the import attribute, so tools/content-validate can load this file in Node.
import flagsJson from '../../content/flags.json' with { type: 'json' };

export const FlagsSchema = z.strictObject({
  pimSkyBond: z.number(),
  pimSkyOpinion: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  pimScar: z.boolean(),
  benchPlaced: z.boolean(),
  friendThreads: z.number(),
  litConflict: z.number(),
  rumorStuck: z.boolean(),
  echoForgiveness: z.number(),
  wispPushed: z.boolean(),
  mossShared: z.boolean(),
  winterLeft: z.number(),
  bellDanced: z.boolean(),
  festivalShare: z.number(),
  greetingSong: z.number(),
  toveFlew: z.boolean(),
  heroFamous: z.boolean(),
  wispHome: z.boolean(),
  /** Kith's average warmth after the postcards is at least wisp.minKithWarmth (ADR 0013 item 12). */
  kithHeld: z.boolean(),
});
export type Flags = z.infer<typeof FlagsSchema>;
export type FlagKey = keyof Flags;
export const FLAG_KEYS = [
  'pimSkyBond',
  'pimSkyOpinion',
  'pimScar',
  'benchPlaced',
  'friendThreads',
  'litConflict',
  'rumorStuck',
  'echoForgiveness',
  'wispPushed',
  'mossShared',
  'winterLeft',
  'bellDanced',
  'festivalShare',
  'greetingSong',
  'toveFlew',
  'heroFamous',
  'wispHome',
  'kithHeld',
] as const satisfies readonly FlagKey[];

/** Validates raw flags JSON (content/flags.json). */
export function parseFlags(raw: unknown): Flags {
  return FlagsSchema.parse(raw);
}

/** content/flags.json: the gentle values for a new game, for skips, and for the flags an old save lacks. */
export const DEFAULT_FLAGS: Flags = parseFlags(flagsJson);
