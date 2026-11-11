// Carry-forward flags (spec 6.2, P3). Defaults in content/flags.json are the gentle values for skips.
import { z } from 'zod';

export const FlagsSchema = z.strictObject({
  pimSkyBond: z.number(),
  pimSkyOpinion: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  pimScar: z.boolean(),
  benchPlaced: z.boolean(),
  friendThreads: z.number(),
});
export type Flags = z.infer<typeof FlagsSchema>;
export type FlagKey = keyof Flags;
export const FLAG_KEYS = Object.keys(FlagsSchema.shape) as FlagKey[];

/** Validates raw flags JSON (content/flags.json). */
export function parseFlags(raw: unknown): Flags {
  return FlagsSchema.parse(raw);
}
