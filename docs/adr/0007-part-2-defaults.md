# ADR 0007: Part 2 rule defaults

**Status:** Accepted. Part 2 work (M3 and M5) checks each value again in its golden runs.

| Gap | Decision |
| --- | --- |
| Hearsay Hollow drama score | Against bid 3, keep after a gift 2, away 1, toward 0, gift 0. The score of a meeting decays by half each day. The drama sky moves at 120 world units per second toward the meeting with the highest score. |
| Murmuration Fen reflection | Perceived share = the sum of `degree` over flying neighbors, divided by the sum of `degree` over all 7 neighbors. `degree` is the neighbor's own count of birds that list it among their 7 nearest. |
| Starling thresholds | Uniform from 0.2 to 0.8 from the PRNG. Tove is fixed at 0.5. |
| Foglight Heights map | A hand-authored height grid in `content/valleys/foglight/height.json`, with one small peak near the start and one high meadow beyond a fog valley. |
| Toadstool preferences | Two clusters on the map, placed so that plurality splits the vote between the two close spots. |
| Kith fast-forward during Part 2 | Run the Kith sim at full rules for 20 in-game days in the worker, with each postcard nudge applied on its arrival day. |
| Bet measurement | Each bet config names a metric, for example `{ "metric": "maxBerries", "afterDays": 7 }`. The sim module computes the metric at the reveal. |
| Hero reputation record | As spec 9.6. The record uses the hero's last 20 give-or-keep choices. |
