import { expect, test } from 'vitest';
import { createRng } from '../../../src/sim/rng.ts';

test('same seed gives the same 1,000 numbers', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
});

test('two seeds give different streams', () => {
  const a = createRng(1);
  const b = createRng(2);
  const xs = Array.from({ length: 100 }, () => a.next());
  const ys = Array.from({ length: 100 }, () => b.next());
  expect(xs).not.toEqual(ys);
});

test('values are in [0, 1)', () => {
  const r = createRng(7);
  for (let i = 0; i < 100_000; i++) {
    const v = r.next();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});

test('state() resumes the stream', () => {
  const a = createRng(99);
  for (let i = 0; i < 10; i++) a.next();
  const b = createRng(a.state());
  for (let i = 0; i < 10; i++) expect(b.next()).toBe(a.next());
});

test('int(n) is in [0, n) and pick() throws on an empty list', () => {
  const r = createRng(5);
  for (let i = 0; i < 1000; i++) {
    const v = r.int(7);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(7);
  }
  expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
  expect(() => r.pick([])).toThrow();
});

test('first five values for seed 0 match the stored vector', () => {
  expect(Array.from({ length: 5 }, createRng(0).next)).toMatchSnapshot();
});
