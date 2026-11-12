import { expect, test } from 'vitest';
import { interpolateCreatures } from '../../../src/render/scene.ts';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';

const shell = { tightness: 0, bristle: 0, color: 0, softness: 0 };
const dials = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
const creature = (id: string, x: number, y: number) => ({
  id,
  x,
  y,
  state: 'wander' as const,
  shell,
  berries: 0,
  skyWarmth: 0,
  dials,
});
const lite = (creatures: WorldLite['creatures']): WorldLite => ({
  creatures,
  light: null,
  fog: { w: 0, h: 0, cells: new Float32Array(0) },
  metrics: { averageWarmth: 0, friendPairs: 0 },
  structures: [],
  water: [],
  ties: [],
  rumor: null,
});

const prev = lite([creature('a', 0, 100), creature('b', 50, 50), creature('gone', 7, 8)]);
// Order differs from prev: interpolation matches by id, not by index.
const next = lite([creature('b', 150, 0), creature('a', 100, 300), creature('new', 9, 10)]);
const at = (alpha: number) =>
  Object.fromEntries(interpolateCreatures(prev, next, alpha).map((c) => [c.id, [c.x, c.y]]));

test('alpha 0 draws every creature at its previous position', () => {
  expect(at(0)).toMatchObject({ a: [0, 100], b: [50, 50] });
});

test('alpha 0.5 draws every creature halfway, matched by id', () => {
  expect(at(0.5)).toMatchObject({ a: [50, 200], b: [100, 25] });
});

test('alpha 1 draws every creature at its next position', () => {
  expect(at(1)).toMatchObject({ a: [100, 300], b: [150, 0] });
});

test('a creature in only one snapshot is drawn where that snapshot has it', () => {
  for (const alpha of [0, 0.5, 1]) expect(at(alpha)).toMatchObject({ gone: [7, 8], new: [9, 10] });
});

test('state and shell come from the next snapshot when the creature is in it', () => {
  const p = lite([{ ...creature('a', 0, 0), state: 'wander' }]);
  const n = lite([{ ...creature('a', 0, 0), state: 'meet', shell: { ...shell, color: 1 } }]);
  expect(interpolateCreatures(p, n, 0)[0]).toMatchObject({ state: 'meet', shell: { color: 1 } });
});
