# ADR 0011: Composition root, sim speed on the port, and metrics in the snapshot

**Status:** Accepted

## Context

Spec 14.2 lets `src/ui` import only `src/story` as values. The game screen still needs the Meadow view (`src/render`), sound (`src/audio`), and saves (`src/persist`). The chapter runner in `src/story` must set the sim speed for bets (8×) and read bet and twist metrics. The main thread sees only `WorldLite`, which has no ties, so it cannot count friend pairs.

## Decision

1. **Composition root:** `src/main.ts` is the only file that imports every module. It builds the sim host, the view, the audio engine, and the save slots. It passes them to `App.svelte` as props typed with `import type`. Svelte files follow the same boundary rules as `.ts` files.
2. **Speed:** `SimPort` gains `speed(multiplier: number): void`. The host posts `{ t: 'speed' }`. The chapter runner and the game screen use it. Speed 0 pauses.
3. **Metrics:** `src/sim/metrics.ts` computes metrics from a `World`. `toLite` copies `averageWarmth` and `friendPairs` into `WorldLite.metrics`, so the story reads metrics from snapshots. `maxBerries` comes from the creatures in the snapshot.
4. **Verb types:** `Verb` and `VerbInput` live in `src/story/verbs.ts`. `src/input` imports them, because input already depends on story.

## Consequences

- A new service for the game screen is one more prop on `App.svelte` and one more line in `main.ts`.
- Each snapshot costs one pass over the ties. Bets and twists never wait for a worker round trip.
