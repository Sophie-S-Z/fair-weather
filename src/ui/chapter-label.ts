// The one name of a chapter, for the heading and the chapter ribbon.
import type { Chapter } from '../story/schema.ts';

/** "Chapter 6" from the id `ch6`, or "Interlude". */
export function chapterLabel(c: Pick<Chapter, 'id' | 'kind'>): string {
  return c.kind === 'interlude' ? 'Interlude' : `Chapter ${c.id.replace(/^ch/, '')}`;
}

/** "Chapter 6: Fog", or "Interlude: The Door for Two". */
export function chapterHeading(c: Pick<Chapter, 'id' | 'kind' | 'title'>): string {
  return `${chapterLabel(c)}: ${c.title}`;
}
