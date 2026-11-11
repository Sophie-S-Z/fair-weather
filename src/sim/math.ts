// Deterministic math helpers (ADR 0001). Only + - * / and sqrt: exact in every engine.

/** Smooth S-curve in (0, 1): 0.5 + 0.5 * u / sqrt(1 + u^2), u = x / 2. Slope 0.25 at 0. */
export function sigmoid(x: number): number {
  const u = x / 2;
  return 0.5 + (0.5 * u) / Math.sqrt(1 + u * u);
}

// Degree-6 coefficients (constant term first) for 2^-f on [0, 1]. Fitted offline by weighted
// least squares with weight 2^f (relative error) over 20,001 points and the constant fixed to 1.
// Max relative error 5.1e-9, proven below 1e-7 in tests/unit/sim/math.test.ts.
const C0 = 1;
const C1 = -0.6931470492120679;
const C2 = 0.24022426321579093;
const C3 = -0.05549058254204332;
const C4 = 0.009579266218731569;
const C5 = -0.001275137518031688;
const C6 = 0.00010924239623906219;

/** 2^(-a) for a >= 0: halve floor(a) times, then a polynomial for the fractional part. */
export function exp2neg(a: number): number {
  if (a > 1074) return 0;
  const whole = Math.floor(a);
  const f = a - whole;
  let v = C0 + f * (C1 + f * (C2 + f * (C3 + f * (C4 + f * (C5 + f * C6)))));
  for (let i = 0; i < whole; i++) v *= 0.5;
  return v;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Squared distance between two points. */
export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
