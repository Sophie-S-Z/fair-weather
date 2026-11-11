import { expect, test } from 'vitest';
import { parseBeatTag } from '../../../src/story/beat-tags.ts';

test('parseBeatTag reads arrange_meeting', () => {
  expect(parseBeatTag('beat:arrange_meeting(krit,pim)')).toEqual({
    kind: 'arrange_meeting',
    a: 'krit',
    b: 'pim',
  });
});

test.each([
  'beat:arrange_meeting(krit)',
  'beat:drop_table()',
  'beat:arrange_meeting(Krit,pim)',
  'placeholder',
])('parseBeatTag rejects %s', (t) => {
  expect(parseBeatTag(t)).toBeNull();
});
