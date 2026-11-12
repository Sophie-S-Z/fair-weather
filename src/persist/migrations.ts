// Migrations bring an old save up to the current format, version 2.
import { checkInvariants } from '../sim/invariants.ts';
import { DEFAULT_FLAGS } from '../story/chapter-runner.ts';
import { FlagsSchema } from '../story/flags.ts';
import { tuning } from '../story/tuning.ts';
import { SaveV1Schema, SaveV2Schema } from './format.ts';
import type { SaveV2 } from './format.ts';

/**
 * Returns a current-format save. A version 1 save gets an empty year and no carry, drops its
 * command log, and takes each flag it lacks from content/flags.json. Throws on an unknown version
 * or a damaged save.
 */
export function migrate(raw: unknown): SaveV2 {
  const version =
    typeof raw === 'object' && raw !== null ? (raw as { version?: unknown }).version : undefined;
  let save: SaveV2;
  if (version === 2) save = SaveV2Schema.parse(raw);
  else if (version === 1) {
    const v1 = SaveV1Schema.parse(raw);
    save = {
      version: 2,
      seed: v1.seed,
      tuningHash: v1.tuningHash,
      ink: v1.ink,
      flags: FlagsSchema.parse({ ...DEFAULT_FLAGS, ...v1.flags }),
      chapterId: v1.chapterId,
      year: [],
      carry: null,
      checkpoint: v1.checkpoint,
    };
  } else throw new Error(`Unknown save version ${String(version)}`);
  // The world must pass the sim's own invariants; a throw means a field is missing.
  const bad = checkInvariants(save.checkpoint, tuning);
  if (bad.length > 0) throw new Error(`Damaged checkpoint: ${bad[0] ?? ''}`);
  return save;
}
