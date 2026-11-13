import { expect, test } from 'vitest';
import inkStory from '../../../content/ink/main.ink';
import { createInk } from '../../../src/story/ink.ts';

// After a ch7 close call Wisp did not leave in the sim, so i7 tells that Wisp went on its own.
test("i7's opening line follows whether the wind pushed Wisp", () => {
  const line = (wispPushed: boolean) => {
    const ink = createInk(inkStory);
    ink.setVar('wispPushed', wispPushed);
    return ink.play('i7_intro');
  };
  expect(line(true).lines).toEqual(['A postcard comes over the ridge, with a path drawn on it.']);
  expect(line(false).lines[0]).toMatch(/^Wisp went over the ridge on its own/);
  expect(line(false).tags).toEqual(['placeholder']);
});
