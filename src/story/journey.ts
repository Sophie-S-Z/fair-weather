// The journey (ADR 0013 items 8 to 11 and 14): what carries between valleys. The hero, its record
// and rumor, its keepsakes, the journal pages, and Wisp's choice; Kith's start for the silent run
// while the player is away. Plain data, so a save holds it. The hero's name stays on the device.
import { z } from 'zod';
// With the import attributes, so tools/content-validate can load this file in Node.
import heroesJson from '../../content/heroes.json' with { type: 'json' };
import journalJson from '../../content/journal.json' with { type: 'json' };
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Command, GiftMove, HeroKind, Scenario, Shell } from '../sim/types.ts';
import type { ActionLog } from './action-log.ts';
import { carryFrom, CarrySchema } from './carry.ts';
import type { Carry } from './carry.ts';
import { DEFAULT_FLAGS } from './flags.ts';
import { buildScenario, chapterTicksPerDay } from './scenario.ts';
import type { JourneyStart } from './scenario.ts';
import { POSTCARD_DIAL, POSTCARDS } from './schema.ts';
import type { Chapter, Postcard } from './schema.ts';
import { tuning } from './tuning.ts';

export interface JournalPage {
  valley: string;
  stamp: 'welcomed' | 'forgiven' | 'avoided';
  /** The rumor this valley would send ahead of the hero, as the page says it. */
  said: { value: number; strength: number };
  /** The valley's keepsake, or null without one. */
  keepsake: string | null;
  postcard: Postcard | null;
  /** The player's own line, at most 80 characters; '' until written. */
  caption: string;
}

export interface Journey {
  hero: { kind: HeroKind; name: string };
  /** The hero's last 20 give-or-keep moves, and the bids it answered and how many it turned against. */
  record: { moves: GiftMove[]; answered: number; against: number };
  rumor: { value: number; strength: number } | null;
  /** The hero's shell at the last valley's exit, or null before the first (ADR 0013 item 1). */
  shell: Shell | null;
  keepsakes: { id: string; given: boolean }[];
  pages: JournalPage[];
  /** Wisp's choice in Halcyon (ADR 0013 item 7), or null before it. */
  wisp: 'home' | 'stay' | null;
  /** Kith at the end of Part 1, where its silent run starts (ADR 0013 item 10). */
  kithStart: Carry | null;
  bookYear: number | null;
}

/** The Stage 1 valleys whose Kith days split kith.days, in play order (ADR 0013 item 10). */
export const KITH_VALLEYS = ['fen', 'hollow', 'halcyon'] as const;

const RECORD_LENGTH = 20;
/** The longest hero name, in characters (graphemes); the bridge's name field and heroResult share it. */
export const NAME_LENGTH = 24;
/** The longest caption, in characters (graphemes), that the journal and a save take. */
export const CAPTION_LENGTH = 80;

/**
 * The characters of `text` as a reader counts them (graphemes, so no emoji or accent splits). The
 * hero's name and the journal caption both count with it.
 */
export function characters(text: string): string[] {
  return Array.from(new Intl.Segmenter().segment(text), (g) => g.segment);
}

/**
 * Keeps the player's own line on the journal page of `valley`, cut to CAPTION_LENGTH characters.
 * It stays on the device: nothing here logs or sends it. A valley with no page changes nothing.
 */
export function setCaption(j: Journey, valley: string, text: string): void {
  const page = j.pages.find((p) => p.valley === valley);
  if (page) page.caption = characters(text).slice(0, CAPTION_LENGTH).join('');
}

// A Record over every hero kind, in HERO_KINDS order (story may not import sim values).
const HERO_SET: Record<HeroKind, true> = {
  lantern: true,
  kite: true,
  mosscoat: true,
  glassling: true,
  seedcarrier: true,
  bellchime: true,
};
const heroKind = z.enum(Object.keys(HERO_SET) as [HeroKind, ...HeroKind[]]);
const text = z.string().min(1);

