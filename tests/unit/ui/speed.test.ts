import { expect, test } from 'vitest';
import { createSpeedControl } from '../../../src/ui/speed.ts';

function control(hidden = false) {
  const sent: number[] = [];
  return { sent, speed: createSpeedControl((m) => sent.push(m), hidden) };
}

test("the player's 2x survives the runner's speed changes; a pause from either stays 0", () => {
  const { sent, speed } = control();
  speed.runner(1);
  speed.player(2);
  speed.runner(0); // a beat pauses
  speed.runner(1); // the next chapter starts
  speed.runner(8); // a bet's reveal speed
  speed.runner(1); // the reveal
  speed.player(0); // the player pauses
  expect(sent).toEqual([1, 2, 0, 2, 16, 2, 0]);
  expect(speed.current()).toBe(0);
});

test('the player resumes a pause at the chosen speed', () => {
  const { sent, speed } = control();
  speed.runner(0);
  speed.player(2);
  expect(sent).toEqual([0, 2]);
  expect(speed.current()).toBe(2);
});

test('a hidden tab gets 0, and the asked-for speed when it shows again', () => {
  const { sent, speed } = control(true);
  speed.runner(1);
  speed.player(2);
  expect(sent).toEqual([0, 0]);
  speed.setHidden(false);
  speed.setHidden(false);
  expect(sent).toEqual([0, 0, 2]);
  expect(speed.current()).toBe(2);
});
