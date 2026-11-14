// Seed links (ADR 0014 item 7): a sandbox valley as `v1.<data>`, the URL-safe base64 of the
// browser's own deflate-raw over the link's JSON (ADR 0014 item 19). A link holds ids from closed
// sets, bounded numbers, and fixed words only, so no field can hold free text.
import { z } from 'zod';
import type { Command } from '../sim/types.ts';
import { CommandSchema } from '../story/action-log.ts';
import { CHALLENGES } from '../story/challenges.ts';
import { GUST_REACH, SandboxSetupSchema, bridgesIn, inScene, isCreatureId } from '../story/sandbox.ts';
import type { SandboxSetup } from '../story/sandbox.ts';
import { tuning } from '../story/tuning.ts';

/** 100 days at the sandbox's 400 ticks a day. */
export const MAX_LINK_TICKS = 40_000;
export const MAX_LINK_LISTS = 10_000;
/** The most bytes of JSON a link holds; decoding stops reading there. */
export const MAX_LINK_BYTES = 1_048_576;
/**
 * The longest link text decode reads: `v1.` and the base64 of MAX_LINK_BYTES plus 1 KiB, more than
 * deflate's worst case (stored blocks) adds to the largest JSON.
 */
export const MAX_LINK_TEXT = Math.ceil(((MAX_LINK_BYTES + 1024) * 4) / 3) + 3;
/** The compressed bytes decode feeds the inflater at a time: one slice inflates to about 1 MiB at most. */
const FEED_BYTES = 1024;
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

const { brushRadius, brushAmount } = tuning.fog;

/**
 * Why a command cannot be in a link, or null when it can: only what the sandbox runner sends, as it
 * sends it. Points lie in the scene; `paintFog` is the fog tool's brush; a gust's dx and dy are at
 * most GUST_REACH, which the runner clamps to; creatures are ids from the closed set.
 */
function commandIssue(c: Command): string | null {
  switch (c.t) {
    case 'place':
    case 'shine':
    case 'rain':
      return inScene(c.x, c.y) ? null : 'is off the scene';
    case 'path':
      return inScene(c.x, c.y) && inScene(c.x2, c.y2) ? null : 'is off the scene';
    case 'paintFog':
      if (!inScene(c.x, c.y)) return 'is off the scene';
      return c.r === brushRadius && Math.abs(c.amount) === brushAmount ? null : 'is not the fog brush';
    case 'blow':
      if (!inScene(c.x, c.y)) return 'is off the scene';
      return Math.abs(c.dx) <= GUST_REACH.dx && Math.abs(c.dy) <= GUST_REACH.dy ? null : 'is too long';
    case 'thread':
      return isCreatureId(c.a) && isCreatureId(c.b) ? null : 'names an unknown creature';
    case 'whisper':
      return isCreatureId(c.target) && isCreatureId(c.about) ? null : 'names an unknown creature';
    case 'welcome':
      return null;
    case 'dance':
      return c.who === 'pim' ? null : "is not Pim's dance";
    default:
      return 'is not a sandbox command';
  }
}

const LinkCommandSchema = CommandSchema.superRefine((c, ctx) => {
  const issue = commandIssue(c);
  if (issue !== null) ctx.addIssue({ code: 'custom', message: `A ${c.t} command ${issue}` });
});

const tick = z.number().int().nonnegative();

/**
 * A link, strict at every level (ADR 0014 item 7), with SandboxSetupSchema's closed id sets and only
 * the sandbox's commands. Script ticks never go back (two lists may share one) and are below the
 * link's tick. A challenge's bridge limit counts the setup's bridges and the script's placed ones
 * together, and Bell's "Start the dance" is in a Bell link at most once.
 */
export const SeedLinkSchema = z
  .strictObject({
    v: z.literal(1),
    tuning: z.string().regex(/^[0-9a-f]{8}$/),
    setup: SandboxSetupSchema,
    script: z.array(z.strictObject({ tick, list: z.array(LinkCommandSchema) })).max(MAX_LINK_LISTS),
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
    }
    const { challenge, structures } = link.setup;
    const commands = link.script.flatMap((s) => s.list);
    const dances = commands.filter((c) => c.t === 'dance').length;
    if (dances > (challenge === 'bell' ? 1 : 0))
      ctx.addIssue({ code: 'custom', message: 'Only a Bell link has a dance, and only one' });
    const limit = challenge === null ? undefined : CHALLENGES[challenge].start.bridgeLimit;
    const placed = commands.filter((c) => c.t === 'place' && c.kind === 'bridge').length;
    if (limit !== undefined && bridgesIn(structures) + placed > limit)
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
 * The text that `bytes` inflate to, or null when they do not inflate or inflate past MAX_LINK_BYTES
 * (reading stops there). Fed one FEED_BYTES slice at a time, so even an engine that inflates a whole
 * written chunk before it enqueues any of it holds about 1 MiB of expansion at once.
 */
async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<string | null> {
  let fed = 0;
  const input = new ReadableStream<Uint8Array<ArrayBuffer>>(
    {
      pull(c) {
        if (fed >= bytes.length) c.close();
        else c.enqueue(bytes.subarray(fed, (fed += FEED_BYTES)));
      },
    },
    { highWaterMark: 0 },
  );
  const reader = input.pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return await new Blob(chunks).text();
      size += value.byteLength;
      if (size > MAX_LINK_BYTES) {
        reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
}

/**
 * The link in `text` (a fragment without its `#`, or a valley file's line), or null when it is
 * longer than MAX_LINK_TEXT, has no `v1.` prefix, is not URL-safe base64, does not inflate, has
 * bytes after the deflate end, inflates past MAX_LINK_BYTES (reading stops there), is not JSON,
 * fails SeedLinkSchema, is not the JSON encodeLink writes for it, or was made under another tuning
 * hash. Never throws. It does not build the scenario: the caller must treat a throw from
 * `sandboxScenario` (a bench density past the scene's spots, land that checkLand refuses) as a
 * broken link too.
 */
export async function decodeLink(text: string, tuningHash: string): Promise<SeedLink | null> {
  try {
    if (text.length > MAX_LINK_TEXT || !text.startsWith('v1.')) return null;
    const data = text.slice(3);
    if (!/^[A-Za-z0-9_-]+$/.test(data) || data.length % 4 === 1) return null;
    const binary = atob(data.replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const json = await inflate(bytes);
    // The stream must end at its last byte: without that byte it must not inflate, so no bytes (and
    // no words in the base64) can ride after the deflate end, which some engines ignore.
    if (json === null || (await inflate(bytes.subarray(0, -1))) !== null) return null;
    const parsed = SeedLinkSchema.safeParse(JSON.parse(json));
    // Canonical: only the JSON encodeLink writes, so no duplicate key or spacing can carry text.
    if (!parsed.success || JSON.stringify(parsed.data) !== json) return null;
    return parsed.data.tuning === tuningHash ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Whether the whole URL is short enough to share as a link (ADR 0014 item 7). */
export const fitsInLink = (url: string): boolean => url.length <= LINK_CHARS;
