import { expect, test } from 'vitest';
import bridgeJson from '../../../content/chapters/bridge.json';
import ch6Json from '../../../content/chapters/ch6.json';
import i3Json from '../../../content/chapters/i3.json';
import fenJson from '../../../content/valleys/fen.json';
import homeJson from '../../../content/valleys/home.json';
import { ChapterSchema } from '../../../src/story/schema.ts';
import { chapterHeading } from '../../../src/ui/chapter-label.ts';

test('a Part 1 chapter and an interlude are headed by their label and title', () => {
  expect(chapterHeading(ChapterSchema.parse(ch6Json))).toBe('Chapter 6: Fog');
  expect(chapterHeading(ChapterSchema.parse(i3Json))).toBe('Interlude: The Door for Two');
});

test('the bridge and a valley are headed by their title alone', () => {
  expect(chapterHeading(ChapterSchema.parse(bridgeJson))).toBe('The Bridge');
  expect(chapterHeading(ChapterSchema.parse(fenJson))).toBe('Murmuration Fen');
  expect(chapterHeading(ChapterSchema.parse(homeJson))).toBe('The Homecoming');
});
