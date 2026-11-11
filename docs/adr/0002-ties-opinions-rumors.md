# ADR 0002: Ties, opinions, and rumors

**Status:** Accepted

## Context

Spec 9.1 gives one tie per pair, with "warmth" and "slights remembered". The gift rule (9.3) needs slights that one creature holds against one partner, so slights are directed. Spec 9.4 gossip needs opinions, but the spec does not say how an opinion is stored, how a creature forms one, or how an opinion changes behavior.

## Decision

1. **A tie is directed on each side.** `Tie { a, b, ab: Side, ba: Side, meetings, lastDay }`, with `Side { warmth, slights }`. `ab.warmth` is how `a` feels about `b`. The key is the two ids sorted and joined with `|`.
2. **Friend:** `b` is a friend of `a` when `ab.warmth > friend.threshold` (0.3).
3. **Opinion:** `creature.opinions[otherId]` is a signed number from −1 to 1. A creature **holds** an opinion when the absolute value is at least `opinion.holdAt` (0.3). After each meeting, each side sets its opinion of the partner to its own tie warmth. So direct experience forms opinions, and gossip spreads them.
4. **Effective warmth:** bids and gifts use `clamp(warmth + opinion.weight × opinion, −1, 1)`, with `opinion.weight` = 0.5. A first meeting starts the tie warmth at `opinion × opinion.weight`. This is how a rumor reaches a creature that never met its subject.
5. **Gossip value:** a listener that takes on an opinion sets it to the mean value of the friends who hold it with that sign.
6. **Which opinion a creature shares:** the held opinion with the largest absolute value about a third creature (never about the listener). A tie goes to the lower id in code-unit order.
7. **Rumor:** `Rumor { about, sign, strength, origin, tick }`. A whisper sets the target's opinion of `about` to `sign × rumor.whisperStrength` (0.6) and adds one rumor record for render and the myth.
8. **Threads (Cosmos view):** drawing a thread sets both warmths to `max(w, thread.warmth)` (0.4). Cutting a thread sets both to `min(w, 0)`.

## Consequences

- Krit can gain from Pim while Pim cools toward Krit (chapter 2 needs this asymmetry).
- A rumor changes behavior through effective warmth, so a story beat never needs to overwrite a result.
