# HANDOFF: Fair Weather

This file hands the Fair Weather project to a fresh Claude Code session. Read all of it before you act. Then read the spec. The spec is the source of truth for **what** to build. This file tells you **how to proceed**, what the user already decided, and where the spec still has gaps.

- **Handoff date:** 2026-11-11
- **Project root:** the folder that holds this file
- **Spec:** `docs/superpowers/specs/2026-11-11-fair-weather-design.md` (about 10,500 words, 23 sections, approved for review by the user)
- **Brainstorm doc (background only):** "Fair Weather: Combined Brainstorm", https://claude.ai/artifact/BhqJd5P9R4RtDKZhE9JtEp
- **Code written so far:** none. The repo holds only the spec and this file.

---

## 1. Goal

Build *Fair Weather*: a browser story game in two parts about small one-line ink creatures, trust, and the worlds that shape them.

- **Part 1, A Year in Kith.** The player is the weather over one valley for one year (11 chapters, 5 interludes, about 30 to 35 minutes). Sunlight, fog, wind, rain, and the seasons are the player's tools. Each tool holds one idea from game theory or network science. At the end, the creatures tell a myth about the sky, built from the player's actions.
- **Part 2, Elsewhither.** The player falls as rain, picks one of six designed heroes, and walks through six valleys to find Wisp, a lost friend. Each valley runs on a different social rule. A travel journal records the trip, and the player's reputation travels ahead of them. A homecoming closes the story.
- **Sandbox.** After the story, every rule becomes a tool.

The game is client-only, works offline after load, and is desktop-first with working touch. The audience is very mature teens (16+) and adults. The user wants it deep, dense with ideas, emotionally wide, and honest about its own model.

**Your immediate goal:** turn the spec into an implementation plan, get the user's approval of the plan, and then execute Milestone M0 (the technical spike) with test-driven development. Do not start later milestones until M0 passes its exit check and the user agrees.

---

## 2. Current progress

| Step | State |
| --- | --- |
| Research on all references (Nicky Case, Ralph Ammer, Bao To) | Done. Bao To's article could not be read (see section 6). |
| Two brainstorms merged ("Tanglepond" from the user, "Inkwell Hollow" from research) | Done, in the brainstorm doc |
| Story structure, cast, valleys, verbs | Done and approved |
| Eight design sections (purpose, tech approach, architecture, simulation, story engine, art and sound, screens, saves and testing) | Each one approved by the user |
| Full spec/PRD | Written and committed. The user has it to review. |
| Implementation plan | **Not started. This is your first task.** |
| Code | **Not started** |

---

## 3. Decisions the user made (do not reopen these)

| Topic | Decision |
| --- | --- |
| Name | **Fair Weather** (from "fair-weather friend"). Part 2 is **Elsewhither**. The home valley is **Kith**. The user rejected "Tanglewell", "Puddlemoot", "Little Weather", "Drizzlekin", "Kindlewisp", and other names as too toddler-like. Do not rename anything. |
| Purpose | An explorable explanation plus a sandbox, in the Nicky Case pattern, but story-heavy and theme-heavy |
| Structure | Part 1 (year and sky myth) then Part 2 (hero journey through valleys) |
| Characters | **A human designer draws every character.** The player never draws a character. The player picks a hero from six designed avatars and names it. |
| Audience | Very mature teens and adults: deep, thought-provoking, dense ideas, complex nuance, a wide range of feelings |
| Platform | Desktop first; phone works |
| Wisp's ending | Wisp can stay in Halcyon. Both endings are valid (spec 7.4). |
| Tech stack | Approach A: TypeScript, Vite, PixiJS, Svelte, Ink (inkjs), simulation in a Web Worker, Web Audio, IndexedDB |
| Architecture | Ten modules with hard rules (spec 14) |
| Release | Stage 1 = all of Part 1 + bridge + three valleys (Murmuration Fen, Hearsay Hollow, Halcyon) + homecoming + sandbox. Stage 2 = the other three valleys and extras (spec 21). |

---

## 4. Hard constraints (check every change against these)

