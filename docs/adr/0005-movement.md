# ADR 0005: Movement and goals

**Status:** Accepted

## Context

The handoff suggests "steering along the walk mesh toward a goal picked by Wanderlust". M0 has no scene art, so it has no walk mesh.

## Decision

1. **M0:** the scene is a rectangle, `scene.width` 1600 by `scene.height` 900. A creature steers toward its goal at `move.speed` (40 world units per second). It accelerates at most `move.accel` (80 per second²). It arrives when it is within `move.arriveRadius` (8). Positions clamp to the scene.
2. **Goal choice** at arrival, in this order: a bench (ADR 0003); a bush with berries when the creature has fewer than 1 berry; then, with chance `1 − Wanderlust`, the position of a random friend; else a random point. The random point comes from cells the creature has visited least, from a coarse 8 × 4 visit count per creature.
3. **M1** adds the walk mesh from scene files. Steering then follows the mesh, and the goal rules stay the same.
4. **Story:** `arrangeMeeting(a, b)` sets both goals to the midpoint of the pair. The meeting itself still follows the rules.

## Consequences

- M0 tests and the perf probe run without art. The goal rules do not change when the mesh arrives.
