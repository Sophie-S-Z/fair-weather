import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { MODEL_LIMITS, ModelLimitsSchema } from '../../../src/story/limits.ts';
import { NoteSchema } from '../../../src/story/schema.ts';

/** Every JSON file under a folder, however deep. */
const jsonFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsonFiles(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : [],
  );

// Spec 19.1's four limits, word for word (the user's text, ADR 0010).
const SPEC_LIMITS = [
  '"Copycat wins" holds only under some noise levels and payoffs. The game teaches the conditions, never a champion.',
  "Gottman's bid figures (86% and 33%) come from observation and show correlation. The game never shows a bid score as a health score for real relationships.",
  'Schelling-style models predict more sorting than real cities show, and real segregation also has institutional and economic causes. The Lily Shallows margin notes say so.',
  'The claim that close friendships fell sharply from 1985 to 2004 is contested. The game does not use it.',
];

test('the first four items hold spec 19.1 in its words, with no tag', () => {
  expect(MODEL_LIMITS.title).toBe('Where this model is wrong');
  expect(MODEL_LIMITS.items.slice(0, 4).map((i) => i.text)).toEqual(SPEC_LIMITS);
  for (const item of MODEL_LIMITS.items.slice(0, 4)) {
    expect(item.heading.length).toBeGreaterThan(0);
    expect(`${item.heading} ${item.text} ${item.sources.map((s) => s.label).join(' ')}`).not.toContain(
      'PLACEHOLDER',
    );
  }
});

test('the one further item says what the model leaves out, with no placeholder', () => {
  const rest = MODEL_LIMITS.items.slice(4);
  expect(rest).toHaveLength(1);
  expect(rest[0]?.heading).toBe('What the model leaves out');
  expect(`${rest[0]?.heading ?? ''} ${rest[0]?.text ?? ''}`).not.toContain('PLACEHOLDER');
});

test('only sources that are already in content/ are used', () => {
  const known = jsonFiles('content')
    .filter((f) => !f.endsWith('model-limits.json'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  for (const item of MODEL_LIMITS.items)
    for (const s of item.sources) expect(known).toContain(`"url": "${s.url}"`);
});

test('the schema refuses an item with no heading, and a source that is not a link', () => {
  const item = { heading: 'A', text: 'B', sources: [] };
  expect(ModelLimitsSchema.safeParse({ title: 'T', items: [item] }).success).toBe(true);
  expect(ModelLimitsSchema.safeParse({ title: 'T', items: [{ ...item, heading: '' }] }).success).toBe(false);
  const noHeading = { text: 'B', sources: [] };
  expect(ModelLimitsSchema.safeParse({ title: 'T', items: [noHeading] }).success).toBe(false);
  const bad = { ...item, sources: [{ label: 'x', url: 'not a link' }] };
  expect(ModelLimitsSchema.safeParse({ title: 'T', items: [bad] }).success).toBe(false);
});

test('margin notes still need a source, while a limit may have none', () => {
  const note = { title: 't', science: 's', limits: 'l', counter: 'c', question: 'q', sources: [] };
  expect(NoteSchema.safeParse(note).success).toBe(false);
});
