import { expect, test } from 'vitest';
import { nextView, type ViewName } from '../../../src/input/zoom.ts';

test('zooming out goes soul to meadow to cosmos, and stays at cosmos', () => {
  const out: [ViewName, string | null, ViewName][] = [
    ['soul', 'pim', 'meadow'],
    ['soul', null, 'meadow'],
    ['meadow', 'pim', 'cosmos'],
    ['meadow', null, 'cosmos'],
    ['cosmos', 'pim', 'cosmos'],
    ['cosmos', null, 'cosmos'],
  ];
  for (const [from, picked, to] of out) expect(nextView(from, 'out', picked)).toBe(to);
});

test('zooming in goes cosmos to meadow, and meadow to soul only with a pick', () => {
  const into: [ViewName, string | null, ViewName][] = [
    ['cosmos', 'pim', 'meadow'],
    ['cosmos', null, 'meadow'],
    ['meadow', 'pim', 'soul'],
    ['meadow', null, 'meadow'],
    ['soul', 'pim', 'soul'],
    ['soul', null, 'soul'],
  ];
  for (const [from, picked, to] of into) expect(nextView(from, 'in', picked)).toBe(to);
});
