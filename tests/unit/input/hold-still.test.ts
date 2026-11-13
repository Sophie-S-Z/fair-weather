import { expect, test } from 'vitest';
import { createHoldStill } from '../../../src/input/hold-still.ts';

test('held() grows while the cursor is still and resets on a move of more than 4 pixels', () => {
  let now = 0;
  const hold = createHoldStill(() => now);
  hold.move(100, 100);
  now = 2000;
  expect(hold.held()).toBe(2);
  hold.move(103, 100); // a resting hand's tremor
  now = 3000;
  expect(hold.held()).toBe(3);
  hold.move(105, 100); // 5 pixels from where it rested
  expect(hold.held()).toBe(0);
  now = 4500;
  expect(hold.held()).toBe(1.5);
});

test('held() grows from the start when the cursor never moves (keyboard play)', () => {
  let now = 1000;
  const hold = createHoldStill(() => now);
  now = 6000;
  expect(hold.held()).toBe(5);
});
