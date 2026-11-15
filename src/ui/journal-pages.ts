// What the travel journal shows for each finished valley (ADR 0013 item 14): the journey's page
// joined with the valley's own words. Plain data, so the Journal screen only lays it out.
import type { PageBlock } from '../persist/page-image.ts';
import type { BookPage } from '../persist/profile.ts';
import { saying, stampWord } from '../story/journey.ts';
import type { Journey } from '../story/journey.ts';
import { displayName } from '../story/names.ts';
import type { Chapter, Note } from '../story/schema.ts';

export interface JournalEntry {
  valley: string;
  title: string;
  drawing: { src: string; alt: string } | null;
  /** The keepsake's label, and whether the hero still holds it; null for a valley without one. */
  keepsake: { label: string; held: boolean } | null;
  locals: readonly string[];
  stamp: string;
  said: string;
  caption: string;
  notes: readonly Note[];
}

/** "A starling feather" as it reads after "the": "starling feather". The keepsake tool and the journal both use it. */
export function inSentence(label: string): string {
  return label.replace(/^(an?|the) /i, '');
}

/**
 * One entry per page of the journey, in page order. `drawingOf` gives a valley's drawing (a
 * placeholder, ADR 0010) or null. A page whose valley is not in `chapters` is left out.
 */
export function journalEntries(
  journey: Journey,
  chapters: readonly Chapter[],
  drawingOf: (valley: string) => string | null,
): JournalEntry[] {
  return journey.pages.flatMap((page) => {
    const chapter = chapters.find((c) => c.id === page.valley);
    const valley = chapter?.valley;
    if (!chapter || !valley) return [];
    const src = drawingOf(page.valley);
    const label = valley.keepsake?.label;
    const held = journey.keepsakes.some((k) => k.id === page.keepsake && !k.given);
    return [
      {
        valley: page.valley,
        title: chapter.title,
        drawing: src !== null && valley.drawingAlt ? { src, alt: valley.drawingAlt } : null,
        keepsake: page.keepsake !== null && label ? { label, held } : null,
        locals: valley.locals,
        stamp: stampWord(page.stamp),
        said: saying(page.said),
        caption: page.caption,
        notes: chapter.notes,
      },
    ];
  });
}

/**
 * The image of a journal page (ADR 0014 item 8), from the same entry as its HTML: the title, the
 * drawing, the keepsake line, the locals, the stamp, what they say about you, the player's line,
 * and the notes. A page without a drawing, keepsake, or line has no block for it.
 */
export function journalBlocks(entry: JournalEntry): PageBlock[] {
  const { drawing, keepsake } = entry;
  return [
    { kind: 'title', text: entry.title },
    // Twice the HTML's 160 × 100, as the image's text is about twice the size of the screen's.
    ...(drawing ? [{ kind: 'image', src: drawing.src, width: 320, height: 200 } as const] : []),
    ...(keepsake
      ? [
          {
            kind: 'text',
            text: keepsake.held
              ? `Keepsake: ${keepsake.label}`
              : `An empty pressed shape where the ${inSentence(keepsake.label)} was`,
          } as const,
        ]
      : []),
    ...entry.locals.map((text) => ({ kind: 'text', text }) as const),
    { kind: 'text', text: entry.stamp },
    { kind: 'heading', text: 'What they say about you' },
    { kind: 'text', text: entry.said },
    ...(entry.caption.trim() === '' ? [] : [{ kind: 'text', text: entry.caption } as const]),
    ...entry.notes.flatMap((n): PageBlock[] => [
      { kind: 'heading', text: n.title },
      { kind: 'note', text: n.science },
      { kind: 'note', text: `Limits: ${n.limits}` },
      { kind: 'note', text: `Counter-view: ${n.counter}` },
      { kind: 'note', text: `Open question: ${n.question}` },
      ...n.sources.map((s) => ({ kind: 'note', text: s.label }) as const),
    ]),
  ];
}

/** The image of a Book of Skies year page, from the same page as its HTML: the year, the narrator, and each verse. */
export function mythBlocks(page: BookPage): PageBlock[] {
  return [
    { kind: 'title', text: `Year ${String(page.year)}` },
    { kind: 'note', text: `Told by ${displayName(page.narrator)}` },
    ...page.verses.flatMap((v): PageBlock[] => [
      { kind: 'heading', text: v.title },
      { kind: 'text', text: v.text },
      ...(v.note ? [{ kind: 'note', text: `What the sky did: ${v.note}` } as const] : []),
    ]),
  ];
}
