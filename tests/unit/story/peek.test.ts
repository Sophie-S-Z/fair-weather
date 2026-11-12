import { expect, test } from 'vitest';
import { peekRule } from '../../../src/story/peek.ts';

const dials = { opener: 0.4, forgiveness: 0.5, memory: 0.5, ear: 0.2, wanderlust: 0.1 };

test('the payoff is cost 1 and value 3, or 2 in winter (spec 9.3)', () => {
  expect(peekRule(dials, 'spring').payoff).toEqual({ cost: 1, value: 3 });
  expect(peekRule(dials, 'winter').payoff).toEqual({ cost: 1, value: 2 });
});

test("three lines give the creature's own numbers: Opener, slights forgiven, slight half-life", () => {
  const { lines } = peekRule(dials, 'autumn');
  expect(lines).toHaveLength(3);
  expect(lines[0]).toContain('40%');
  expect(lines[1]).toContain('forgives 2 slights'); // round(3 × 0.5)
  expect(lines[2]).toContain('15.5 days'); // 1 + 29 × 0.5
});

test('a Grudger forgives no slights and remembers for 30 days', () => {
  const { lines } = peekRule({ ...dials, forgiveness: 0, memory: 1 }, 'spring');
  expect(lines[1]).toContain('forgives 0 slights');
  expect(lines[2]).toContain('30 days');
});

test('one slight is singular', () => {
  expect(peekRule({ ...dials, forgiveness: 0.3 }, 'spring').lines[1]).toContain('forgives 1 slight from');
});
