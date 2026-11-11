# ADR 0006: Trust mode and the T4 thresholds

**Status:** Accepted (option A, chosen by the user on 2026-11-11)

## Context

Spec T4 says: the forgiving copycat wins at 1% to 9% noise, always-keep wins at 10% noise or more, and always-keep wins with 5 or fewer rounds per match. These claims come from *The Evolution of Trust*. Each claim there comes from one demo with its own starting population.

On 2026-11-11 we ran a faithful prototype of Case's tournament. The setup was: payoff +2/+2, +3/−1, 0/0 (give costs 1, the receiver gets 3); 10 rounds per match; round robin; then remove the 5 lowest scores and clone the 5 highest; 50 generations; noise flips the intended move. The winner is the strategy with the most members at the end. The starting population had 25 members: 3 each of copycat, copykitten, always-give, grudger, detective, simpleton, and random, plus 4 always-keep. We ran 50 seeds for each case.

| Case | Share of seeds that the expected strategy won |
| --- | --- |
| Copykitten at 1%, 2%, 3%, 5%, 7%, 9% noise | 72%, 94%, 80%, 78%, 76%, 82% |
| Always-keep at 10%, 15%, 20% noise | 0%, 2%, 38% |
| Always-keep at 25%, 30%, 40%, 49% noise | 92%, 100%, 100%, 72% |
| Always-keep at 1, 2, 3 rounds (5% noise) | 100%, 100%, 78% |
| Always-keep at 4, 5 rounds (5% noise) | 0%, 0% |

Other populations gave the same shape with other cut points. So the low-noise claim holds. The 10% and 5-round cut points depend on the starting mix.

## Options

- **A (recommended):** keep the faithful model. T4 tests the shape with the cut points our model shows: copykitten wins in at least 70% of 50 seeds at each noise level from 1% to 9%; always-keep wins in at least 90% of 50 seeds at 30% and 40% noise; always-keep wins in at least 90% of 50 seeds at 1 and 2 rounds. A margin note says that the cut points move with the starting population. This fits spec 19.1 ("the game teaches the conditions, never a champion").
- **B:** search for a starting population and payoff set for each claim that gives Case's exact cut points, and test those. This fits the spec text, but it tunes the model to a known answer.

## Consequences

- With A, spec T4 changes its numbers. The plan updates the spec text in the same commit as the test.

## Measured with the shipped code

`src/sim/trust-mode.ts` with the project PRNG, 25-member population above, seeds 1 to 50, 50 generations, 10 rounds unless noted. Copykitten won 76%, 78%, 84%, 88%, 88%, 86% of seeds at 1%, 2%, 3%, 5%, 7%, 9% noise (10%: 88%). Always-keep won 100% at 30% and 40% noise, and 100% at 1 and 2 rounds (5% noise; 92% at 3 rounds). At 0% noise copycat won 50%, grudger 28%, copykitten 12%, so no copycat claim is tested at 0%.
