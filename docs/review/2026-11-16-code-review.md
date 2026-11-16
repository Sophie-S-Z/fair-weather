# Code review: cleanup and maintainability (2026-11-16)

This report covers the full repository at `main` 35f282a. It lists what the review found, what this branch changes, and what it leaves for later.

## Method

- Ran the baseline: lint, typecheck, unit, golden, property, t3, content validation, and the build. All passed before any change.
- Searched every export in `src`, `dev`, and `tools` for uses in other files, with comments removed first.
- Searched for files that no code imports, Svelte components that nothing mounts, and dependencies that no code uses.
- Searched for repeated blocks of six or more code lines across `src`, `dev`, and `tools`.
- Searched for `TODO`, `FIXME`, `@ts-ignore`, `eslint-disable`, `any`, loose equality, and floating promises.
- Read the composition root (`src/main.ts`), the worker host, the seed links, the saves, and the action log in full.

## Overall result

The codebase is in good condition. It has no unused files, no unused dependencies, no unmounted components, no `TODO` notes, and no type escapes in shipped code. Lint uses `strictTypeChecked`, so unused locals and floating promises already fail the build. Most findings are small duplicates. One finding is a real inconsistency in a test tool (item A6).

## Changes in this branch

| Id | Category | Finding | Why it was unnecessary | Impact of the change | Risk and check |
| --- | --- | --- | --- | --- | --- |
| A1 | Dead code | `FROG` in `src/sim/packs/shallows.ts` | Nothing reads it. The Shallows pack does not check the species. | 3 lines less | None. A search found no use. The golden hashes stay the same. |
| A2 | Dead code | `MindVerb` type, and the export of `MIND_VERBS`, in `src/story/verbs.ts` | Nothing imports either one. `VERBS` uses `MIND_VERBS` in the same file. | 2 lines less, a smaller module surface | None. Typecheck passes. |
| A3 | Duplicate logic | `VerbInput` repeated the 8 local verb shapes of `LocalVerb` | Two copies of one type can drift apart. | `VerbInput` now uses `LocalVerb`. 8 lines less. | Type-only import, which the module rules allow. Typecheck passes. |
| A4 | Duplicate logic | `src/story/action-log.ts` wrote the 8 local verb schemas twice | Same as A3, for the runtime schemas. | One `LOCAL_VERB_SHAPES` list serves both schemas. 9 lines less. | The `satisfies` checks still compare each schema to its type. A new test checks every local verb in both schemas. |
| A5 | Duplicate logic | `linkId` in `src/persist/seed-link.ts` copied the FNV-1a loop of `hashTuning` | The same hash in two places in one module. | `linkId` calls `hashTuning`. | The existing test pins the hash values (`811c9dc5`, `e40c292c`). It passes. |
| A6 | Duplicate logic, inconsistency | The WebGL draw-call counter had three copies in `dev/meadow.ts`, `dev/views.ts`, and `dev/perf.ts` | The Meadow and views copies counted only `drawElements` and `drawArrays`. The perf copy also counted the instanced calls. So the visual draw-call budgets did not see an instanced draw. | One `countDrawCalls` in `dev/meadow-setup.ts` counts all four calls for every page. 20 lines less. | The visual project passes with the same budgets, so the frames have no instanced draws today. |
| A7 | Duplicate logic | `dev/views.ts` loaded the cast and the palettes again | `dev/meadow-setup.ts` already exports `cast`, `paletteFor`, and `rigs` for the dev pages. | 15 lines less. | The views baselines pass. |
| A8 | Duplicate logic | `src/main.ts` cleared the Cosmos timeline in two places | Two copies of the same reset. | `snapshot` calls `clearTimeline`. 4 lines less. | The e2e and visual runs pass. |

New tests where coverage was missing:

- `tests/unit/render/ties.test.ts`: `tieKind` (the friend and scar rule that `main.ts` uses for `isFriend` and `ties`) and `nearestNode` (the pick radius, the edge of the radius, and a tie).
- `tests/unit/ui/tool-labels.test.ts`: `spotLabel`.
- `tests/unit/story/action-log.test.ts`: every local verb as a `local` command and as a verb input, and bad shapes for both.

The golden determinism hashes did not change. No change touches the step code in `src/sim`.

## Recommendations for later

These items are safe to do, but each one needs its own review, or its value is low. This branch does not change them.

| Id | Category | Finding | Impact | Risk before removal | Cleanup plan |
| --- | --- | --- | --- | --- | --- |
| R1 | Disconnected file | `src/sim/trust-mode.ts` (130 lines) is test-only. The game never imports it. | It makes `src` hold only shipped code. | ADR 0006 names this path as "the shipped code". The file must keep the sim lint rules. | Move it to `tests/science/trust-mode.ts`. Update the import in `tests/science/trust.test.ts` and the path in ADR 0006. |
| R2 | Duplicate UI styles | The dialog styles (`.backdrop`, `.card`, and the phone full-screen media rule) repeat in 8 Svelte files: BetCard, WhisperCard, HelpSheet, PostcardExport, SharePanel, BookOfSkies, Journal, and ModelLimits. | About 150 lines less. | The visual baselines, the axe checks, and the focus trap depend on these styles. | Add one shared dialog style sheet that `App.svelte` imports. Move one component at a time. Run e2e, axe, and visual after each move. |
| R3 | Duplicate logic | `HERO_SET` repeats in `src/myth/sixth.ts` and `src/story/journey.ts`. | 8 lines. | The module rules forbid `myth` and `story` to import sim values, so the copies are deliberate. | Keep them. Each copy fails typecheck if a hero kind is missing. |
| R4 | Duplicate logic | `src/persist/profile.ts` and `src/persist/slots.ts` repeat "open the database, and call `onUnavailable` once". | About 12 lines. | The two modules handle a failed read in different ways: a profile read calls `onUnavailable`, and a slot read does not. Keep that difference. | Add an `openOrNotify` helper to `src/persist/db.ts`. |
| R5 | Duplicate logic | `requestHash`, `requestCheckpoint`, and `askLite` in `src/sim-host/host.ts` repeat the give-up check. | About 10 lines. | The host restart tests cover this code well. | Add one helper that rejects after a give-up. |
| R6 | Duplicate logic | `dev/cast.ts` and `dev/rig.ts` repeat the `?shell=` parse. | 6 lines, dev pages only. | None. | Move it to a small helper in `dev/` if a third page needs it. |
| R7 | Unneeded exports | About 40 exports, most of them types, have uses only in their own file. | A smaller module surface. | Some names appear in ADRs and comments. | Remove `export` when you next change each file. |

## Areas checked with no issue

- **Unused files and routes:** Every file under `src`, `dev`, and `tools` has an importer or an entry point. Each dev page has a Playwright test, except `dev/cast.html`. That page is the model sheet for manual art review, so keep it.
- **Unused dependencies:** All 5 runtime and 18 dev dependencies have a use.
- **Unused UI components:** Every Svelte component has a parent.
- **Legacy code:** The save migrations (`SaveV1` to `SaveV3`) are still needed to load old saves. Keep them.
- **Redundant queries and calls:** The game has no server. `resume()` and `savedChapter()` each read the autosave once, on different screens. The sandbox status reads four profile values in parallel. The Stills screen builds its pages once when it opens.
- **Bugs:** The review found no bug in shipped code. `nearestNode` gives the later node on an exact tie. That is harmless, and the new test pins it.
