import { expect, test } from 'vitest';
import { nearestNode, tieKind } from '../../../src/render/ties.ts';

test('a tie is a friend only when both warmths pass the threshold, and a scar when either is below 0', () => {
  expect(tieKind(0.6, 0.6, 0.5)).toBe('friend');
  expect(tieKind(0.6, 0.5, 0.5)).toBeNull(); // at the threshold is not above it
  expect(tieKind(0.9, 0.2, 0.5)).toBeNull();
  expect(tieKind(0, 0, 0.5)).toBeNull();
  expect(tieKind(0.9, -0.1, 0.5)).toBe('scar');
  expect(tieKind(-0.1, 0.9, 0.5)).toBe('scar');
});

test('a pick takes the nearest node within the radius, the later one on a tie, or none', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 10, y: 0 },
    { id: 'c', x: 30, y: 40 },
  ];
  expect(nearestNode(nodes, 7, 0, 44)).toBe('b');
  expect(nearestNode(nodes, 4, 0, 44)).toBe('a');
  expect(nearestNode(nodes, 5, 0, 44)).toBe('b');
  expect(nearestNode(nodes, 30, 0, 44)).toBe('b');
  expect(nearestNode(nodes, 30, 90, 44)).toBe(null);
  expect(nearestNode(nodes, 30, 84, 44)).toBe('c'); // exactly at the radius
  expect(nearestNode([], 0, 0, 44)).toBe(null);
});
