import { expect, test } from 'vitest';
import inkStory from '../../../content/ink/main.ink';
import { createInk } from '../../../src/story/ink.ts';
import { DEFAULT_FLAGS } from '../../../src/story/flags.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';
import { sceneStill, stillPages } from '../../../src/story/stills.ts';
import type { InkRunner } from '../../../src/story/ink.ts';
import ch0 from '../../../content/chapters/ch0.json';
import ch1 from '../../../content/chapters/ch1.json';
import fen from '../../../content/valleys/fen.json';

const chapters = [ch0, ch1, fen].map((c) => ChapterSchema.parse(c));

/** An Ink runner that gives one line per knot and keeps the knots it played. */
function fakeInk(played: string[] = []): InkRunner {
  return {
    setVar: () => undefined,
    state: () => '{}',
    load: () => undefined,
    play(knot) {
      played.push(knot);
      return { lines: [`line of ${knot}`], tags: [] };
    },
  };
}

test('stillPages gives one page per chapter in play order with its knots in beat order', () => {
  const played: string[] = [];
  const pages = stillPages(chapters, fakeInk(played), DEFAULT_FLAGS);
  expect(pages.map((p) => p.id)).toEqual(['ch0', 'ch1', 'fen']);
  expect(pages.map((p) => p.title)).toEqual(chapters.map((c) => c.title));
  const knotsOf = (i: number) =>
    (chapters[i]?.beats ?? [])
      .filter((b) => !('closeCall' in b.trigger))
      .flatMap((b) => b.actions.flatMap((a) => ('ink' in a ? [a.ink] : [])));
  expect(pages[0]?.lines).toEqual(knotsOf(0).map((k) => `line of ${k}`));
  expect(pages[0]?.lines.length).toBeGreaterThan(1);
  expect(pages[1]?.notes).toEqual(chapters[1]?.notes);
  expect(played).toEqual([0, 1, 2].flatMap(knotsOf));
});

test('a close-call beat is left out; a chapter with no still uses its scene placeholder', () => {
  // The valleys' own close-call beats open a card and play no Ink, so this one adds a knot.
  const missed = {
    ...chapters[2],
    beats: [
      ...(chapters[2]?.beats ?? []),
      { id: 'missed', trigger: { closeCall: true as const }, actions: [{ ink: 'missed_knot' }] },
    ],
  } as (typeof chapters)[number];
  const played: string[] = [];
  const pages = stillPages([missed], fakeInk(played), DEFAULT_FLAGS);
  expect(played.length).toBeGreaterThan(0);
  expect(played).not.toContain('missed_knot');
  expect(pages[0]?.lines).not.toContain('line of missed_knot');
  expect(stillPages(chapters, fakeInk(), DEFAULT_FLAGS).map((p) => p.still)).toEqual(
    chapters.map((c) => `PLACEHOLDER-still-${c.scene}`),
  );
  expect(sceneStill('fen')).toBe('PLACEHOLDER-still-fen');
  const own = { ...chapters[0], still: 'meadow-dawn' } as (typeof chapters)[number];
  expect(stillPages([own], fakeInk(), DEFAULT_FLAGS)[0]?.still).toBe('meadow-dawn');
});

test('the lines hold no #beat tag and no empty line', () => {
  const pages = stillPages(chapters, createInk(inkStory), DEFAULT_FLAGS);
  expect(pages.flatMap((p) => p.lines).length).toBeGreaterThan(5);
  for (const line of pages.flatMap((p) => p.lines)) {
    expect(line).not.toMatch(/#|beat:/);
    expect(line.trim()).not.toBe('');
  }
});
