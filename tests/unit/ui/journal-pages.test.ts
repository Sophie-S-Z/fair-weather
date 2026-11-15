import { describe, expect, test } from 'vitest';
import fenJson from '../../../content/valleys/fen.json';
import halcyonJson from '../../../content/valleys/halcyon.json';
import { newJourney } from '../../../src/story/journey.ts';
import type { Journey } from '../../../src/story/journey.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';
import { inSentence, journalBlocks, journalEntries, mythBlocks } from '../../../src/ui/journal-pages.ts';

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

describe('journalBlocks', () => {
  test('the image of a page holds what the page shows, in order, with the caption as the player wrote it', () => {
    const [fen] = journalEntries(journey(false), chapters, drawingOf);
    if (!fen) throw new Error('no Fen page');
    const blocks = journalBlocks(fen);
    expect(blocks.slice(0, 3)).toEqual([
      { kind: 'title', text: 'Murmuration Fen' },
      { kind: 'image', src: '/fen.svg', width: 320, height: 200 },
      { kind: 'text', text: 'Keepsake: A starling feather' },
    ]);
    const texts = blocks.flatMap((b) => (b.kind === 'image' ? [] : [b.text]));
    for (const line of fen.locals) expect(texts).toContain(line);
    expect(texts).toContain(fen.stamp);
    // As on the HTML page: the stamp, the player's line, then what they say about you.
    const stamp = texts.indexOf(fen.stamp);
    expect(texts.slice(stamp, stamp + 4)).toEqual([fen.stamp, 'Reeds', 'What they say about you', fen.said]);
    const note = fen.notes[0];
    expect(blocks).toContainEqual({ kind: 'heading', text: note?.title });
    expect(blocks).toContainEqual({ kind: 'note', text: `Limits: ${note?.limits ?? ''}` });
    expect(blocks).toContainEqual({ kind: 'note', text: note?.sources[0]?.label });
  });

  test('a page without a caption, keepsake, or drawing holds no empty block', () => {
    const halcyon = journalEntries(journey(true), chapters, drawingOf)[1];
    if (!halcyon) throw new Error('no Halcyon page');
    const blocks = journalBlocks(halcyon);
    expect(blocks.some((b) => b.kind === 'image')).toBe(false);
    expect(blocks.every((b) => b.kind === 'image' || b.text.trim() !== '')).toBe(true);
    expect(blocks.filter((b) => b.kind === 'text' && /Keepsake|pressed/.test(b.text))).toEqual([]);
  });

  test('a keepsake given away reads as the empty pressed shape', () => {
    const [fen] = journalEntries(journey(true), chapters, drawingOf);
    if (!fen) throw new Error('no Fen page');
    expect(journalBlocks(fen)).toContainEqual({
      kind: 'text',
      text: 'An empty pressed shape where the starling feather was',
    });
  });
});

describe('mythBlocks', () => {
  test('a year page: the year, the narrator, and each verse with its title, text, and note', () => {
    const blocks = mythBlocks({
      year: 2,
      seed: 7,
      narrator: 'villager-3',
      verses: [
        { title: 'The Waking', text: 'The valley woke.', note: 'You blew 5 gusts.' },
        { title: 'The Asking', text: 'It asked.', note: null },
      ],
    });
    expect(blocks).toEqual([
      { kind: 'title', text: 'Year 2' },
      { kind: 'note', text: 'Told by Villager 3' },
      { kind: 'heading', text: 'The Waking' },
      { kind: 'text', text: 'The valley woke.' },
      { kind: 'note', text: 'What the sky did: You blew 5 gusts.' },
      { kind: 'heading', text: 'The Asking' },
      { kind: 'text', text: 'It asked.' },
    ]);
  });
});
