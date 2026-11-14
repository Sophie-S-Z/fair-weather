// Seed links (ADR 0014 item 7): a sandbox valley as `v1.<data>`, the URL-safe base64 of the
// browser's own deflate-raw over the link's JSON (ADR 0014 item 19). A link holds ids, numbers, and
// fixed words only, so no field can hold free text.
import { z } from 'zod';
import type { Command } from '../sim/types.ts';
import { CommandSchema } from '../story/action-log.ts';
import { CHALLENGES } from '../story/challenges.ts';
import { SandboxSetupSchema } from '../story/sandbox.ts';
import type { SandboxSetup } from '../story/sandbox.ts';

/** 100 days at the sandbox's 400 ticks a day. */
export const MAX_LINK_TICKS = 40_000;
export const MAX_LINK_LISTS = 10_000;
/** The most bytes of JSON a link holds; decoding stops reading there. */
export const MAX_LINK_BYTES = 1_048_576;
/** The longest whole URL the Share panel offers as a link; past it, a file. */
export const LINK_CHARS = 2000;
export const VALLEY_FILE = 'fair-weather-valley.fairweather';

export interface SeedLink {
  v: 1;
  /** `hashTuning` of the raw tuning JSON the valley grew under. */
  tuning: string;
  setup: SandboxSetup;
  /** Every accepted command list, with the tick it was accepted at. */
  script: { tick: number; list: Command[] }[];
  /** The tick the link was made at. */
  tick: number;
}

const ID = /^[a-z0-9-]{1,40}$/;
/** CommandSchema's enum fields; every other string in a command must be an id. */
const COMMAND_ENUMS: ReadonlySet<string> = new Set(['t', 'kind', 'reply', 'gift', 'season', 'dial', 'verb']);

/** The strings in a command outside its enum fields (CommandSchema leaves them free text). */
function texts(o: object): string[] {
  return Object.entries(o).flatMap(([k, v]: [string, unknown]) => {
    if (typeof v === 'string') return COMMAND_ENUMS.has(k) ? [] : [v];
    return typeof v === 'object' && v !== null ? texts(v) : [];
  });
}

const tick = z.number().int().nonnegative();

/**
 * A link, strict at every level (ADR 0014 item 7). Script ticks never go back (two lists may share
 * one) and are below the link's tick; a challenge's bridge limit counts the setup's bridges and the
 * script's placed ones together.
 */
export const SeedLinkSchema = z
  .strictObject({
    v: z.literal(1),
    tuning: z.string().regex(/^[0-9a-f]{8}$/),
    setup: SandboxSetupSchema,
    script: z.array(z.strictObject({ tick, list: z.array(CommandSchema) })).max(MAX_LINK_LISTS),
    tick: tick.max(MAX_LINK_TICKS),
  })
  .superRefine((link, ctx) => {
    let last = 0;
    for (const s of link.script) {
      if (s.tick < last || s.tick >= link.tick)
        ctx.addIssue({
          code: 'custom',
          message: `Script tick ${String(s.tick)} is out of order or not below the link tick`,
        });
      last = s.tick;
      for (const c of s.list)
        if (!texts(c).every((t) => ID.test(t)))
          ctx.addIssue({ code: 'custom', message: `A ${c.t} command holds a string that is not an id` });
    }
    const { challenge, structures } = link.setup;
    const limit = challenge === null ? undefined : CHALLENGES[challenge].start.bridgeLimit;
    const placed = link.script.flatMap((s) => s.list).filter((c) => c.t === 'place' && c.kind === 'bridge');
    const bridges = structures.filter((st) => st.kind === 'bridge').length + placed.length;
    if (limit !== undefined && bridges > limit)
      ctx.addIssue({
        code: 'custom',
        message: `The ${String(challenge)} challenge allows ${String(limit)} bridges`,
      });
  }) satisfies z.ZodType<SeedLink>;

/** `v1.<data>`; throws when the link fails SeedLinkSchema or its JSON is past MAX_LINK_BYTES. */
export async function encodeLink(link: SeedLink): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(SeedLinkSchema.parse(link)));
  if (json.byteLength > MAX_LINK_BYTES)
    throw new Error(`A link holds at most ${String(MAX_LINK_BYTES)} bytes`);
  const deflated = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(deflated).arrayBuffer());
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `v1.${btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;
}

/**
 * The link in `text` (a fragment without its `#`, or a valley file's line), or null when it has no
 * `v1.` prefix, is not URL-safe base64, does not inflate, inflates past MAX_LINK_BYTES (reading stops
 * there), is not JSON, fails SeedLinkSchema, or was made under another tuning hash. Never throws.
 * It does not build the scenario: the caller must treat a throw from `sandboxScenario` (a bench
 * density past the scene's spots, land that checkLand refuses) as a broken link too.
 */
export async function decodeLink(text: string, tuningHash: string): Promise<SeedLink | null> {
  try {
    if (!text.startsWith('v1.')) return null;
    const data = text.slice(3);
    if (!/^[A-Za-z0-9_-]+$/.test(data) || data.length % 4 === 1) return null;
    const binary = atob(data.replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_LINK_BYTES) {
        reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
    const parsed = SeedLinkSchema.safeParse(JSON.parse(await new Blob(chunks).text()));
    return parsed.success && parsed.data.tuning === tuningHash ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Whether the whole URL is short enough to share as a link (ADR 0014 item 7). */
export const fitsInLink = (url: string): boolean => url.length <= LINK_CHARS;
