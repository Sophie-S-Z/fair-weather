# ADR 0004: Daily rules, berries, and sky warmth

**Status:** Accepted

## Context

Spec 9.4 gives the daily rules. It does not say where berries go, what a bush's limit is, what "average warmth" means, what the shell resting values are, or how sky warmth changes.

## Decision

1. **Day:** a day has `ticksPerDay = sim.stepsPerSecond × story.dayLengthSeconds` ticks (400). Dusk is the last tick of the day. All daily rules run at dusk in this fixed order: gossip, eat, shells, leave, newcomer, bush regrowth, warmth drift, slight decay, imitation (every `imitation.everyDays`), return (every 7 days), art, boost expiry. Then `day` rises by 1.
2. **Foraging:** a creature within `meet.radius` of a bush with at least 1 berry, and carrying fewer than `forage.carryMax` (5), takes 1 berry. It can take again after `forage.cooldownTicks` (50).
3. **Eating:** at dusk, a creature with 0 berries counts a hungry dusk. Then it eats `eat.perDusk` (1) if it can. A hungry dusk raises bristle by `shell.hungerBristle`.
4. **Bush:** `berries += bush.growth × berries × (1 − berries / bush.limit) + bush.base`, clamped to [0, `bush.limit`]. `bush.limit` is 10.
5. **Spare berries:** the sum of bush berries divided by the number of creatures not `away`. With no creatures, spare is the bush total. At most one newcomer arrives per dusk, at the scene's gate point.
6. **Average warmth:** the mean `warmth` over all tie sides whose two creatures are not `away`. With no such sides it is 0.
7. **Leave and return:** the spec rules, with "friends" from ADR 0002. A leaving creature goes to state `away` and keeps its memory.
8. **Imitation:** fitness is `berries + imitation.friendWeight × friends`. An equal fitness gives no copy. The copied dial takes the neighbor's value.
9. **Light:** the lens has radius `light.lensRadius` (120). A meeting inside it adds a boost `{behavior, x, y, untilDay: day + light.days}` for each behavior in that meeting. Boosts within `light.radius` (300) of a meeting add up per behavior to at most `light.cap` (0.3).
10. **Art:** when average warmth is above `art.minWarmth` and berries per creature above `art.minBerries` at `art.days` dusks in a row, one creature picked by the PRNG makes one art piece each dusk. The kind comes from the PRNG.
11. **Shells:** tightness, bristle, and softness rest at the creature's starting values. Color moves each dusk by `shell.colorRate × (min(friends, shell.colorFullAt) / shell.colorFullAt − color)`, with `colorRate` 0.2 and `colorFullAt` 5. The other three move `shell.relaxRate` (0.05) of the way back to rest each dusk.
12. **Sky warmth:** glow back to a sky bid +0.1, stay still −0.03, rumble −0.15, over-poke −0.05, inside the light +0.01 per second up to +0.1 per day. All values live in `tuning.json` under `sky`.
13. **Empty worlds:** every rule must accept 0 or 1 creature with no division by zero.

## Consequences

- The berry economy closes: bushes grow, creatures forage, eat, and give. Winter (gift value 2) makes sharing pay less, as the spec wants.