/** content/heroes.json: the six heroes of spec 5.5. validate-content also checks their order. */
export const HeroesSchema = z.array(z.strictObject({ id: heroKind, name: text, look: text, knack: text }));

/** The six heroes the bridge offers, in content order. */
export const HEROES = HeroesSchema.parse(heroesJson);

/** content/journal.json: the "What they say about you" parts and the stamp words. */
export const JournalSchema = z.strictObject({
  saying: z.strictObject({ most: text, some: text, few: text, kind: text, mixed: text, unkind: text }),
  stamp: z.strictObject({ welcomed: text, forgiven: text, avoided: text }),
});

const said = z.strictObject({ value: z.number().min(-1).max(1), strength: z.number().min(0).max(1) });
const unit = z.number().min(0).max(1);

export const JourneySchema = z.strictObject({
  hero: z.strictObject({ kind: heroKind, name: z.string() }),
  record: z.strictObject({
    moves: z.array(z.enum(['give', 'keep'])).max(RECORD_LENGTH),
    answered: z.number().int().nonnegative(),
    against: z.number().int().nonnegative(),
  }),
  rumor: said.nullable(),
  shell: z.strictObject({ tightness: unit, bristle: unit, color: unit, softness: unit }).nullable(),
  keepsakes: z.array(z.strictObject({ id: z.string(), given: z.boolean() })),
  pages: z.array(
    z.strictObject({
      valley: z.string(),
      stamp: z.enum(['welcomed', 'forgiven', 'avoided']),
      said,
      keepsake: z.string().nullable(),
      postcard: z.enum(POSTCARDS).nullable(),
      caption: z.string().refine((c) => characters(c).length <= CAPTION_LENGTH, {
        message: `a caption has at most ${String(CAPTION_LENGTH)} characters`,
      }),
    }),
  ),
  wisp: z.enum(['home', 'stay']).nullable(),
  kithStart: CarrySchema.nullable(),
  bookYear: z.number().nullable(),
}) satisfies z.ZodType<Journey>;

export function newJourney(
  kind: HeroKind,
  name: string,
  kithStart: Carry | null,
  bookYear: number | null,
): Journey {
  return {
    hero: { kind, name },
    record: { moves: [], answered: 0, against: 0 },
    rumor: null,
    shell: null,
    keepsakes: [],
    pages: [],
    wisp: null,
    kithStart,
    bookYear,
  };
}

/**
 * The name trimmed of spaces, cut to 24 characters, and trimmed again (so heroResult and
 * parseHero agree), or the hero's own name when that leaves it empty.
 */
function heroName(kind: HeroKind, name: string): string {
  const trimmed = characters(name.trim()).slice(0, NAME_LENGTH).join('').trim();
  return trimmed || (HEROES.find((h) => h.id === kind)?.name ?? kind);
}

/** The bridge's activity result (ADR 0013 item 11): `kind:name`. */
export function heroResult(kind: HeroKind, name: string): string {
  return `${kind}:${heroName(kind, name)}`;
}

/** The bridge's result when no hero is chosen (ADR 0013 item 11): the first hero, with its own name. */
export const FIRST_HERO = heroResult(heroKind.parse(HEROES[0]?.id), '');

/** Reads heroResult's `kind:name`, split at the first colon, so a name may hold one. Throws on an unknown kind. */
export function parseHero(result: string): { kind: HeroKind; name: string } {
  const at = result.indexOf(':');
  if (at < 0) throw new Error(`Hero result "${result}" has no colon`);
  const kind = heroKind.parse(result.slice(0, at));
  return { kind, name: heroName(kind, result.slice(at + 1)) };
}

/** What the next valley starts from (scenario.ts JourneyStart): Wisp home beside the hero, or its seed. */
export function journeyStart(j: Journey, kithWarmth: number): JourneyStart {
  return {
    kind: j.hero.kind,
    name: j.hero.name,
    keepsakes: j.keepsakes.filter((k) => !k.given).map((k) => k.id),
    rumor: j.rumor,
    shell: j.shell && { ...j.shell },
    companion: j.wisp === 'home' ? 'wisp' : j.wisp === 'stay' ? 'seed' : null,
    kithWarmth,
  };
}

