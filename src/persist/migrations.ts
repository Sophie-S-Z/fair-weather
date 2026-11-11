// Migrations bring an old save up to the current format. Only version 1 exists.
import { SaveV1Schema } from './format.ts';
import type { SaveV1 } from './format.ts';

/** Returns a current-format save. Throws on an unknown version or a damaged save. */
export function migrate(raw: unknown): SaveV1 {
  const version =
    typeof raw === 'object' && raw !== null ? (raw as { version?: unknown }).version : undefined;
  if (version !== 1) throw new Error(`Unknown save version ${String(version)}`);
  return SaveV1Schema.parse(raw);
}