1. **Determinism.** `src/sim` never reads the clock, never calls `Math.random`, and never calls `Math.exp`, `Math.sin`, `Math.pow`, or other transcendental functions. It uses only `+ − × ÷` and `Math.sqrt`, and one seeded PRNG. The same seed and command list must give the same state hash in every browser.
2. **Module boundaries.** `render` and `ui` read snapshots and never change the world. Only `story` changes the chapter, the valley, or the unlocked verbs. `content` holds data only, no logic.
3. **The honesty rule.** A story beat may arrange who meets whom, and when. It never overwrites a simulation result (spec 10.2).
4. **No player-drawn characters.** No verb, tool, or sandbox feature lets a player draw a creature or hero.
5. **No AI-generated content in the shipped game.** No generated art, text, music, or myths. The myth comes from hand-written templates.
6. **Placeholder art rule.** Final art comes from a human designer. You may hand-author simple one-line SVG placeholders so engineering can proceed. Put them in `content/placeholder/`, name every file `PLACEHOLDER-*.svg`, and add a build check that fails a production build if any placeholder is still referenced. Do not use image-generation models for any art.
7. **Privacy.** No accounts, no cookies, no identifiers. Analytics stay off unless the player opts in, and then send counts only (spec 15.4).
8. **No dark patterns.** No streaks, no guilt for time away, no leaderboards.
9. **Accessibility.** Full keyboard play, WCAG 2.2 AA text contrast, reduced-motion, high-contrast, and text-size settings. Text that carries meaning is real HTML, not canvas text.
10. **Ethics of the model.** No identity-like trait drives behavior. Bodies change only from history ("shells are made of weather").

---

## 5. What worked

- **One process skill drove the work.** The `superpowers:brainstorming` skill gave the order: classify (architectural), ask about purpose, propose approaches, present design sections one at a time, write the spec. The user approved each section quickly through multiple-choice questions.
- **Multiple-choice questions with a recommended first option.** The user prefers this over open questions. The user picked the recommended option most of the time, and wrote a custom answer when they wanted changes.
- **Short, plain sections.** Sections of about 200 to 400 words, one at a time, kept approval fast.
- **Concrete numbers.** The user approved a simulation section that gave exact formulas and defaults. Keep that level of detail in the plan.

## 6. What did not work (do not repeat)

- **Names.** Two rounds of names failed. The user disliked cute, childish compounds. The name is now settled. Apply the same taste to any new place, character, or feature name: prefer older words, idioms, and double meanings over baby-talk.
- **Player-drawn creatures.** An early idea had the player draw every creature in one stroke. The user rejected it because characters must stay consistently cute. The spec has no such feature. Do not bring it back in any form.
- **Bao To's article.** The fetch tool rejected `https://www.baothiento.com/writings/creative-autonomy`, and no readable copy turned up. The user's own brainstorm cited `xitter.cf` for a Bao To claim, which is not a reliable source. Treat the creative-autonomy ideas as our interpretation. Ask the user for the article text if a decision depends on it.
- **A missing paste.** The user once said they pasted a second brainstorm, and nothing came through. If the user mentions it again, ask them to paste it.

---

## 7. Next steps

Follow these steps in order. Each step ends with a check.

### Step 1: Orient (read only)

1. Read this file, then the whole spec.
2. Run `git log --oneline` to confirm the repo state.
3. Check which skills you have. The plan below uses these Superpowers skills: `superpowers:writing-plans`, `superpowers:using-git-worktrees`, `superpowers:subagent-driven-development` or `superpowers:executing-plans`, `superpowers:test-driven-development`, `superpowers:verification-before-completion`, `superpowers:requesting-code-review`, and `superpowers:finishing-a-development-branch`. If a skill is missing, follow the same steps by hand and tell the user.

**Check:** you can state the two parts, the ten modules, and the M0 exit check without looking.

### Step 2: Write the implementation plan

1. Invoke `superpowers:writing-plans` with the spec as input.
2. Write a **detailed** plan for M0 and M1, and an **outline** plan for M2 to M5. Detailed tasks need exact file paths, the failing test to write first, the code to make it pass, and the command that verifies it.
3. Settle the spec gaps in section 9 of this file inside the plan. Use the suggested default unless you find a clear reason to change it, and record each choice in `docs/adr/` as a short Architecture Decision Record.
4. Save the plan to `docs/superpowers/plans/2026-11-11-fair-weather-plan.md` (use the date you write it) and commit it.