/**
 * `clamp(2 × giftShare − 1 − againstShare, −1, 1)` (ADR 0013 item 8): giftShare is 0.5 with no
 * move, and againstShare is 0 with no bid answered.
 */
export function rumorValue(record: Journey['record']): number {
  const gifts = record.moves.filter((m) => m === 'give').length;
  const giftShare = record.moves.length === 0 ? 0.5 : gifts / record.moves.length;
  const againstShare = record.answered === 0 ? 0 : record.against / record.answered;
  return Math.min(1, Math.max(-1, 2 * giftShare - 1 - againstShare));
}

/** The stamp from the locals' mean warmth toward the hero over their ties with it; avoided with no tie (ADR 0013 item 14). */
function stampOf(lite: WorldLite, locals: ReadonlySet<string>): JournalPage['stamp'] {
  const sides = lite.ties.flatMap((t) =>
    t.b === 'hero' && locals.has(t.a) ? [t.ab] : t.a === 'hero' && locals.has(t.b) ? [t.ba] : [],
  );
  if (sides.length === 0) return 'avoided';
  const mean = sides.reduce((s, w) => s + w, 0) / sides.length;
  return mean >= tuning.friend.threshold ? 'welcomed' : mean >= 0 ? 'forgiven' : 'avoided';
}

/**
 * The journey after `chapter` (a valley) ends with `lite` and `log`: the hero's moves and answered
 * bids join the record; the rumor is the record's value at the share of locals (not the hero, not
 * away) whose opinion of the hero is at least opinion.holdAt in size, except that a Kite-rider
 * leaving Murmuration Fen keeps the rumor it had (ADR 0013 item 3); keepsake events mark keepsakes
 * given and the valley's own joins them; a goHome or stay event sets Wisp's choice; the hero's
 * shell is the exit snapshot's; and the valley adds its journal page.
 */
export function leaveValley(j: Journey, chapter: Chapter, lite: WorldLite, log: ActionLog): Journey {
  if (!chapter.valley) throw new Error(`Chapter ${chapter.id} is not a valley`);
  const record = { ...j.record, moves: [...j.record.moves] };
  let wisp = j.wisp;
  const given = new Set<string>();
  let postcard: Postcard | null = null;
  for (const entry of log) {
    if (entry.kind === 'hero') {
      const e = entry.e;
      if (e.t === 'gift' && e.from === 'hero') record.moves.push(e.move);
      else if (e.t === 'bid' && e.to === 'hero') {
        record.answered += 1;
        if (e.reply === 'against') record.against += 1;
      }
    } else if (entry.kind === 'event') {
      const e = entry.e;
      if (e.t === 'keepsake') given.add(e.item);
      else if (e.t === 'goHome') wisp = 'home';
      else if (e.t === 'stay') wisp = 'stay';
    } else if (entry.kind === 'postcard') postcard = entry.type;
  }
  record.moves = record.moves.slice(-RECORD_LENGTH);

  const locals = new Set(
    lite.creatures.filter((c) => c.id !== 'hero' && c.state !== 'away').map((c) => c.id),
  );
  const opinions = lite.hero?.opinions ?? {};
  const holding = [...locals].filter((id) => Math.abs(opinions[id] ?? 0) >= tuning.opinion.holdAt).length;
  const now = { value: rumorValue(record), strength: locals.size === 0 ? 0 : holding / locals.size };
  const keepsake = chapter.valley.keepsake?.id ?? null;
  const keepsakes = j.keepsakes.map((k) => (given.has(k.id) ? { ...k, given: true } : { ...k }));
  if (keepsake !== null && !keepsakes.some((k) => k.id === keepsake))
    keepsakes.push({ id: keepsake, given: false });
  const kiteInFen = j.hero.kind === 'kite' && chapter.valley.pack === 'fen';
  const heroShell = lite.creatures.find((c) => c.id === 'hero')?.shell;
  return {
    ...j,
    hero: { ...j.hero },
    record,
    rumor: kiteInFen ? j.rumor : now,
    shell: heroShell ? { ...heroShell } : j.shell,
    keepsakes,
    pages: [
      ...j.pages,
      { valley: chapter.id, stamp: stampOf(lite, locals), said: now, keepsake, postcard, caption: '' },
    ],
    wisp,
  };
}

