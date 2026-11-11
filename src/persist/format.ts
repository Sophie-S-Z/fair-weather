// The save format (spec 15.1). Version 1 is the only one so far.
import { z } from 'zod';
import type { Command, World } from '../sim/types.ts';
import { FlagsSchema } from '../story/flags.ts';
import type { Flags } from '../story/flags.ts';

export interface SaveV1 {
  version: 1;
  seed: number;
  /** A hash of the raw tuning JSON the run used; a different one still loads. */
  tuningHash: string;
  ink: string;
  /** Flags at the chapter start. */
  flags: Flags;
  chapterId: string;
  /** Command lists accepted since the chapter start. */
  log: { tick: number; list: Command[] }[];
  checkpoint: World;
}

/** Checks the shape of a save; the world is only checked for the fields the sim reads first. */
export const SaveV1Schema = z.object({
  version: z.literal(1),
  seed: z.number(),
  tuningHash: z.string(),
  ink: z.string(),
  flags: FlagsSchema,
  chapterId: z.string(),
  log: z.array(z.object({ tick: z.number(), list: z.array(z.custom<Command>()) })),
  checkpoint: z.custom<World>(
    (w) =>
      typeof w === 'object' &&
      w !== null &&
      typeof (w as World).tick === 'number' &&
      typeof (w as World).seed === 'number' &&
      Array.isArray((w as World).creatures),
  ),
});

/** FNV-1a 32-bit over the string's UTF-16 code units, as 8 hex characters. */
export function hashTuning(rawJson: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < rawJson.length; i++) {
    h = Math.imul(h ^ rawJson.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** True when the save was made under different tuning. The save loads anyway. */
export function tuningChanged(save: SaveV1, currentHash: string): boolean {
  return save.tuningHash !== currentHash;
}
