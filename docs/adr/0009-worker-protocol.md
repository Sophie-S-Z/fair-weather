# ADR 0009: Worker protocol and replay

**Status:** Accepted

## Context

Spec 14.2 puts the sim in a Web Worker. Spec 16 says a crashed worker restarts from the last snapshot. Seed links (15.2) rebuild a world from the seed and the commands with their ticks.

## Decision

1. **The worker owns the tick.** The main thread sends commands without a tick. The worker applies them at the next tick and replies `accepted { tick, list }`. The story module logs these pairs. This log is the replay record for saves, seed links, and the myth.
2. **Messages, main to worker:** `init { seed, tuning, scenario, checkpoint? }`, `commands { list }`, `speed { multiplier }` (0 pauses), `hash`. A new worker starts paused. One more message, `advance { ticks }`, steps that many ticks at once; only tests and dev pages send it. Commands sent before an `advance` run at its first tick.
3. **Messages, worker to main:** `accepted { tick, list }`, `snapshot { tick, lite }` after every step, `events { tick, list }`, `checkpoint { tick, world }` at each dusk, `hash { tick, value }`, `error { message, lastGoodTick }`.
4. **World-lite** holds only what `render`, `audio`, and `ui` read: per creature `id, x, y, state, shell, berries, skyWarmth`, plus the light lens, the fog grid, and structures.
5. **Restart:** on `error` or a dead worker, the host starts a new worker with the last checkpoint, then sends again every accepted command after the checkpoint tick. The result has the same hash as a run with no crash.
6. **Core and shell:** `worker-core.ts` holds all message logic and takes a `post` function. `worker.ts` only connects it to `self`. Unit tests drive the core through a `MessageChannel`. Browser tests use the real worker.
7. **Clock:** only `sim-host` reads the clock, to pace steps at `sim.stepsPerSecond × multiplier`.

## Consequences

- Replay needs nothing but the seed, the tuning, the scenario, and the accepted log.
