// Migrations bring an old save up to the current format, version 3.
import { checkInvariants } from '../sim/invariants.ts';
import { DEFAULT_FLAGS, FlagsSchema } from '../story/flags.ts';
import type { Flags } from '../story/flags.ts';
import { tuning } from '../story/tuning.ts';
import { SaveV1Schema, SaveV2Schema, SaveV3Schema } from './format.ts';
import type { SaveV3 } from './format.ts';

/** The flags an old save kept, with each one it lacks from content/flags.json; one stored as undefined takes its default too. */
const withDefaults = (flags: { [K in keyof Flags]?: Flags[K] | undefined }): Flags =>
  FlagsSchema.parse({
    ...DEFAULT_FLAGS,
    ...Object.fromEntries(Object.entries(flags).filter(([, v]) => v !== undefined)),
  });

/**
 * Returns a current-format save. A version 2 save gets no journey and takes the Part 2 flags it
 * lacks from content/flags.json. A version 1 save also gets an empty year and no carry, drops its
 * command log, and takes each flag it lacks from there. Throws on an unknown version or a damaged
 * save, a damaged journey included.
 */
export function migrate(raw: unknown): SaveV3 {
  const version =
    typeof raw === 'object' && raw !== null ? (raw as { version?: unknown }).version : undefined;
  let save: SaveV3;
  if (version === 3) save = SaveV3Schema.parse(raw);
  else if (version === 2) {
    const v2 = SaveV2Schema.parse(raw);
    save = { ...v2, version: 3, flags: withDefaults(v2.flags), journey: null };
  } else if (version === 1) {
    const v1 = SaveV1Schema.parse(raw);
    save = {
      version: 3,
      seed: v1.seed,
      tuningHash: v1.tuningHash,
      ink: v1.ink,
      flags: withDefaults(v1.flags),
      chapterId: v1.chapterId,
      year: [],
      carry: null,
      checkpoint: v1.checkpoint,
      journey: null,
    };
  } else throw new Error(`Unknown save version ${String(version)}`);
  // The world must pass the sim's own invariants; a throw means a field is missing.
  const bad = checkInvariants(save.checkpoint, tuning);
  if (bad.length > 0) throw new Error(`Damaged checkpoint: ${bad[0] ?? ''}`);
  return save;
}
