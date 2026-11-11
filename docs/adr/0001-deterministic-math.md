# ADR 0001: Deterministic math, PRNG, and state hash

**Status:** Accepted

## Context

Spec 9.7 and hard constraint 1 allow only `+ − × ÷`, `Math.sqrt`, and one seeded PRNG inside `src/sim`. Some rules need curves: the bid sigmoid (9.3) and the slight half-life (9.3). The spec calls the sigmoid "a rational approximation" and gives no formula.

## Decision

1. **Allowed `Math` members in `src/sim`:** `sqrt`, `floor`, `ceil`, `round`, `trunc`, `abs`, `min`, `max`, `sign`, `imul`. These are exact in IEEE 754 in every engine. ESLint bans every other `Math` member, and the `Date`, `performance`, and `crypto` globals.
2. **Sigmoid:** `sigmoid(x) = 0.5 + 0.5 × u / sqrt(1 + u²)`, with `u = x / 2`. It is strictly increasing, `sigmoid(0) = 0.5`, it stays in (0, 1) for every finite input below about 1e8 in size, and its slope at 0 is 0.25, the same as the logistic curve. The largest gap from the logistic curve is about 0.04. It uses `sqrt` in place of a rational form, because a rational form must clamp to reach the bounds, and a clamp gives exact 0 and 1.
3. **Half-life decay:** `exp2neg(a)` returns `2^(−a)` for `a ≥ 0`. It halves the value `floor(a)` times, then applies a degree-6 polynomial for the fractional part (max relative error below 1e-7). Daily decay multiplies by `exp2neg(1 / halfLife)`.
4. **PRNG:** SplitMix32 with `Math.imul` and `>>>`. `next()` returns `uint32 / 2^32` in [0, 1). `int(n)` returns `floor(next() × n)`. One PRNG lives in the world state as one `uint32`, so a checkpoint carries it.
5. **Random spreads:** every "random amount" is uniform. Wind shifts a dial by `(2 × next() − 1) × spread`. No Gaussian, because it needs `log`.
6. **State hash:** two FNV-1a 32-bit lanes with different offset bases. Numbers go in as their 8 float64 bytes. Strings go in as UTF-16 code units. Maps and records go in sorted by key. The hash is 16 hex characters.

## Consequences

- The same seed and command list give the same hash in every engine. A browser golden test checks this (plan task M0.10).
- The bid curve is a little flatter than the logistic curve at large inputs. Tuning uses the curve that ships, so this has no effect on play.
