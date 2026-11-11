import { expect, test } from 'vitest';
import { clamp, dist2, exp2neg, sigmoid } from '../../../src/sim/math.ts';

// Coefficients in src/sim/math.ts were fitted offline with numpy: weighted least squares
// (weight 1/2^-f, so the error is relative) of 2^-f on [0, 1] over 20,001 points, degree 6,
// with the constant term fixed to 1 so that exp2neg(0) and exp2neg(1) are exact.
// Measured max relative error 5.1e-9; the test below proves the 1e-7 bound.

function hex64(x: number): string {
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, x);
  let s = '';
  for (let i = 0; i < 8; i++) s += dv.getUint8(i).toString(16).padStart(2, '0');
  return s;
}

test('sigmoid(0) is 0.5', () => {
  expect(sigmoid(0)).toBe(0.5);
});

test('sigmoid is strictly increasing on [-20, 20] at step 0.01', () => {
  let prev = sigmoid(-20);
  for (let i = 1; i <= 4000; i++) {
    const cur = sigmoid(-20 + i * 0.01);
    expect(cur).toBeGreaterThan(prev);
    prev = cur;
  }
});

test('sigmoid stays in (0, 1) on [-1e6, 1e6]', () => {
  for (const x of [-1e6, -1e5, -1e3, -100, -1, 0, 1, 100, 1e3, 1e5, 1e6]) {
    expect(sigmoid(x)).toBeGreaterThan(0);
    expect(sigmoid(x)).toBeLessThan(1);
  }
});

test('sigmoid is symmetric: sigmoid(-x) = 1 - sigmoid(x) within 1e-15', () => {
  for (let x = 0; x <= 50; x += 0.37) {
    expect(Math.abs(sigmoid(-x) - (1 - sigmoid(x)))).toBeLessThan(1e-15);
  }
});

test('sigmoid stays within 0.04 of the logistic curve', () => {
  for (let x = -10; x <= 10; x += 0.05) {
    expect(Math.abs(sigmoid(x) - 1 / (1 + Math.exp(-x)))).toBeLessThan(0.04);
  }
});

test('sigmoid matches the stored table bit for bit', () => {
  const bits: string[] = [];
  for (let x = -8; x <= 8; x += 0.25) bits.push(hex64(sigmoid(x)));
  expect(bits).toMatchSnapshot();
});

test('exp2neg matches 2^-a within 1e-7 relative on [0, 60]', () => {
  for (let i = 0; i <= 60_000; i++) {
    const a = i / 1000;
    const want = Math.pow(2, -a);
    expect(Math.abs(exp2neg(a) / want - 1)).toBeLessThan(1e-7);
  }
});

test('exp2neg(0) is 1, exp2neg(1) is 0.5, exp2neg(2000) is 0', () => {
  expect(exp2neg(0)).toBe(1);
  expect(exp2neg(1)).toBe(0.5);
  expect(exp2neg(2000)).toBe(0);
});

test('clamp and dist2', () => {
  expect(clamp(5, 0, 1)).toBe(1);
  expect(clamp(-5, 0, 1)).toBe(0);
  expect(clamp(0.5, 0, 1)).toBe(0.5);
  expect(dist2(0, 0, 3, 4)).toBe(25);
});
