# ADR 0010: Placeholder art and placeholder text

**Status:** Accepted

## Context

Hard constraint 5 bans AI-generated text, art, music, and myths in the shipped game. Hard constraint 6 allows hand-authored placeholder SVG files with a build guard. Engineering also needs dialogue lines, margin notes, and myth templates before a human writer delivers them (handoff open question 4).

## Decision

1. **Art:** placeholder SVG files live in `content/placeholder/` and are named `PLACEHOLDER-*.svg`. Placeholder rigs made from them are named `PLACEHOLDER-*.rig.json`.
2. **Text:** every placeholder Ink line carries the tag `#placeholder`. Every placeholder JSON text value (margin notes, myth templates, diary templates) starts with `[PLACEHOLDER] `. Lines from the spec itself (for example the cast voice lines in spec 5.3) are the user's text and need no tag.
3. **Guard:** the Vite plugin `tools/content-validate/placeholder-guard.ts` fails a production build when the bundle references any `PLACEHOLDER-` file, any `#placeholder` tag, or any `[PLACEHOLDER]` text. Development builds show placeholders.
4. `npm run validate-content` prints a count of each kind, so the team can track what is left.

## Consequences

- A production build cannot ship until a human replaces all placeholder art and text.
- Since the game screen imports the Ink story (M1.8), `npm run build` fails while any placeholder is referenced. Until writers deliver, CI builds in development mode (`npx vite build --mode development`), which keeps placeholders. `npm run build` stays the ship gate.
