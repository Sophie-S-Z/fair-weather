# ADR 0017: The toybox replaces the weather game

**Status:** Accepted. It supersedes ADRs 0002 to 0007, 0009, and 0011 to 0016. It changes ADR 0001 and ADR 0010.

## Context

The project owner found the weather-year game dull. They kept four parts: the one-line ink creatures, their small motions, the friendship map, and direct control of a creature. The design is `docs/superpowers/specs/2026-11-17-toybox-design.md`.

## Decision

1. **One table.** The game is one table with twelve different creatures and a drawer of eight props. The player plays freely. Twelve discoveries each play a short scene and give a sticker.
2. **No worker.** The table state lives on the main thread in `src/toy` and steps at a fixed 30 Hz. The Web Worker, the replay log, and the state hash go away with ADR 0009 and ADR 0011.
3. **Math.** ADR 0001 item 1 no longer applies, because no state crosses engines or links. `src/toy` keeps the seeded SplitMix32 PRNG (ADR 0001 item 4) and bans the clock globals in ESLint, so a test can replay a table exactly.
4. **Content.** `content/creatures/` and `content/rigs/` stay. `content/toy/stickers.json` holds the sticker book text. The placeholder guard (ADR 0010 item 3) stays.
5. **Modules.** Each module may import these modules as values. ESLint checks the table in `eslint.config.js`.

   | Module        | May import                                      |
   | ------------- | ----------------------------------------------- |
   | `src/toy`     | `content`                                       |
   | `src/render`  | `src/toy`, `content`                            |
   | `src/audio`   | nothing                                         |
   | `src/persist` | nothing                                         |
   | `src/ui`      | `src/toy`, `src/render`, `src/audio`, `src/persist`, `content` |

   `src/main.ts` is the composition root and may import every module.

## Consequences

- The game has no story, myth, share links, or analytics.
- The found stickers are the only saved progress, in `localStorage`.
- The unit tests drive the table with commands and check each discovery scene. The browser tests check play by pointer and by keyboard, the sticker book, axe, and offline play.