**Check:** the user reviews the plan and picks an execution method (subagent-driven or inline). Do not write product code before this approval.

### Step 3: Set up the project

1. Use `superpowers:using-git-worktrees` for an isolated branch, for example `m0-spike`.
2. **Look up current stable versions** of Vite, TypeScript, PixiJS, Svelte, inkjs, Vitest, fast-check, Playwright, axe-core, and Zod before you install. Do not trust remembered version numbers. Pin exact versions in `package.json`.
3. Create the directory layout from spec 14.5.
4. Configure strict TypeScript, ESLint, and Prettier.
5. Add an ESLint rule that bans `Math.random`, `Date`, `performance.now`, `Math.exp`, `Math.pow`, `Math.sin`, `Math.cos`, `Math.log`, and `Math.tan` inside `src/sim/**`.
6. Add npm scripts: `dev`, `build`, `test` (Vitest), `test:prop`, `test:golden`, `test:e2e` (Playwright), `lint`, `typecheck`, `validate-content`.
7. Add a CI workflow that runs lint, typecheck, unit tests, and property tests on every push.

**Check:** `npm run lint && npm run typecheck && npm test` passes on an empty test suite.

### Step 4: Execute M0 (technical spike)

M0 proves the three riskiest parts: deterministic simulation in a worker, the line-rig renderer, and Ink connected to the director. Use test-driven development for every task in `sim`, `myth`, `story`, and `persist`. For `render`, write a visual or performance check instead of a unit test where a unit test does not fit.

| # | Task | Files | Test first | Done when |
| --- | --- | --- | --- | --- |
| M0.1 | Seeded PRNG | `src/sim/rng.ts` | Same seed gives the same 1,000 numbers. Two seeds give different streams. Values are in [0, 1). | Tests pass |
| M0.2 | Own sigmoid and math helpers | `src/sim/math.ts` | Sigmoid is monotonic, sigmoid(0) = 0.5, values are in (0, 1), and the result matches a stored table bit for bit | Tests pass |
| M0.3 | Core types | `src/sim/types.ts` | Type-level tests compile (see section 8) | `typecheck` passes |
| M0.4 | Tuning loader with schema | `content/tuning.json`, `src/sim/tuning.ts` | An invalid tuning file is rejected. Defaults equal the values in section 10 of this file. | Tests pass |
| M0.5 | Spatial grid | `src/sim/grid.ts` | Neighbor queries match a brute-force search on 500 random layouts | Tests pass |
| M0.6 | Meeting: bid, gift, payoff, warmth | `src/sim/meeting.ts` | One test per rule in spec 9.3, including fog flips and the winter gift value | Tests pass |
| M0.7 | Daily rules: gossip, imitation, wind, population, light, art, shells | `src/sim/daily/*.ts` | One test per rule in spec 9.4 | Tests pass |
| M0.8 | Step function and state hash | `src/sim/step.ts`, `src/sim/hash.ts` | Property test: the same seed and commands give the same hash over 10,000 random cases. Invariants hold every tick. | `test:prop` passes |
| M0.9 | Trust mode | `src/sim/trust-mode.ts`, `tests/science/trust.test.ts` | Spec T4: forgiving copycat wins at 1% to 9% noise; always-keep wins at 10% or more; always-keep wins with 5 or fewer rounds | Tests pass |
| M0.10 | Worker host and protocol | `src/sim-host/*` | A test sends commands through the worker and gets the same hash as a direct run | Tests pass |
| M0.11 | Line rig format and `svg-to-rig` tool | `tools/svg-to-rig/*`, `content/placeholder/PLACEHOLDER-pim.svg` | The tool samples a path into 128 points with head, body, and base regions, and output is stable across runs | Tests pass |
| M0.12 | Line renderer with boil and shell values | `src/render/line/*` | A Playwright screenshot of one rig at fixed shell values matches an approved image | Visual test passes |
| M0.13 | Performance probe | `tests/perf/rigs.spec.ts` | 30 rigs animate at 60 fps on the dev desktop for 30 seconds | Frame-time log meets target |
| M0.14 | Ink connected to the director | `content/ink/m0.ink`, `src/story/director.ts` | A beat reads a sim value into an Ink variable, plays a knot, and acts on a returned tag (`#beat:arrange_meeting(a,b)`) without changing any sim result | Tests pass |
| M0.15 | Placeholder build guard | `tools/content-validate/*` | A production build fails while any `PLACEHOLDER-*` asset is referenced | Test passes |

