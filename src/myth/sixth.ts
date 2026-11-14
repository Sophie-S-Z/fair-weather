// The sixth verse (spec 10.6 item 6, ADR 0013 item 13): The Sky Came Down, from the hero's journey
// and the Part 2 flags, in the template form of the Part 1 verses.
import { z } from 'zod';
import type { HeroKind } from '../sim/types.ts';
import type { Flags } from '../story/flags.ts';
import type { Journey } from '../story/journey.ts';
import { holds, slotPattern, templateSchema } from './grammar.ts';
import type { FeatureTypes } from './grammar.ts';

export interface SixthFeatures {
  hero: HeroKind;
  /** The share of the record's moves that are gifts; 0.5 with no move. */
  giftShare: number;
  /** The share of answered bids turned against; 0 with none answered. */
  againstShare: number;
  wispHome: boolean;
  kithHeld: boolean;
  toveFlew: boolean;
  heroFamous: boolean;
}

/** The journey and the Part 2 flags as features. The shares follow journey.ts rumorValue's rules. */
export function sixthFeatures(j: Journey, flags: Flags): SixthFeatures {
  const { moves, answered, against } = j.record;
  return {
    hero: j.hero.kind,
    giftShare: moves.length === 0 ? 0.5 : moves.filter((m) => m === 'give').length / moves.length,
    againstShare: answered === 0 ? 0 : against / answered,
    wispHome: flags.wispHome,
    kithHeld: flags.kithHeld,
    toveFlew: flags.toveFlew,
    heroFamous: flags.heroFamous,
  };
}

const FEATURE_TYPES = {
  hero: 'string',
  giftShare: 'number',
  againstShare: 'number',
  wispHome: 'boolean',
  kithHeld: 'boolean',
  toveFlew: 'boolean',
  heroFamous: 'boolean',
} as const satisfies FeatureTypes<SixthFeatures>;

// Every hero kind, so a `hero` condition names one (myth may not import sim values).
const HERO_SET: Record<HeroKind, true> = {
  lantern: true,
  kite: true,
  mosscoat: true,
  glassling: true,
  seedcarrier: true,
  bellchime: true,
};

const SLOTS = ['hero', 'narrator'] as const;
type Slot = (typeof SLOTS)[number];
const SLOT = slotPattern(SLOTS);

/** content/myth/sixth.json: one verse; its first line is the spec's own, and its last template holds always. */
export const SixthSchema = z.strictObject({
  id: z.literal('sky'),
  title: z.literal('The Sky Came Down'),
  firstLine: z.literal('The sky came down once, and walked with us.'),
  templates: z
    .array(
      templateSchema(FEATURE_TYPES, SLOTS).refine(
        (t) => t.when.every((c) => c.feature !== 'hero' || Object.hasOwn(HERO_SET, String(c.value))),
        { message: 'a hero condition names a hero kind' },
      ),
    )
    .min(6)
    .max(8)
    .refine((ts) => ts[ts.length - 1]?.when.length === 0, { message: 'the last template has no condition' }),
});
export type Sixth = z.infer<typeof SixthSchema>;

/** Tells the sixth verse: the first line, then the first template whose every condition holds, with the slots filled. */
export function tellSixth(
  f: SixthFeatures,
  verse: Sixth,
  heroName: string,
  narrator: string,
  name: (id: string) => string,
): { title: string; text: string; note: string | null } {
  const t = verse.templates.find((tpl) => tpl.when.every((c) => holds(c, f)));
  // The schema makes the last template hold always.
  if (!t) throw new Error('the sixth verse has no template for this journey');
  const slot: Record<Slot, string> = { hero: heroName, narrator: name(narrator) };
  const fill = (s: string): string => s.replace(SLOT, (_, key: Slot) => slot[key]);
  return {
    title: verse.title,
    text: `${verse.firstLine} ${fill(t.text)}`,
    note: t.note === undefined ? null : fill(t.note),
  };
}
