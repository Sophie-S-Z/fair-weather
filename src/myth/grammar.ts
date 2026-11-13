// The myth grammar (spec 10.6 items 2 to 5): five verses, each told by its first template whose
// every condition holds, with slots filled from the features.
import { z } from 'zod';
import type { MythFeatures } from './features.ts';

/** Each feature's value type: the feature list for conditions, and what a condition may compare. */
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
} as const satisfies {
  [K in keyof MythFeatures]: NonNullable<MythFeatures[K]> extends number
    ? 'number'
    : NonNullable<MythFeatures[K]> extends boolean
      ? 'boolean'
      : 'string';
};
const FEATURES = Object.keys(FEATURE_TYPES) as [keyof MythFeatures, ...(keyof MythFeatures)[]];

const SLOTS = ['narrator', 'mostLit', 'rumbles', 'gusts', 'welcomes', 'winterLeft'] as const;
type Slot = (typeof SLOTS)[number];
const SLOT = new RegExp(`\\{(${SLOTS.join('|')})\\}`, 'g');
/** Text whose every brace is one of the slots. */
const SlotText = z
  .string()
  .refine((s) => !/[{}]/.test(s.replace(SLOT, '')), { message: `slots are only ${SLOTS.join(', ')}` });

const ConditionSchema = z
  .strictObject({
    feature: z.enum(FEATURES),
    op: z.enum(['eq', 'gte', 'lte']),
    value: z.union([z.number(), z.boolean(), z.string()]),
  })
  .refine(
    (c) => typeof c.value === FEATURE_TYPES[c.feature] && (c.op === 'eq' || typeof c.value === 'number'),
    {
      message: "a condition's value has its feature's type, and gte and lte compare numbers",
    },
  );
type Condition = z.infer<typeof ConditionSchema>;

const TemplateSchema = z.strictObject({
  when: z.array(ConditionSchema),
  text: SlotText,
  note: SlotText.optional(),
});
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

function holds(c: Condition, f: MythFeatures): boolean {
  const v = f[c.feature];
  if (c.op === 'eq') return v === c.value;
  if (typeof v !== 'number' || typeof c.value !== 'number') return false;
  return c.op === 'gte' ? v >= c.value : v <= c.value;
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