**M0 exit check (spec 21.4):** T2 passes, and 30 rigs hold 60 fps on desktop. Then run `superpowers:verification-before-completion`, request a code review, and report the results to the user with the frame-time numbers and the test summary. Ask the user before you start M1.

### Step 5: Later milestones (outline only until M0 passes)

| Milestone | Contents | Exit check |
| --- | --- | --- |
| M1: Vertical slice | Chapters 0 to 3 with real or placeholder art, sound, bets, the Meadow view, keyboard play, saves | First five-person playtest against S3 and S4 |
| M2: Part 1 complete | Chapters 4 to 10, interludes, Cosmos and Soul views, the myth grammar, the *Book of Skies* | T3, T4, and T6 pass |
| M3: Part 2, Stage 1 | Bridge, six heroes, Murmuration Fen, Hearsay Hollow, Halcyon, reputation, postcards, journal, homecoming | T3 for each valley, plus a playtest |
| M4: Launch quality | Sandbox, seed links, exports, accessibility settings, performance on phone, no-WebGL fallback, polish | T7 to T11 pass |
| M5: Stage 2 | Foglight Heights, Toadstool Council, Lily Shallows, rule cards, travelers, remix tree | T3 and T5 pass |

---

## 8. Type sketch (starting point for `src/sim/types.ts`)

These types follow spec section 9. Adjust names as you need, and keep the meaning.

```ts
export type Season = 'spring' | 'summer' | 'lateSummer' | 'autumn' | 'winter' | 'thaw';
export type CreatureState = 'wander' | 'meet' | 'sleep' | 'leave' | 'away';
export type BidReply = 'toward' | 'away' | 'against';
export type GiftMove = 'give' | 'keep';

export interface Dials { opener: number; forgiveness: number; memory: number; ear: number; wanderlust: number } // each 0..1
export interface Shell { tightness: number; bristle: number; color: number; softness: number } // each 0..1

export interface Creature {
  id: string; speciesId: string; name: string;
  x: number; y: number; vx: number; vy: number;      // world units
  berries: number; state: CreatureState;
  dials: Dials; shell: Shell;
  skyWarmth: number;                                  // -1..1
  opinions: Record<string, number>;                   // creatureId -> -1..1
  hungryDusks: number;                                // consecutive dusks with 0 berries
  diary: DiaryEntry[];                                // last 20
  isHero?: boolean; knack?: HeroKnack;
}

export interface Tie { a: string; b: string; warmth: number; slights: number; meetings: number; lastDay: number }

export interface WeatherFields { light: LightLens | null; fog: Float32Array; fogW: number; fogH: number; wind: Gust[] }

export interface World {
  seed: number; tick: number; day: number; season: Season; valleyId: string;
  creatures: Creature[]; ties: Map<string, Tie>;      // key: sorted "a|b"
  fields: WeatherFields; bushes: Bush[]; structures: Structure[];
  rumors: Rumor[]; boosts: BehaviorBoost[];
  rulePack?: string;
}

export type Command =
  | { t: 'shine'; x: number; y: number }
  | { t: 'paintFog'; x: number; y: number; r: number; amount: number }
  | { t: 'blow'; x: number; y: number; dx: number; dy: number }
  | { t: 'place'; kind: 'bench' | 'bridge' | 'lantern' | 'bush'; x: number; y: number }
  | { t: 'thread'; a: string; b: string; on: boolean }
  | { t: 'whisper'; target: string; about: string; sign: 1 | -1 }
  | { t: 'respond'; to: string; reply: BidReply }
  | { t: 'arrangeMeeting'; a: string; b: string }       // story only
  | { t: 'setSeason'; season: Season }                  // story only
  | { t: 'heroGift'; to: string; move: GiftMove }
  | { t: 'localVerb'; verb: string; args: Record<string, number | string> };

export type SimEvent =
  | { t: 'bid'; from: string; to: string; reply: BidReply; misread: boolean }
  | { t: 'gift'; from: string; to: string; move: GiftMove; seenAs: GiftMove }
  | { t: 'opinion'; holder: string; about: string; value: number }
  | { t: 'imitate'; who: string; from: string; dial: keyof Dials }
  | { t: 'arrive' | 'leave' | 'return'; who: string }
  | { t: 'art'; who: string; kind: 'stack' | 'spiral' | 'chime' }
  | { t: 'rule'; pack: string; name: string; data: Record<string, number | string> };

export interface Rng { next(): number; int(n: number): number; pick<T>(xs: readonly T[]): T }

export interface RulePack {
  id: string;
  setup(world: World, rng: Rng): void;
  step(world: World, rng: Rng): SimEvent[];
  onVerb(world: World, verb: { verb: string; args: Record<string, number | string> }, rng: Rng): SimEvent[];
  metrics(world: World): Record<string, number>;
}
```