/** Kith's days while the player is in the `index`th Stage 1 valley: kith.days split in play order, the remainder first. */
export function kithDays(index: number): number {
  const n = KITH_VALLEYS.length;
  if (!Number.isInteger(index) || index < 0 || index >= n)
    throw new Error(`No Stage 1 valley at ${String(index)}`);
  const days = tuning.kith.days;
  return Math.floor(days / n) + (index < days % n ? 1 : 0);
}

/**
 * Kith's silent run while the player is away (ADR 0013 items 10 and 18) starts from the bridge's
 * scenario at Kith's start (the end of Part 1), counting the homecoming's days. The game's Kith
 * host and the stored home carry (tests/golden/carry.test.ts) both build it here, with kithLeg and
 * kithCarry, so the two cannot drift.
 */
export function kithScenario(
  bridge: Chapter,
  home: Pick<Chapter, 'dayLengthSeconds'>,
  base: Scenario,
  kithStart: Carry | null,
): Scenario {
  const day = { ...bridge, dayLengthSeconds: home.dayLengthSeconds };
  return buildScenario(day, DEFAULT_FLAGS, base, kithStart ?? undefined);
}

/**
 * Kith's leg while the player is in the `index`th Stage 1 valley: first the nudge of the postcard
 * sent there (none from a skipped valley), then kithDays(index) of the homecoming's days.
 */
export function kithLeg(
  index: number,
  postcard: Postcard | null,
  home: Pick<Chapter, 'dayLengthSeconds'>,
): { commands: Command[]; ticks: number } {
  const nudge: Command[] =
    postcard === null ? [] : [{ t: 'nudge', dial: POSTCARD_DIAL[postcard], amount: tuning.postcard.nudge }];
  return { commands: nudge, ticks: kithDays(index) * chapterTicksPerDay(home) };
}

/**
 * Kith's legs, in play order, for the Stage 1 valleys before `chapterId` (all three before the
 * homecoming), each with the postcard its journal page kept (none for a skipped valley, which has no
 * page). Continue runs them again from journey.kithStart, which the deterministic sim makes exact
 * (ADR 0013 item 10).
 */
export function kithLegsBefore(
  j: Journey,
  chapterId: string,
  home: Pick<Chapter, 'dayLengthSeconds'>,
): { commands: Command[]; ticks: number }[] {
  const at = (KITH_VALLEYS as readonly string[]).indexOf(chapterId);
  return KITH_VALLEYS.slice(0, at < 0 ? KITH_VALLEYS.length : at).map((valley, i) =>
    kithLeg(i, j.pages.find((p) => p.valley === valley)?.postcard ?? null, home),
  );
}

/** The homecoming's carry: Kith after its last leg, with the diaries of Kith's start, since a silent run writes none. */
export function kithCarry(lite: WorldLite, kithStart: Carry | null): Carry {
  return carryFrom(lite, new Map(kithStart?.creatures.map((c) => [c.id, c.diary])));
}

/** The word a journal page stamps for the locals' welcome. */
export function stampWord(stamp: JournalPage['stamp']): string {
  return journalJson.stamp[stamp];
}

/** "What they say about you" (ADR 0013 item 14): how many hold the rumor, then what it says. */
export function saying(s: { value: number; strength: number }): string {
  const { holdAt } = tuning.opinion;
  const { mostAt, someAt } = tuning.journal;
  const { saying: parts } = journalJson;
  const who = s.strength >= mostAt ? parts.most : s.strength >= someAt ? parts.some : parts.few;
  const what = s.value >= holdAt ? parts.kind : s.value <= -holdAt ? parts.unkind : parts.mixed;
  return `${who} ${what}`;
}
