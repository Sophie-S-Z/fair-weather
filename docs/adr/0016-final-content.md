# ADR 0016: Final writing and art

**Status:** Accepted. It changes hard constraints 5 and 6 of the handoff, and it supersedes ADR 0010 items 1 and 2 for the shipped game.

## Context

Hard constraint 5 banned generated text and art in the shipped game, and hard constraint 6 said that a human designer makes the final art. The project owner then chose not to hire a separate writer or artist, and asked Claude to take both roles and to replace every placeholder. This ADR records that ruling and the content rules that came with it.

## Decision

1. **Who writes and draws.** Claude writes the Ink script, the myth templates, the diaries, the margin notes, the journal, and the UI text, and draws the creature bodies, the stills, the journal drawings, and the interlude art. Each drawing is a hand-placed SVG path in the model-sheet style (one ink line, paper fill, one accent per valley). No image-generation model makes any art.
2. **The guard stays.** The placeholder guard (ADR 0010 item 3) and `npm run validate-content` stay as they are. Content now holds no placeholder of any kind, so `npm run build` passes, and CI builds and tests the production build.
3. **Bodies.** Each creature, hero kind, and villager body is `content/creatures/<id>.svg`; `npm run rig` makes `content/rigs/<id>.rig.json` from it. `content/bodies.json` gives each villager and Halcyon local one of the six shared villager bodies (spec 5.4). The widest and tallest bodies fit `bank.side` 53 and `bank.below` 123, so the tuning and the sim do not change.
4. **Names.** Every villager and local has a name in its scenario. `src/story/names.ts` reads the names from the scenarios. The state hash covers names, so the golden M0 hash moved once, from `c29d2fa4dbda4dcf` to `c2cb400e2f6e75e5`, with no change to any rule.
5. **Diary voices.** `content/diary.json` holds default lines and lines in the voice of each named creature. A writer's line for a memory is picked by a hash of the writer and the other creature, so the same pair always reads the same line.
6. **Stills and journal drawings.** A scene's still is `content/stills/<scene>.svg` (320 by 200), and a chapter's own `still` lives there too. A valley's journal drawing is `content/journal/<valley>.svg`, and each one shows what its `drawingAlt` says. This replaces the placeholder paths in ADR 0014 item 10.
7. **Margin notes.** Each note cites one or more real sources: papers by DOI link, and the Stanford Encyclopedia of Philosophy, Nicky Case's explorables, or a Wikipedia article where a paper link was not checked. The Lily Shallows notes say that Schelling-style models predict more sorting than real cities show, and that real segregation also has institutional and economic causes (spec 19.1).

## Consequences

- A change to a body is a change to its SVG, then `npm run rig`, then the bank test.
- A new villager needs a name in its scenario and an entry in `content/bodies.json`.
- Playtests (spec 20) still judge the writing and the art. This ADR does not replace them.