**Worker protocol (suggested):** main to worker: `init {seed, tuning, scenario}`, `commands {tick, list}`, `speed {multiplier}`, `snapshot?`. Worker to main: `snapshot {tick, world-lite}` every step, `events {tick, list}`, `hash {tick, value}` on request, `error {message, lastGoodTick}`. A "world-lite" snapshot carries only what `render`, `audio`, and `ui` need.

---

## 9. Spec gaps to settle in the plan (with suggested defaults)

The spec leaves these points open. Settle each one in an ADR.

| Gap | Suggested default |
| --- | --- |
| Definition of `hunger` in the bid formula | `hunger = 1 − min(berries, 3) / 3` |
| Who bids first in a meeting | The creature with the higher Opener. On a tie, the PRNG picks. |
| How an opinion is stored | A signed number from −1 to 1. "Holds an opinion" means the absolute value is at least 0.3. |
| Sky warmth changes | Glow back to a bid +0.1, stay still −0.03, rumble −0.15, an over-poke −0.05, light on the creature +0.01 per second up to +0.1 per day |
| Hearsay Hollow drama score | Against bid 3, keep after a gift 2, away 1, toward 0, gift 0. The drama sky moves at 120 world units per second toward the highest recent score. |
| Murmuration Fen reflection | Perceived share = flying neighbors weighted by their own neighbor count, divided by the total weight |
| Starling thresholds | Uniform from 0.2 to 0.8, from the PRNG, with Tove fixed at 0.5 |
| Foglight Heights map | A hand-authored height grid in `content/valleys/foglight/height.json`, with one small peak near the start and one high meadow beyond a fog valley |
| Toadstool preferences | Two clusters on the map, built so that plurality splits the vote between the two close spots |
| Kith fast-forward during Part 2 | Run the Kith sim at full rules for 20 in-game days, with postcard nudges applied on arrival days |
| Rumor content in Part 1 | A rumor is `{about, sign, strength}`. A whisper creates one with strength 0.6. |
| Bet measurement | Each bet config names a metric (for example `maxBerriesAfterDays: 7`) and the sim computes it at the reveal |
| Fitness tie in imitation | No copy when fitness is equal |
| Wander movement | Steering along the walk mesh toward a goal picked by Wanderlust: low values pick known friends, high values pick unvisited spots |

---

## 10. Tuning defaults (`content/tuning.json`)

All values come from spec section 9 and chapter rules. Load them through the schema in M0.4.

