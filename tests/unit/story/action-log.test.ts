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

test('each local verb is a local command and a verb input, and a wrong field fails both', () => {
  const locals = [
    { verb: 'join', on: true },
    { verb: 'pose' },
    { verb: 'keepsake', to: 'wisp', item: 'feather' },
    { verb: 'stepDown', on: false },
    { verb: 'vote', spot: 'dry-hollow' },
    { verb: 'propose', rule: 'runoff' },
    { verb: 'learn', from: 'frog-1' },
    { verb: 'sing', to: 'frog-2' },
  ];
  for (const verb of locals) {
    expect(
      LogEntrySchema.safeParse({ kind: 'accepted', tick: 1, list: [{ t: 'local', verb }] }).success,
    ).toBe(true);
    expect(LogEntrySchema.safeParse({ kind: 'verb', tick: 1, input: verb }).success).toBe(true);
  }
  for (const bad of [{ verb: 'propose', rule: 'plurality' }, { verb: 'pose', on: true }, { verb: 'sing' }]) {
    expect(
      LogEntrySchema.safeParse({ kind: 'accepted', tick: 1, list: [{ t: 'local', verb: bad }] }).success,
    ).toBe(false);
    expect(LogEntrySchema.safeParse({ kind: 'verb', tick: 1, input: bad }).success).toBe(false);
  }
});
