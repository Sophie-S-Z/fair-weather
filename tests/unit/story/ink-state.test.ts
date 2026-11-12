import { expect, test } from 'vitest';
import { createInk } from '../../../src/story/ink.ts';
import inkStory from '../../../content/ink/main.ink';

test('ink state saved and loaded into a fresh runner restores variables', () => {
  const a = createInk(inkStory);
  a.setVar('pimSkyBond', 0.75);
  const saved = a.state();
  expect(saved).not.toBe(createInk(inkStory).state());
  const b = createInk(inkStory);
  b.load(saved);
  expect(b.state()).toBe(saved);
});
