# ADR 0003: Meeting rules

**Status:** Accepted

## Context

Spec 9.3 gives the bid, gift, payoff, and warmth rules. It leaves open the definition of hunger, who bids, what a fog misread changes, and how a bench "doubles the chance that the same pair meets again".

## Decision

1. **Trigger:** two creatures in state `wander` within `meet.radius` (24) meet, unless the pair met on the same day. Pairs are found with the grid and processed in sorted key order. A creature takes part in at most one meeting per tick. Both stay in state `meet` for `meet.durationTicks` (20).
2. **Hunger:** `hunger = 1 − min(berries, 3) / 3`.
3. **Who bids:** the creature with the higher Opener. On a tie, the PRNG picks.
4. **Reply chance:** `pToward = sigmoid(bid.gain × (w + bid.openerWeight × Opener − bid.hungerWeight × hunger))`, where `w` is the replier's effective warmth toward the bidder (ADR 0002). Light boosts add `bToward − bAgainst` (spec 9.4), and the result is clamped to [0, 1]. A non-toward reply is `against` when `w < bid.againstBelowWarmth` (−0.4), else `away`.
5. **Fog is perception.** Fog at the meeting midpoint turns a toward reply into a *seen* away with chance `fog.bidFlipFactor × fog`. A gift is *seen* as a keep with chance `fog.giftMisreadFactor × fog`. Berries move for the real gift. Warmth, slights, and shells use what each side saw.
6. **Gift choice:** at a first meeting, `pGive = Opener`. Later, `pGive = 1` unless the giver's remembered slights against the partner are more than `round(gift.maxSlightsPerForgiveness × Forgiveness)`, then `pGive = 0`. Slights are stored as a fading number. The remembered count is `round(slights)`, so a slight is forgotten when it fades below 0.5. With Memory 0 (half-life 1 day) that takes 2 days. With Memory 1 (half-life 30 days) it takes 31 days, so Forgiveness 0 and Memory 1 act as a Grudger. Light boosts add `bGive − bKeep`, clamped. A creature with 0 berries keeps.
7. **Payoff:** a gift costs the giver `gift.cost` (1) and gives the receiver `gift.value` (3), or `gift.valueWinter` (2) in winter.
8. **Warmth:** the spec table, applied to the side that saw the event. "Keep after your gift" adds one slight and raises tightness by `shell.betrayalTightness`. Warmth is clamped to [−1, 1].
9. **Bench repeat:** benches attract. When a creature picks a goal, it picks a bench with chance `goal.benchChance` (0.25). If it met a partner at a bench on the day before, it picks that bench with chance `goal.benchChance × meet.benchRepeatMultiplier` (0.5). "At a bench" means within `meet.radius` of a bench.

## Consequences

- One bench makes the same pairs meet again, so warmth builds (chapter 3 twist), without any forced result.
