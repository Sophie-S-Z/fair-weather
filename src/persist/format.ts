// The save format (spec 15.1). Version 2 adds the year so far and the year carry; version 1 saves
// migrate to it (migrations.ts).
import { z } from 'zod';
import type { Command, World } from '../sim/types.ts';
import type { LogEntry, YearLog } from '../story/action-log.ts';
import type { Carry } from '../story/carry.ts';
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

/**
 * A save at a chapter start. `year` is the year log of the chapters before it, which the myth
 * reads (spec 10.6); `carry` is the year carry the chapter started from (ADR 0012 item 1), or null
 * for a fresh start. With the flags they rebuild the chapter's scenario and the next chapter's carry.
 */
export type SaveV2 = Omit<SaveV1, 'version' | 'log'> & { version: 2; year: YearLog; carry: Carry | null };

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

const unit = z.number().min(0).max(1);
const CarrySchema = z.object({
  creatures: z.array(
    z.object({
      id: z.string(),
      dials: z.object({ opener: unit, forgiveness: unit, memory: unit, ear: unit, wanderlust: unit }),
      shell: z.object({ tightness: unit, bristle: unit, color: unit, softness: unit }),
      skyWarmth: z.number(),
      away: z.boolean(),
      gone: z.boolean(),
      diary: z.array(z.string()),
    }),
  ),
  ties: z.array(z.object({ a: z.string(), b: z.string(), ab: z.number(), ba: z.number() })),
}) satisfies z.ZodType<Carry>;

export const SaveV2Schema = z.object({
  ...common,
  version: z.literal(2),
  flags: FlagsSchema,
  year: z.array(
    z.object({
      chapterId: z.string(),
      log: z.array(
        z.custom<LogEntry>(
          (e) =>
            typeof e === 'object' &&
            e !== null &&
            typeof (e as LogEntry).kind === 'string' &&
            typeof (e as LogEntry).tick === 'number',
        ),
      ),
    }),
  ),
  carry: CarrySchema.nullable(),
}) satisfies z.ZodType<SaveV2>;

/** FNV-1a 32-bit over the string's UTF-16 code units, as 8 hex characters. */
export function hashTuning(rawJson: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < rawJson.length; i++) {
    h = Math.imul(h ^ rawJson.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
