// The save format (spec 15.1). Version 2 adds the year so far and the year carry; version 3 adds
// Part 2's journey. Older saves migrate to version 3 (migrations.ts).
import { z } from 'zod';
import type { Command, World } from '../sim/types.ts';
import { YearLogSchema } from '../story/action-log.ts';
import type { YearLog } from '../story/action-log.ts';
import { CarrySchema } from '../story/carry.ts';
import type { Carry } from '../story/carry.ts';
import { FlagsSchema } from '../story/flags.ts';
import type { Flags } from '../story/flags.ts';
import { JourneySchema } from '../story/journey.ts';
import type { Journey } from '../story/journey.ts';

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

/**
 * A save at a chapter start. `year` is the year log of the chapters before it, which the myth
 * reads (spec 10.6); `carry` is the year carry the chapter started from (ADR 0012 item 1), or null
 * for a fresh start. With the flags they rebuild the chapter's scenario and the next chapter's carry.
 * `yearKept` marks an autosave whose year has ended and is in the Book of Skies: it is not
 * continued, so the fire is not played again for a second page (spec 10.6 item 7).
 */
export type SaveV2 = Omit<SaveV1, 'version' | 'log'> & {
  version: 2;
  year: YearLog;
  carry: Carry | null;
  yearKept?: true;
};

/**
 * A save with Part 2's journey (ADR 0013 item 9), or null before the bridge ends. A valley's save
 * needs it, and Continue rebuilds Kith from it (item 10). The hero's name and the journal captions
 * in it stay on the device.
 */
export type SaveV3 = Omit<SaveV2, 'version'> & { version: 3; journey: Journey | null };

const common = {
  seed: z.number(),
  tuningHash: z.string(),
  ink: z.string(),
  chapterId: z.string(),
  /** Only the fields the sim reads first are checked; migrate runs the sim's invariants. */
  checkpoint: z.custom<World>(
    (w) =>
      typeof w === 'object' &&
      w !== null &&
      typeof (w as World).tick === 'number' &&
      typeof (w as World).seed === 'number' &&
      Array.isArray((w as World).creatures),
  ),
};

/** A version 1 save. Its flags are the ones M1 had; migrate fills the rest. */
export const SaveV1Schema = z.object({
  ...common,
  version: z.literal(1),
  flags: FlagsSchema.partial(),
  log: z.array(z.object({ tick: z.number(), list: z.array(z.custom<Command>()) })),
});

/**
 * A version 2 save. A save from before Part 2 lacks its four flags; migrate fills them. No
 * `satisfies z.ZodType<SaveV2>` here: the partial flags admit what SaveV2's full Flags does not.
 */
export const SaveV2Schema = z.object({
  ...common,
  version: z.literal(2),
  flags: FlagsSchema.partial({ toveFlew: true, heroFamous: true, wispHome: true, kithHeld: true }),
  year: YearLogSchema,
  carry: CarrySchema.nullable(),
  yearKept: z.literal(true).exactOptional(),
});

export const SaveV3Schema = SaveV2Schema.extend({
  version: z.literal(3),
  flags: FlagsSchema,
  journey: JourneySchema.nullable(),
}) satisfies z.ZodType<SaveV3>;

/** FNV-1a 32-bit over the string's UTF-16 code units, as 8 hex characters. */
export function hashTuning(rawJson: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < rawJson.length; i++) {
    h = Math.imul(h ^ rawJson.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
