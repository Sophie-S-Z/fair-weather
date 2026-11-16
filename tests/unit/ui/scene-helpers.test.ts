import { expect, test } from 'vitest';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import {
  byId,
  clampToScene,
  createPauseToggle,
  nearestCreature,
  spotLine,
  spotName,
  whisperOthers,
} from '../../../src/ui/scene-helpers.ts';

type Creature = WorldLite['creatures'][number];
const at = (id: string, x: number, y: number, more: Partial<Creature> = {}) =>
  ({ id, x, y, state: 'wander', gone: false, ...more }) as Creature;

test('byId sorts by id in code unit order', () => {
  expect([at('pim', 0, 0), at('bell', 0, 0), at('Ada', 0, 0)].sort(byId).map((c) => c.id)).toEqual([
    'Ada',
    'bell',
    'pim',
  ]);
});

test('nearestCreature takes the nearest creature not away within the distance', () => {
  const list = [at('a', 30, 0), at('b', 0, 20, { state: 'away' }), at('c', 0, 35), at('d', 100, 0)];
  expect(nearestCreature(list, { x: 0, y: 0 }, 40)).toBe('a');
  expect(nearestCreature(list, { x: 0, y: 0 }, 29)).toBeNull();
  expect(nearestCreature([], { x: 0, y: 0 }, 40)).toBeNull();
});

test('whisperOthers names every cast creature not gone but the target, in id order', () => {
  const list = [at('pim', 0, 0), at('bell', 0, 0), at('newcomer-9', 0, 0), at('krit', 0, 0, { gone: true })];
  expect(whisperOthers(list, 'pim', ['bell', 'krit', 'pim'])).toEqual(['bell']);
  expect(whisperOthers(list, 'bell', ['bell', 'krit', 'pim'])).toEqual(['pim']);
});

test('clampToScene keeps a point inside the scene, edges included', () => {
  const size = { width: 1600, height: 900 };
  expect(clampToScene({ x: -5, y: 950 }, size)).toEqual({ x: 0, y: 900 });
  expect(clampToScene({ x: 800, y: 450 }, size)).toEqual({ x: 800, y: 450 });
});

test('spotName names the nearest bench spot in words; spotLine adds the creature nearby', () => {
  const spots = [
    { id: 'under-crooked-tree', x: 600, y: 430 },
    { id: 'east-meadow', x: 1050, y: 540 },
  ];
  expect(spotName(spots, { x: 1000, y: 500 })).toBe('east meadow');
  expect(spotName([], { x: 0, y: 0 })).toBe('');
  expect(spotLine('east meadow', null)).toBe('Spot near: east meadow');
  expect(spotLine('east meadow', 'Pim')).toBe('Spot near: east meadow, by Pim');
});

test('the pause toggle pauses, then resumes at the speed it paused from', () => {
  let speed = 2;
  const sent: number[] = [];
  const toggle = createPauseToggle(
    () => speed,
    (m) => {
      speed = m;
      sent.push(m);
    },
  );
  toggle();
  toggle();
  speed = 0; // a pause from elsewhere resumes at 1x
  const fresh = createPauseToggle(
    () => speed,
    (m) => {
      speed = m;
      sent.push(m);
    },
  );
  fresh();
  expect(sent).toEqual([0, 2, 1]);
});
