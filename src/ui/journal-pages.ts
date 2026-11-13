// What the travel journal shows for each finished valley (ADR 0013 item 14): the journey's page
// joined with the valley's own words. Plain data, so the Journal screen only lays it out.
import { saying, stampWord } from '../story/journey.ts';
import type { Journey } from '../story/journey.ts';
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
