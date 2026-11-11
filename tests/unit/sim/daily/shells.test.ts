import { expect, test } from 'vitest';
import { updateShells } from '../../../../src/sim/daily/shells.ts';
import { befriend, get, makeWorld, scriptedRng, tuning as t } from '../helpers.ts';

test('shells: color moves 20% toward min(friends, 5) / 5', () => {
  const w = makeWorld([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  befriend(w, 'a', 'b');
  befriend(w, 'a', 'c');
  updateShells(w, t, scriptedRng([]));
  expect(get(w, 'a').shell.color).toBeCloseTo(0.2 * (2 / 5), 12);
  expect(get(w, 'b').shell.color).toBeCloseTo(0.2 * (1 / 5), 12);
});

test('shells: color target stops at 5 friends', () => {
  const ids = ['a', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
  const w = makeWorld(ids.map((id) => ({ id })));
  for (const f of ids.slice(1)) befriend(w, 'a', f);
  get(w, 'a').shell.color = 0.5;
  updateShells(w, t, scriptedRng([]));
  expect(get(w, 'a').shell.color).toBeCloseTo(0.5 + 0.2 * (1 - 0.5), 12);
});

test('shells: tightness, bristle, and softness relax 5% toward their resting values', () => {
  const w = makeWorld([{ id: 'a' }]);
  const a = get(w, 'a');
  a.restShell = { tightness: 0.2, bristle: 0, color: 0, softness: 0.4 };
  a.shell = { tightness: 0.6, bristle: 0.5, color: 0, softness: 0 };
  updateShells(w, t, scriptedRng([]));
  expect(a.shell.tightness).toBeCloseTo(0.6 + 0.05 * (0.2 - 0.6), 12);
  expect(a.shell.bristle).toBeCloseTo(0.5 - 0.05 * 0.5, 12);
  expect(a.shell.softness).toBeCloseTo(0.05 * 0.4, 12);
});
