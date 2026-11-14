import { expect, test } from 'vitest';
import { LogEntrySchema } from '../../../src/story/action-log.ts';

test('the log accepts both walk shapes and manner, and rejects a walk mixing them', () => {
  const list = [
    { t: 'walk', x: 100, y: 200 },
    { t: 'walk', to: 'pim' },
    { t: 'manner', reply: 'away', gift: 'keep' },
  ];
  expect(LogEntrySchema.parse({ kind: 'accepted', tick: 3, list })).toEqual({
    kind: 'accepted',
    tick: 3,
    list,
  });
  for (const bad of [
    { t: 'walk', x: 100, y: 200, to: 'pim' },
    { t: 'walk', x: 100 },
    { t: 'manner', reply: 'toward', gift: 'hoard' },
  ]) {
    expect(LogEntrySchema.safeParse({ kind: 'accepted', tick: 3, list: [bad] }).success).toBe(false);
  }
});