| Key | Default |
| --- | --- |
| `sim.stepsPerSecond` | 10 |
| `story.dayLengthSeconds` | 40 |
| `meet.radius` | 24 |
| `meet.benchRepeatMultiplier` | 2 |
| `bid.gain` | 4 |
| `bid.openerWeight` | 0.5 |
| `bid.hungerWeight` | 0.3 |
| `bid.againstBelowWarmth` | −0.4 |
| `fog.bidFlipFactor` | 0.5 |
| `fog.giftMisreadFactor` | 0.5 |
| `gift.cost` | 1 |
| `gift.value` | 3 |
| `gift.valueWinter` | 2 |
| `gift.maxSlightsPerForgiveness` | 3 (allowed slights = round(3 × Forgiveness)) |
| `memory.halfLifeMinDays` / `memory.halfLifeSpanDays` | 1 / 29 (half-life = 1 + 29 × Memory) |
| `warmth.toward` / `away` / `against` | +0.10 / −0.05 / −0.15 |
| `warmth.giftReceived` / `keepAfterGift` | +0.15 / −0.20 |
| `warmth.dailyDrift` | 0.02 toward 0 |
| `friend.threshold` | 0.3 |
| `gossip.simpleEarBelow` / `gossip.simpleChance` | 0.1 / 0.3 |
| `imitation.everyDays` / `radius` / `rate` / `friendWeight` | 3 / 200 / 0.3 / 2 |
| `wind.dialShiftChance` / `wind.spread` | 0.2 / 0.15 |
| `bush.growth` / `bush.base` | 0.2 / 0.5 |
| `population.newcomerSparePerCreature` | 3 |
| `population.leaveHungryDusks` / `leaveMinFriends` | 4 / 2 |
| `population.returnChanceWeekly` / `returnMinAvgWarmth` | 0.25 / 0.2 |
| `light.boost` / `light.radius` / `light.cap` / `light.days` | 0.15 / 300 / 0.3 / 1 |
| `art.minWarmth` / `art.minBerries` / `art.days` | 0.4 / 1.5 / 2 |
| `shell.betrayalTightness` / `hungerBristle` / `giftSoftness` | 0.1 / 0.05 / 0.05 |
| `cap.story` / `cap.sandbox` | 30 / 60 |
| `overPoke.count` / `overPoke.windowSeconds` / `overPoke.skyWarmth` | 8 / 30 / −0.05 |
| `mushroom.drops` / `mushroom.doubleAtMost` / `mushroom.witherAtLeast` / `mushroom.witherDays` | 10 / 6 / 9 / 3 |
| `postcard.nudge` | 0.1 |
| `wisp.minWarmth` / `wisp.minKithWarmth` | 0.6 / 0.2 |
| `halcyon.giftWarmthMultiplier` / `halcyon.keepsakeWarmth` | 0.2 / 0.6 |
| `story.honestyRetries` | 3 |
| `bet.revealSpeed` | 8 |
| Hero knacks | See spec 5.5 for each exact rule |

---

## 11. How to work with this user

The user is the product owner. They read every message, so follow their stated communication preferences:

- **Plain, controlled English** in the style of ASD-STE100 Simplified Technical English. Use active voice and short sentences: at most 20 words for an instruction and 25 for a description. Put one instruction in each sentence. Use simple tenses and one word for one meaning.
- **Avoid these patterns:** em dashes, "not X but Y" contrasts, rule-of-three lists in prose, throat-clearing openers, summary or landing sentences, filler intensifiers (really, truly, actually, genuinely), corporate verbs (leverage, underscore), hedging, and performed enthusiasm.
- **Act when you have enough information.** Do not re-explain settled facts or reopen decisions.
- **When a choice is needed,** give a recommendation and ask with a short multiple-choice question. Put the recommended option first and mark it.
- **Show evidence before claims.** Report test output and numbers. Never say a task is done without running its check.
- **Commits.** Commit only with the user's approval of the plan, on a branch. Do not push or open a pull request unless the user asks.

---

## 12. Open questions for the user

Ask these when they block a decision. Do not ask them all at once.

1. Should the code and art carry an open license?
2. Which device is the reference phone for the 30 fps target?
3. Who is the human designer for the characters, and when will final art arrive? (Until then, use placeholders per constraint 6.)
4. Who writes the Ink script and the margin notes, and who reviews the science notes?
5. Can the user supply the text of Bao To's article?

---

## 13. File map

| Path | What it is |
| --- | --- |
| `HANDOFF.md` | This file |
| `docs/superpowers/specs/2026-11-11-fair-weather-design.md` | The full spec and PRD |
| `docs/superpowers/plans/` | Where your implementation plan goes (create it) |
| `docs/adr/` | Where your decisions on the spec gaps go (create it) |

## 14. Spec sections to read for each kind of work

| Work | Spec sections |
| --- | --- |
| Simulation | 9, 18 (T1 to T5), 19 |
| Story director and Ink | 6, 7, 10 |
| Myth | 6.5, 10.6, 18 (T6) |
| Rendering and art tools | 5.1, 5.2, 11 |
| Sound | 11.5 |
| Interface and input | 8, 12, 17 |
| Saves, links, privacy | 15, 16 |
| Scope and order | 21 |
