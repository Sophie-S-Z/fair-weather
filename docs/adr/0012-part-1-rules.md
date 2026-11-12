# ADR 0012: Part 1 rules for chapters 4 to 10

**Status:** Accepted

## Context

Milestone M2 builds chapters 4 to 10, the five interludes, and the myth. The spec names these features but leaves gaps: M1 starts every chapter from a fresh world, so nothing the village learned survives a chapter; lanterns, bridges, the ridge, ambient sky bids, the mushroom's taker, and the festival's spread have no exact rule; the tool tray holds three tools while P1 says a verb never goes away; and T6 asks for 1,000 random-play runs, which the full sim cannot do in a test run.

## Decision

1. **The year carries from chapter 4 on.** A chapter config with `carry: true` starts from the last snapshot of the chapter before it. For each creature in the base scenario it takes the dials, the shell (which becomes the new resting shell, so a body keeps its history), the sky warmth, and an `away` state, plus both warmths of every tie between base creatures. Slights, berries, positions, and newcomers do not carry. Chapters 0 to 3 keep `carry: false` and start fresh, as approved in M1. A skipped chapter carries the world as it was when the player skipped. T3 for a carried chapter starts from a stored carry made by one seeded headless run of the chapters before it.
2. **The snapshot grows** by what the new views and checks read: each creature's dials and `dancing`, every tie's two warmths, the latest rumor with the ids that hold it, the water rectangles, and the mushroom. A story valley has at most 435 ties, so a snapshot stays small.
3. **Land.** Water is a list of rectangles in the scenario. A creature never steps into water unless it is within `bridge.radius` (32) of a bridge. A blocked creature heads for the nearest bridge on that water, or picks a new goal when there is none. A bridge is placed only inside water. A lantern scales the fog at any point within `lantern.radius` (120) by `lantern.fogFactor` (0.5), as the Lantern-bearer knack does. The thaw brook runs in chapters 9 and 10 only. A scenario `ridgeX` is the east ridge: a wandering creature at or past it leaves for good (`gone`, it never returns in Part 1), random goals stay west of it, and a gust sets each creature it pushes to walk to the gust's end point. So only the player's wind sends anyone over.
4. **Ambient sky bids.** In a scenario with `ambientSkyBids`, at each dusk, with chance `sky.ambientBidChance` (0.5), the awake creature with the highest sky warmth (a tie goes to the lower id) bids to the sky. The director answers `away` after 6 seconds, as for a story bid, but does not prompt it again.
5. **The dew mushroom** follows spec 6.2 for the next dawn's drops. One drop is one berry. A creature within `meet.radius` takes at most one drop per day, and only when it carries fewer than `mushroom.takeBelowBerries` (1) berries, or carries fewer than `forage.carryMax` while it has fewer than `mushroom.trustFriends` (2) friends. Distrust hoards; friendship leaves drops for others. A withered mushroom gives 0 drops at the next 3 dawns and 10 at the fourth.
6. **The festival.** A story beat starts the dance with a `dance` command (Pim, who carries Wisp's seed). Every `festival.everyTicks` (10) ticks, every awake creature that is not dancing starts when at least its threshold of friends dance, all at once from the same count. The threshold is `festival.threshold` (2), and Bell's is 3 (spec 5.3). Dancing changes nothing else.
7. **Old Moss's grudge** is against Krit: last winter a hungry Krit kept Moss's gift. Chapter 8 starts that tie side with 1 slight.
8. **The tool tray.** Spec 12.2's limit of three tools wins over P1. Each chapter lists at most three world tools. A taught verb stays part of the game and comes back in any later chapter that lists it. Bet, listen, and the mind verbs (peek, zoom, rewind) are never tray tools.
9. **Interludes** are chapter configs with `kind: "interlude"` and an `activity`. They run the sim, so the carry passes through them, with a 600-second day, so no dusk passes during one.
10. **Rewind is a reading tool.** It shows the world at an earlier tick of the chapter and never changes the live world. The worker rebuilds that tick from the chapter's first world or a dusk copy, plus the accepted commands. After a worker restart, the earliest tick it can show is the checkpoint it restarted from.
11. **T6 uses synthetic random play.** A seeded generator writes 1,000 random year logs in the runner's log format. The myth must differ in at least 900. A separate test feeds a real headless year log through the myth to check the two formats agree.
12. **The Quiet Visitor is drawn, not simulated.** Three minutes of real time with no input in one scene brings it, once per scene. It never enters the sim, so it cannot change a hash. Its feather is counted in the profile store with the *Book of Skies*.
13. **A margin note** has a title, the science, its limits, the strongest counter-view, an open question, and at least one source (spec 10.5).
14. **Bets on a number** list their options from low to high with `buckets`, one fewer than the options. The answer is the option whose bucket holds the measured value.

## Consequences

- Winter, the festival, and the narrator rest on what the player built, so the "earlier choices decide" twists are real sim results.
- Every new sim rule is switched on by an optional scenario field, so the M0 golden hash `c29d2fa4dbda4dcf` does not change.
- When a chapter's content changes, the stored carries for the chapters after it are made again with `vitest -u`.
