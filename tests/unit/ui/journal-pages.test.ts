import { describe, expect, test } from 'vitest';
import fenJson from '../../../content/valleys/fen.json';
import halcyonJson from '../../../content/valleys/halcyon.json';
import { newJourney } from '../../../src/story/journey.ts';
import type { Journey } from '../../../src/story/journey.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';
import { inSentence, journalEntries } from '../../../src/ui/journal-pages.ts';

const chapters = [ChapterSchema.parse(fenJson), ChapterSchema.parse(halcyonJson)];
const said = { value: 0.8, strength: 0.9 };
const journey = (given: boolean): Journey => ({
  ...newJourney('lantern', 'Wick', null, 1),
  keepsakes: [{ id: 'starling-feather', given }],
  pages: [
    {
      valley: 'fen',
      stamp: 'welcomed',
      said,
      keepsake: 'starling-feather',
      postcard: null,
      caption: 'Reeds',
    },
    { valley: 'halcyon', stamp: 'forgiven', said, keepsake: null, postcard: null, caption: '' },
  ],
});
const drawingOf = (v: string): string | null => (v === 'fen' ? '/fen.svg' : null);

describe('journalEntries', () => {
  test('a page joins the valley config: title, drawing and alt text, locals, stamp, saying, notes', () => {
    const [fen] = journalEntries(journey(false), chapters, drawingOf);
    expect(fen?.title).toBe('Murmuration Fen');
    expect(fen?.drawing?.src).toBe('/fen.svg');
    expect(fen?.drawing?.alt).toMatch(/starlings/);
    expect(fen?.locals).toHaveLength(3);
    expect(fen?.stamp).toContain('Welcomed');
    expect(fen?.said).toContain('you share');
    expect(fen?.caption).toBe('Reeds');
    expect(fen?.notes.length).toBeGreaterThan(0);
  });

  test('the keepsake shows while held; once given it is an empty pressed shape', () => {
    expect(journalEntries(journey(false), chapters, drawingOf)[0]?.keepsake).toEqual({
      label: 'A starling feather',
      held: true,
    });
    expect(journalEntries(journey(true), chapters, drawingOf)[0]?.keepsake?.held).toBe(false);
  });

  test('a page with no keepsake or no drawing shows neither', () => {
    const halcyon = journalEntries(journey(false), chapters, drawingOf)[1];
    expect(halcyon?.keepsake).toBeNull();
    expect(halcyon?.drawing).toBeNull();
  });

  test('inSentence drops the leading article', () => {
    expect(inSentence('A starling feather')).toBe('starling feather');
    expect(inSentence('An old key')).toBe('old key');
    expect(inSentence('The old key')).toBe('old key');
  });
});
