// The myth grammar (spec 10.6 items 2 to 5): five verses, each told by its first template whose
// every condition holds, with slots filled from the features.
import { z } from 'zod';
import type { MythFeatures } from './features.ts';

/** A feature's value type, which a condition's value must have. */
type FeatureType = 'number' | 'boolean' | 'string';
/** Each feature's value type in a features record `F`. */
export type FeatureTypes<F> = {
  [K in keyof F]: NonNullable<F[K]> extends number
    ? 'number'
    : NonNullable<F[K]> extends boolean
      ? 'boolean'
      : 'string';
};

/** Matches each `{slot}` of `slots` in a text. */
export const slotPattern = (slots: readonly string[]): RegExp =>
  new RegExp(`\\{(${slots.join('|')})\\}`, 'g');

/**
 * The template form (spec 10.6 item 3): conditions on the features of `types`, each `eq`, `gte`, or
 * `lte` a value of its feature's type, and a text and optional note whose every brace is a slot.
 */
export function templateSchema<K extends string>(
  types: Readonly<Record<K, FeatureType>>,
  slots: readonly string[],
) {
  const slot = slotPattern(slots);
  const text = z
    .string()
    .refine((s) => !/[{}]/.test(s.replace(slot, '')), { message: `slots are only ${slots.join(', ')}` });
  const condition = z
    .strictObject({
      feature: z.enum(Object.keys(types) as [K, ...K[]]),
      op: z.enum(['eq', 'gte', 'lte']),
      value: z.union([z.number(), z.boolean(), z.string()]),
    })
    .refine((c) => typeof c.value === types[c.feature] && (c.op === 'eq' || typeof c.value === 'number'), {
      message: "a condition's value has its feature's type, and gte and lte compare numbers",
    });
  return z.strictObject({ when: z.array(condition), text, note: text.optional() });
}

/** Whether condition `c` holds for the features `f`. */
export function holds<K extends string>(
  c: { feature: K; op: 'eq' | 'gte' | 'lte'; value: number | boolean | string },
  f: Readonly<Record<K, unknown>>,
): boolean {
  const v = f[c.feature];
  if (c.op === 'eq') return v === c.value;
  if (typeof v !== 'number' || typeof c.value !== 'number') return false;
  return c.op === 'gte' ? v >= c.value : v <= c.value;
}

/** Each Part 1 feature's value type: the feature list for conditions, and what a condition may compare. */
const FEATURE_TYPES = {
  lightOnConflict: 'number',
  lightOnKindness: 'number',
  rumbles: 'number',
  fogPainted: 'number',
  gusts: 'number',
  welcomes: 'number',
  mostLit: 'string',
  winterLeft: 'number',
  mossShared: 'boolean',
  bellDanced: 'boolean',
  festivalShare: 'number',
  wispPushed: 'boolean',
  narrator: 'string',
} as const satisfies FeatureTypes<MythFeatures>;

const SLOTS = ['narrator', 'mostLit', 'rumbles', 'gusts', 'welcomes', 'winterLeft'] as const;
type Slot = (typeof SLOTS)[number];
const SLOT = slotPattern(SLOTS);

const TemplateSchema = templateSchema(FEATURE_TYPES, SLOTS);
type Template = z.infer<typeof TemplateSchema>;

const usesMostLit = (t: Template): boolean => `${t.text}${t.note ?? ''}`.includes('{mostLit}');

const verse = <I extends string, T extends string>(id: I, title: T) =>
  z.strictObject({
    id: z.literal(id),
    title: z.literal(title),
    templates: z
      .array(TemplateSchema)
      .min(6)
      .max(8)
      .refine(
        (ts) => {
          const last = ts[ts.length - 1];
          return last !== undefined && last.when.length === 0 && !usesMostLit(last);
        },
        { message: 'the last template has no condition and does not name the most-lit creature' },
      ),
  });

/** content/myth/verses.json: the five Part 1 verses in spec order (spec 10.6 item 2). */
export const VersesSchema = z.strictObject({
  verses: z.tuple([
    verse('waking', 'The Waking'),
    verse('eye', "The Sky's Eye"),
    verse('moods', "The Sky's Moods"),
    verse('winter', 'The Long Winter'),
    verse('asking', 'The Asking'),
  ]),
});
export type Verses = z.infer<typeof VersesSchema>;

export interface MythPage {
  narrator: string;
  verses: { title: string; text: string; note: string | null }[];
}

/**
 * A verse's first template whose every condition holds. A template that names the most-lit
 * creature is passed over in a year with no lit meetings.
 */
export function chooseTemplate(v: Verses['verses'][number], f: MythFeatures): Template {
  const t = v.templates.find(
    (tpl) => (f.mostLit !== null || !usesMostLit(tpl)) && tpl.when.every((c) => holds(c, f)),
  );
  // The schema makes the last template hold in every year.
  if (!t) throw new Error(`verse ${v.id} has no template for this year`);
  return t;
}

/** Tells the myth: each verse from its chosen template, with the slots filled. */
export function tellMyth(f: MythFeatures, verses: Verses, name: (id: string) => string): MythPage {
  const slot: Record<Slot, string> = {
    narrator: name(f.narrator),
    mostLit: f.mostLit === null ? '' : name(f.mostLit),
    rumbles: String(f.rumbles),
    gusts: String(f.gusts),
    welcomes: String(f.welcomes),
    winterLeft: String(f.winterLeft),
  };
  const fill = (s: string): string => s.replace(SLOT, (_, key: Slot) => slot[key]);
  return {
    narrator: f.narrator,
    verses: verses.verses.map((v) => {
      const t = chooseTemplate(v, f);
      return { title: v.title, text: fill(t.text), note: t.note === undefined ? null : fill(t.note) };
    }),
  };
}
