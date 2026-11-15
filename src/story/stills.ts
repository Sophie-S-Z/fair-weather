// The still version (ADR 0014 item 10): one page per chapter for a browser without WebGL, or when
// the sim is lost. Plain data, so the Stills screen only lays it out.
import type { Flags } from './flags.ts';
import { FLAG_KEYS } from './flags.ts';
import type { InkRunner } from './ink.ts';
import type { Chapter, Note } from './schema.ts';

export interface StillPage {
  id: string;
  title: string;
  /** The id of the still image: the chapter's `still`, or its scene's placeholder. */
  still: string;
  /** Every line of the Ink knots the chapter's beats play, in beat order. */
  lines: string[];
  notes: Note[];
}

/** The still image id of a scene, until an artist draws one per chapter (ADR 0010). */
export function sceneStill(scene: string): string {
  return `PLACEHOLDER-still-${scene}`;
}

/**
 * One page per chapter in the order given. The lines are those of the knots the beats play, read
 * with `flags` and no variant; a beat triggered by `closeCall` is left out, since it tells of a
 * miss that the page cannot show.
 */
export function stillPages(chapters: readonly Chapter[], ink: InkRunner, flags: Flags): StillPage[] {
  for (const key of FLAG_KEYS) ink.setVar(key, flags[key]);
  return chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    still: chapter.still ?? sceneStill(chapter.scene),
    lines: chapter.beats
      .filter((beat) => !('closeCall' in beat.trigger))
      .flatMap((beat) =>
        beat.actions.flatMap((action) => ('ink' in action ? ink.play(action.ink).lines : [])),
      )
      .filter((line) => line.trim() !== ''),
    notes: chapter.notes,
  }));
}
