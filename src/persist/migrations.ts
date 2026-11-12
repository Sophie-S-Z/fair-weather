// Migrations bring an old save up to the current format. Only version 1 exists.
import { checkInvariants } from '../sim/invariants.ts';
import { tuning } from '../story/tuning.ts';
import { SaveV1Schema } from './format.ts';
import type { SaveV1 } from './format.ts';

/** Returns a current-format save. Throws on an unknown version or a damaged save. */
export function migrate(raw: unknown): SaveV1 {
  const version =
    typeof raw === 'object' && raw !== null ? (raw as { version?: unknown }).version : undefined;
  if (version !== 1) throw new Error(`Unknown save version ${String(version)}`);
  const save = SaveV1Schema.parse(raw);
  // The world must pass the sim's own invariants; a throw means a field is missing.
  const bad = checkInvariants(save.checkpoint, tuning);
  if (bad.length > 0) throw new Error(`Damaged checkpoint: ${bad[0] ?? ''}`);
  return save;
}
