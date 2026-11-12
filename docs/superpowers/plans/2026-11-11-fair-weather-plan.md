# Fair Weather Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build *Fair Weather*, a client-only browser story game, starting with a technical spike (M0) that proves the deterministic simulation in a worker, the line-rig renderer, and Ink connected to the director.

**Architecture:** Ten modules with hard boundaries (spec 14.2). A pure, deterministic `sim` runs inside a Web Worker through `sim-host`. The `story` director is the only module that changes the chapter or the unlocked verbs, and it talks to the sim only through commands. `render` (PixiJS) and `ui` (Svelte, from M1) read snapshots only.

**Tech Stack:** TypeScript 6 (strict), Vite 8, PixiJS 8, inkjs 2, Zod 4, Vitest 5, fast-check 4, Playwright 1.64, ESLint 10 with typescript-eslint, Prettier 3. Svelte 5 and axe-core arrive in M1. Exact pins are in ADR 0008.

**Spec:** `docs/superpowers/specs/2026-11-11-fair-weather-design.md`. Read it with this plan. The decisions on spec gaps are in `docs/adr/0001` to `docs/adr/0012`. A task that cites "ADR n" uses the exact rule in that file.

## Global Constraints

- `src/sim/**` uses only `+ − × ÷`, `Math.sqrt`, the `Math` members in ADR 0001, and one seeded PRNG. No clock, no `Math.random`, no transcendental functions. ESLint enforces this.
- The same seed, tuning, scenario, and command log give the same 16-hex state hash in every browser engine.
- Module dependencies follow spec 14.2 exactly. ESLint `no-restricted-imports` enforces them. Type-only imports of `sim/types.ts` and `sim-host/protocol.ts` are allowed everywhere.
- `render` and `ui` never send commands. Only `story` changes the chapter, the valley, or the unlocked verbs. `content/` holds data only: JSON, SVG, Ink, and no `.ts` files.
- A story beat may arrange who meets whom, and when. It never overwrites a sim result (spec 10.2).
- No verb, tool, or sandbox feature lets the player draw a creature or hero.
- No AI-generated art, text, music, or myths in the shipped game. Placeholders follow ADR 0010, and the production build fails while any placeholder is referenced.
- No accounts, no cookies, no identifiers. Analytics stay off unless the player opts in, and then send counts only.
- No streaks, no guilt for time away, no leaderboards. The sim does not run while the tab is hidden.
- Full keyboard play. WCAG 2.2 AA text contrast. Reduced-motion, high-contrast, and text-size settings. Text with meaning is HTML, never canvas text.
- No identity-like trait drives behavior. Shell values change only from history.
- Every number in spec 9 is a default in `content/tuning.json` and is read through the schema.
- Files import each other with explicit `.ts` extensions, so Node runs `tools/` scripts directly with type stripping.
- Commits go on branch `claude/project-thread-fjth58`. Push or open a pull request only when the user asks.

## Review Focus

1. **Cross-engine determinism.** A player who shares a seed link expects the same valley in Firefox and Safari as in Chrome. Owner: M0.10 runs the golden scenario in the real worker in each Playwright browser project and compares the hash with the Node golden value.
2. **Bad commands from outside.** A seed link or an old save can carry an unknown creature id, an `away` creature, or a non-finite number. The sim must ignore that command, emit nothing, and not throw. Owner: M0.8 property test feeds such commands.
3. **Empty and tiny worlds.** The sandbox and late winter can reach 0 or 1 active creature. No rule may divide by zero or emit NaN. Owner: M0.7 tests run every daily rule on worlds with 0 and 1 creature, and M0.8 invariants reject non-finite numbers.
4. **Positions on edges.** A creature at the scene edge, or on a grid cell boundary, must still find its neighbors, and nothing may leave the scene. Owner: M0.5 layouts include points on cell boundaries and scene corners. M0.8 invariants check bounds.
5. **Worker crash mid-chapter.** A crash must not lose the player's year. The host restarts from the last checkpoint and replays later commands to the same hash. Owner: M0.10.

---

## File structure (M0)

| Path | Responsibility |
| --- | --- |
| `package.json`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.nvmrc`, `.github/workflows/ci.yml` | Toolchain |
| `index.html`, `src/main.ts` | Production entry. M0 shows one line of text and no placeholder. |
| `src/sim/rng.ts` | SplitMix32 PRNG |
| `src/sim/math.ts` | `sigmoid`, `exp2neg`, `clamp`, distance helpers |
| `src/sim/types.ts` | All sim records, commands, and events |
| `src/sim/tuning.ts` | Zod schema and `parseTuning` |
| `src/sim/grid.ts` | Uniform spatial grid |
| `src/sim/world.ts` | `createWorld`, tie access, friend count, average warmth |
| `src/sim/move.ts` | Steering, goal choice, foraging (ADR 0005) |
| `src/sim/meeting.ts` | One meeting (ADR 0003) |
| `src/sim/light.ts` | Lens, behavior boosts, sky warmth from light |
| `src/sim/commands.ts` | Applies one player or story command |
| `src/sim/daily/*.ts` | One file per daily rule, plus `index.ts` with `runDusk` |
| `src/sim/step.ts` | One tick |
| `src/sim/hash.ts` | State hash |
| `src/sim/invariants.ts` | Limit checks |
| `src/sim/trust-mode.ts` | Case-style tournaments (test only) |
| `src/sim-host/protocol.ts` | Message types, `WorldLite`, `SimPort` |
| `src/sim-host/lite.ts` | `toLite(world)` |
| `src/sim-host/worker-core.ts` | Message handling, pacing, checkpoints |
| `src/sim-host/worker.ts` | Connects the core to `self` |
| `src/sim-host/host.ts` | Main-thread client with restart and replay |
| `src/story/beat-tags.ts` | Parses `#beat:` tags |
| `src/story/ink.ts` | Thin inkjs wrapper |
| `src/story/director.ts` | M0 director: variables in, knots, tags out to commands |
| `src/render/line/rig.ts` | Rig type and Zod schema |
| `src/render/line/deform.ts` | Boil and shell deformation (pure) |
| `src/render/line/strip.ts` | Triangle strip geometry (pure) |
| `src/render/line/line-view.ts` | PixiJS mesh glue |
| `dev/rig.html`, `dev/perf.html`, `dev/worker.html` and their `.ts` files | Development-only test pages, outside the production build |
| `tools/svg-to-rig/svg-to-rig.ts`, `tools/svg-to-rig/cli.ts` | SVG path to rig JSON |
| `tools/content-validate/placeholder-guard.ts`, `tools/content-validate/validate.ts` | Placeholder guard and content checks |
| `content/tuning.json`, `content/scenarios/m0.json`, `content/ink/m0.ink`, `content/placeholder/PLACEHOLDER-pim.svg`, `content/rigs/PLACEHOLDER-pim.rig.json` | Data |
| `tests/unit/**`, `tests/property/**`, `tests/science/**`, `tests/e2e/**`, `tests/visual/**`, `tests/perf/**`, `tests/golden/**` | Tests (spec 14.5 plus `perf/`) |

---

## Milestone M0: Technical spike

Exit check (spec 21.4): T2 passes, and 30 rigs hold 60 fps on the user's desktop. Then run superpowers:verification-before-completion and superpowers:requesting-code-review, and report the frame-time numbers and the test summary. Ask the user before M1.

### Task M0.0: Project setup

**Files:**
- Create: the toolchain files in the table above, `index.html`, `src/main.ts`, the empty directories from spec 14.5 (each with a `.gitkeep` until it holds a file).

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `preview`, `test`, `test:prop`, `test:golden`, `test:e2e`, `test:perf`, `lint`, `typecheck`, `format`, `validate-content`, `rig`.

- [ ] **Step 1: Check the versions again.** Run `npm view <pkg> time --json` for each package in ADR 0008. Pick the newest stable release at least 7 days old. If a pick differs from ADR 0008, update the ADR table in the same commit.
- [ ] **Step 2: Create `package.json`** with `"type": "module"`, `"private": true`, `"engines": { "node": ">=22.18" }`, exact versions (no `^`), and these scripts:

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run --project unit --project golden",
  "test:prop": "vitest run --project property",
  "test:golden": "vitest run --project golden",
  "test:e2e": "playwright test --project=e2e --project=visual",
  "test:perf": "playwright test --project=perf",
  "lint": "eslint . && prettier --check .",
  "format": "prettier --write .",
  "typecheck": "tsc --noEmit",
  "validate-content": "node tools/content-validate/validate.ts",
  "rig": "node tools/svg-to-rig/cli.ts"
}
```

- [ ] **Step 3: Create `tsconfig.json`** with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit`, `module: "preserve"`, `moduleResolution: "bundler"`, `target: "ES2023"`, `lib: ["ES2023", "DOM", "DOM.Iterable", "WebWorker"]`, `types: ["node", "vite/client"]`. Include `src`, `tests`, `tools`, `dev`, and the root config files.
- [ ] **Step 4: Create `eslint.config.js`** (flat config) with `@eslint/js` recommended, `typescript-eslint` `strictTypeChecked`, and these project rules:

```js
// src/sim/** only
{
  files: ['src/sim/**/*.ts'],
  rules: {
    'no-restricted-globals': ['error', 'Date', 'performance', 'crypto', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'self', 'window'],
    'no-restricted-syntax': ['error', {
      selector: "MemberExpression[object.name='Math'][property.name!=/^(sqrt|floor|ceil|round|trunc|abs|min|max|sign|imul)$/]",
      message: 'src/sim may use only exact Math members (ADR 0001).',
    }],
  },
}
```

Add one `@typescript-eslint/no-restricted-imports` block per module, with `allowTypeImports: true`, that encodes spec 14.2. For example `src/sim/**` may not import from `src/**` outside `src/sim`, and `src/render/**` may not import `sim-host`, `story`, `ui`, `input`, `audio`, or `persist` as values. Add a block that bans `.ts` files in `content/`.

- [ ] **Step 5: Create `vitest.config.ts`** with three projects: `unit` (`tests/unit/**/*.test.ts`, `tests/science/**/*.test.ts`), `property` (`tests/property/**/*.test.ts`, timeout 600 s), and `golden` (`tests/golden/**/*.test.ts`). Environment `node`.
- [ ] **Step 6: Create `playwright.config.ts`** with `webServer: { command: 'npx vite --port 5179 --strictPort', port: 5179 }`. Projects: `e2e` (`tests/e2e`, Chromium, Firefox, WebKit), `visual` (`tests/visual`, Chromium only), `perf` (`tests/perf`, Chromium, headed when `PERF_HEADED=1`). Read `process.env.PW_CHROMIUM_PATH` into `launchOptions.executablePath` when set (ADR 0008). Use `--trace off` by default.
- [ ] **Step 7: Create `vite.config.ts`.** The production build input is `index.html` only. The `dev/` pages are served by the dev server and never built. Add the placeholder guard plugin from M0.15 here when that task lands.
- [ ] **Step 8: Create `.github/workflows/ci.yml`.** On every push: Node 22, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:prop`, `npm run validate-content`, `npm run build`.
- [ ] **Step 9: Install and verify.**

Run: `npm install && npm run lint && npm run typecheck && npm test -- --passWithNoTests`
Expected: all three pass with no tests found.

- [ ] **Step 10: Prove the sim lint rule works.** Write `src/sim/_probe.ts` with `export const x = Math.random();`. Run `npx eslint src/sim/_probe.ts`. Expected: one error, "src/sim may use only exact Math members". Delete the file.
- [ ] **Step 11: Commit.** `git commit -m "chore: set up toolchain, lint rules, and CI"`

### Task M0.1: Seeded PRNG

**Files:** Create `src/sim/rng.ts`. Test `tests/unit/sim/rng.test.ts`.

**Interfaces:**
- Produces: `interface Rng { next(): number; int(n: number): number; pick<T>(xs: readonly T[]): T; state(): number }` (in `types.ts` from M0.3; define it here first and move it) and `createRng(state: number): Rng`. `state()` returns the current `uint32`, so `createRng(r.state())` continues the same stream.

- [ ] **Step 1: Write the failing tests.**

```ts
test('same seed gives the same 1,000 numbers', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
});
test('two seeds give different streams', () => {
  const a = createRng(1), b = createRng(2);
  const xs = Array.from({ length: 100 }, () => a.next());
  const ys = Array.from({ length: 100 }, () => b.next());
  expect(xs).not.toEqual(ys);
});
test('values are in [0, 1)', () => { /* 100,000 draws, each >= 0 and < 1 */ });
test('state() resumes the stream', () => { /* draw 10, copy state, next 10 match */ });
test('int(n) is in [0, n) and pick() throws on an empty list', () => {});
test('first five values for seed 0 match the stored vector', () => {
  expect(Array.from({ length: 5 }, createRng(0).next)).toMatchSnapshot();
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/sim/rng.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `createRng`** as SplitMix32 (ADR 0001): add `0x9e3779b9`, then mix with `Math.imul(z ^ (z >>> 16), 0x85ebca6b)`, `Math.imul(z ^ (z >>> 13), 0xc2b2ae35)`, `z ^ (z >>> 16)`. Return `(z >>> 0) / 4294967296`.
- [ ] **Step 4: Run** the test. Expected: PASS. Check the snapshot file into git.
- [ ] **Step 5: Commit.** `feat(sim): add SplitMix32 PRNG`

### Task M0.2: Math helpers

**Files:** Create `src/sim/math.ts`. Test `tests/unit/sim/math.test.ts`.

**Interfaces:**
- Produces: `sigmoid(x: number): number`, `exp2neg(a: number): number`, `clamp(x: number, lo: number, hi: number): number`, `dist2(ax, ay, bx, by): number`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('sigmoid(0) is 0.5', () => expect(sigmoid(0)).toBe(0.5));
test('sigmoid is strictly increasing on [-20, 20] at step 0.01', () => {});
test('sigmoid stays in (0, 1) on [-1e6, 1e6]', () => {});
test('sigmoid is symmetric: sigmoid(-x) = 1 - sigmoid(x) within 1e-15', () => {});
test('sigmoid stays within 0.04 of the logistic curve', () => {
  for (let x = -10; x <= 10; x += 0.05) expect(Math.abs(sigmoid(x) - 1 / (1 + Math.exp(-x)))).toBeLessThan(0.04);
});
test('sigmoid matches the stored table bit for bit', () => {
  const bits = []; // x from -8 to 8 at step 0.25; each value as 16 hex chars of its float64 bytes
  expect(bits).toMatchSnapshot();
});
test('exp2neg matches 2^-a within 1e-7 relative on [0, 60]', () => {});
test('exp2neg(0) is 1, exp2neg(1) is 0.5, exp2neg(2000) is 0', () => {});
```

The test file may call `Math.exp` and `Math.pow`. The lint rule covers `src/sim` only.

- [ ] **Step 2: Run** and see FAIL.
- [ ] **Step 3: Implement** per ADR 0001. `exp2neg` returns 0 for `a > 1074`. The fractional part uses a degree-6 polynomial in Horner form. Fit its coefficients once in the test file's comment (least squares on [0, 1)), and write them as literals in `math.ts`.
- [ ] **Step 4: Run** and see PASS.
- [ ] **Step 5: Commit.** `feat(sim): add exact sigmoid and decay helpers`

### Task M0.3: Core types

**Files:** Create `src/sim/types.ts`. Test `tests/unit/sim/types.test-d.ts` (checked by `tsc`, not run).

**Interfaces:**
- Produces: the types below. Later tasks use these names exactly.

```ts
export type Season = 'spring' | 'summer' | 'lateSummer' | 'autumn' | 'winter' | 'thaw';
export type CreatureState = 'wander' | 'meet' | 'sleep' | 'leave' | 'away';
export type BidReply = 'toward' | 'away' | 'against';
export type GiftMove = 'give' | 'keep';
export type Behavior = 'toward' | 'against' | 'give' | 'keep';
export type DialKey = 'opener' | 'forgiveness' | 'memory' | 'ear' | 'wanderlust';
export type Dials = Record<DialKey, number>;                     // each 0..1
export interface Shell { tightness: number; bristle: number; color: number; softness: number } // each 0..1
export interface DiaryEntry { tick: number; kind: SimEvent['t']; with: string; value: number }
export interface Creature {
  id: string; speciesId: string; name: string;
  x: number; y: number; vx: number; vy: number; goalX: number; goalY: number;
  berries: number; state: CreatureState; stateUntilTick: number; forageReadyTick: number;
  dials: Dials; shell: Shell; restShell: Shell;
  skyWarmth: number; skyLightToday: number;                       // -1..1, 0..sky.lightDailyCap
  opinions: Record<string, number>;                               // -1..1 (ADR 0002)
  hungryDusks: number; visits: number[];                          // 32 cells, ADR 0005
  benchMemory: { benchId: string; day: number } | null;
  diary: DiaryEntry[];                                            // last 20
}
export interface Side { warmth: number; slights: number }
export interface Tie { a: string; b: string; ab: Side; ba: Side; meetings: number; lastDay: number }
export interface Bush { id: string; x: number; y: number; berries: number }
export interface Structure { id: string; kind: 'bench'; x: number; y: number }
export interface Rumor { about: string; sign: 1 | -1; strength: number; origin: string; tick: number }
export interface BehaviorBoost { behavior: Behavior; x: number; y: number; untilDay: number }
export interface Gust { x: number; y: number; dx: number; dy: number; untilTick: number }
export interface WeatherFields { light: { x: number; y: number } | null; fog: Float32Array; fogW: number; fogH: number; gusts: Gust[] }
export interface World {
  seed: number; rngState: number; tick: number; day: number; ticksPerDay: number;
  season: Season; valleyId: string; nextId: number; artStreak: number;
  creatures: Creature[]; ties: Map<string, Tie>;
  fields: WeatherFields; bushes: Bush[]; structures: Structure[];
  rumors: Rumor[]; boosts: BehaviorBoost[];
}
export type Command =
  | { t: 'shine'; x: number; y: number }
  | { t: 'paintFog'; x: number; y: number; r: number; amount: number }
  | { t: 'blow'; x: number; y: number; dx: number; dy: number }
  | { t: 'place'; kind: 'bench' | 'bush'; x: number; y: number }
  | { t: 'thread'; a: string; b: string; on: boolean }
  | { t: 'whisper'; target: string; about: string; sign: 1 | -1 }
  | { t: 'respond'; to: string; reply: BidReply }
  | { t: 'arrangeMeeting'; a: string; b: string }
  | { t: 'setSeason'; season: Season };
export type SimEvent =
  | { t: 'bid'; from: string; to: string; reply: BidReply; seenAs: BidReply }
  | { t: 'gift'; from: string; to: string; move: GiftMove; seenAs: GiftMove }
  | { t: 'opinion'; holder: string; about: string; value: number }
  | { t: 'imitate'; who: string; from: string; dial: DialKey }
  | { t: 'arrive' | 'leave' | 'return'; who: string }
  | { t: 'art'; who: string; kind: 'stack' | 'spiral' | 'chime' };
export interface Scenario {
  valleyId: string; season: Season; ticksPerDay?: number;
  creatures: { id: string; speciesId: string; name: string; x: number; y: number; berries: number; dials: Dials; shell?: Shell }[];
  bushes: { id: string; x: number; y: number; berries: number }[];
  structures: Structure[];
}
```

Commands and events for Part 2 (`heroGift`, `localVerb`, `rule`) and for later chapters arrive in the milestone that needs them. `RulePack` arrives in M3.

- [ ] **Step 1: Write the type test** with `// @ts-expect-error` lines: a `shine` command without `y`; a `place` command with `kind: 'lantern'`; a `Dials` object missing `ear`; an `arrive` event with a `to` field. Also one valid value of each `Command` member.
- [ ] **Step 2: Run** `npm run typecheck`. Expected: FAIL, module not found.
- [ ] **Step 3: Write `types.ts`** as above.
- [ ] **Step 4: Run** `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(sim): add core types`

### Task M0.4: Tuning loader

**Files:** Create `content/tuning.json`, `src/sim/tuning.ts`. Test `tests/unit/sim/tuning.test.ts`.

**Interfaces:**
- Produces: `TuningSchema` (Zod, `.strict()` on every object), `type Tuning = z.infer<typeof TuningSchema>`, `parseTuning(json: unknown): Tuning` (throws `ZodError`), `ticksPerDay(t: Tuning): number`. Sim files import `Tuning` as a type only, so Zod stays out of the step code path.

The keys are the handoff section 10 table plus the keys that ADRs 0002 to 0005 add:

| Key | Default |
| --- | --- |
| `scene.width` / `height` / `gateX` / `gateY` | 1600 / 900 / 40 / 450 |
| `move.speed` / `accel` / `arriveRadius` | 40 / 80 / 8 |
| `meet.durationTicks` | 20 |
| `goal.benchChance` | 0.25 |
| `forage.carryMax` / `cooldownTicks` | 5 / 50 |
| `eat.perDusk` | 1 |
| `bush.limit` | 10 |
| `opinion.holdAt` / `weight` | 0.3 / 0.5 |
| `rumor.whisperStrength` | 0.6 |
| `thread.warmth` | 0.4 |
| `light.lensRadius` | 120 |
| `sky.toward` / `still` / `rumble` / `lightPerSecond` / `lightDailyCap` | 0.1 / −0.03 / −0.15 / 0.01 / 0.1 |
| `shell.colorRate` / `colorFullAt` / `relaxRate` | 0.2 / 5 / 0.05 |
| `wind.width` / `push` | 80 / 60 |
| `fog.cellSize` | 40 |
| `population.returnEveryDays` | 7 |

Use the nested JSON shape `{ "sim": { "stepsPerSecond": 10 }, "meet": { "radius": 24, ... } }`. Probabilities and dial-like values use `z.number().min(0).max(1)`. Counts use `z.number().int().positive()`. Signed deltas use `z.number().min(-1).max(1)`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('the shipped file parses', () => expect(() => parseTuning(tuningJson)).not.toThrow());
test('defaults equal the handoff and ADR values', () => {
  const t = parseTuning(tuningJson);
  expect(t.bid).toEqual({ gain: 4, openerWeight: 0.5, hungerWeight: 0.3, againstBelowWarmth: -0.4 });
  expect(t.gift).toEqual({ cost: 1, value: 3, valueWinter: 2, maxSlightsPerForgiveness: 3 });
  expect(t.memory).toEqual({ halfLifeMinDays: 1, halfLifeSpanDays: 29 });
  // one expect per group, covering every key in both tables
});
test('ticksPerDay is 400 for the defaults', () => expect(ticksPerDay(parseTuning(tuningJson))).toBe(400));
test('a missing key is rejected', () => {});
test('an unknown key is rejected', () => {});
test('a probability above 1 is rejected', () => {});
test('a string in place of a number is rejected', () => {});
```

- [ ] **Step 2: Run** and see FAIL.
- [ ] **Step 3: Write `content/tuning.json` and `src/sim/tuning.ts`.**
- [ ] **Step 4: Run** and see PASS.
- [ ] **Step 5: Commit.** `feat(sim): add tuning schema and defaults`

### Task M0.5: Spatial grid

**Files:** Create `src/sim/grid.ts`. Test `tests/unit/sim/grid.test.ts`.

**Interfaces:**
- Produces: `createGrid(width: number, height: number, cellSize: number): Grid` with `rebuild(xs: ArrayLike<number>, ys: ArrayLike<number>, count: number): void` and `query(x: number, y: number, r: number, out: number[]): number[]`. `query` clears `out`, then pushes indices with distance `<= r`, in ascending index order. The grid reuses its arrays between rebuilds.

- [ ] **Step 1: Write the failing tests.**

```ts
test('query matches brute force on 500 random layouts', () => {
  fc.assert(fc.property(layoutArb /* 0..60 points; some on cell boundaries and corners */, fc.float(...), fc.float(...), fc.float({ min: 0, max: 300 }), (pts, qx, qy, r) => {
    expect(grid.query(qx, qy, r, [])).toEqual(bruteForce(pts, qx, qy, r));
  }), { numRuns: 500 });
});
test('a point exactly at distance r is included', () => {});
test('points at (0,0) and (width,height) are found', () => {});
test('an empty grid returns no indices', () => {});
```

- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement** with a counting sort into `cellStart`/`cellItems` typed arrays (no per-rebuild allocation). Clamp cell coordinates to the grid. **Step 4: Run** and see PASS.
- [ ] **Step 5: Commit.** `feat(sim): add uniform spatial grid`

### Task M0.5b: World, movement, and foraging

The handoff table has no row for this task. M0.6 and M0.8 need it.

**Files:** Create `src/sim/world.ts`, `src/sim/move.ts`, `content/scenarios/m0.json` (the 6 named cast members from spec 5.3 plus 24 villagers named `Villager 1` to `Villager 24`, 8 bushes, 0 benches). Test `tests/unit/sim/world.test.ts`, `tests/unit/sim/move.test.ts`.

**Interfaces:**
- Produces from `world.ts`: `createWorld(seed: number, tuning: Tuning, scenario: Scenario): World`; `tieKey(a: string, b: string): string`; `getTie(world: World, a: string, b: string): Tie | undefined`; `ensureTie(world: World, a: Creature, b: Creature, tuning: Tuning): Tie` (first warmth from opinion, ADR 0002); `side(tie: Tie, from: string): Side`; `friendCount(world: World, c: Creature, tuning: Tuning): number`; `averageWarmth(world: World): number` (ADR 0004 item 6); `activeCreatures(world: World): Creature[]`; `byId(world: World, id: string): Creature | undefined`.
- Produces from `move.ts`: `moveCreatures(world: World, tuning: Tuning, rng: Rng): void` (steer, arrive, pick goals, forage, count visits).

- [ ] **Step 1: Write the failing tests.**
  - `createWorld` copies the scenario, sets `rngState` from the seed, sets `ticksPerDay` from the scenario or from tuning, and fills the fog grid with zeros at `ceil(1600 / 40) × ceil(900 / 40)` = 40 × 23 cells.
  - `tieKey('pim', 'krit')` equals `tieKey('krit', 'pim')` and equals `'krit|pim'`.
  - `ensureTie` sets `ab.warmth` to `a.opinions[b] × 0.5` on creation.
  - `averageWarmth` is 0 for a world with no ties, and ignores sides that touch an `away` creature.
  - Movement: a creature never moves faster than `move.speed / stepsPerSecond` per tick; it stays inside the scene; on arrival it picks a new goal; a creature with 0 berries picks a bush with berries; a creature within 24 units of a bush with berries takes 1 berry, then waits 50 ticks; a creature with `wanderlust` 0 and one friend picks that friend's position.
- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement** per ADR 0005. **Step 4: Run** and see PASS.
- [ ] **Step 5: Commit.** `feat(sim): add world setup, movement, and foraging`

### Task M0.6: Meeting

**Files:** Create `src/sim/meeting.ts`, `src/sim/light.ts`. Test `tests/unit/sim/meeting.test.ts`, `tests/unit/sim/light.test.ts`.

**Interfaces:**
- Consumes: `world.ts`, `math.ts`, `Rng`.
- Produces: `hunger(berries: number): number`; `replyChance(w: number, opener: number, hungerValue: number, boost: number, t: Tuning): number`; `findMeetings(world: World, grid: Grid, tuning: Tuning): [Creature, Creature][]` (sorted by tie key); `resolveMeeting(world: World, a: Creature, b: Creature, tuning: Tuning, rng: Rng): SimEvent[]`.
- Produces from `light.ts`: `fogAt(world: World, x: number, y: number, t: Tuning): number`; `boostAt(world: World, behavior: Behavior, x: number, y: number, t: Tuning): number` (capped at `light.cap`); `recordLitMeeting(world: World, x: number, y: number, behaviors: Behavior[], t: Tuning): void`; `lightSkyWarmth(world: World, t: Tuning): void` (per tick, ADR 0004 item 12).

Tests use a scripted `Rng` (`scriptedRng([0.1, 0.9, ...])`) from `tests/unit/sim/helpers.ts`, so each rule has exact inputs.

- [ ] **Step 1: Write the failing tests**, one per rule in spec 9.3 and ADR 0003:

```ts
test('hunger', () => { expect(hunger(0)).toBe(1); expect(hunger(1.5)).toBe(0.5); expect(hunger(3)).toBe(0); expect(hunger(7)).toBe(0); });
test('reply chance uses the spec formula', () => expect(replyChance(0, 0.5, 0, 0, t)).toBe(sigmoid(1)));
test('the higher Opener bids; a tie uses the PRNG', () => {});
test('a non-toward reply is against only below warmth -0.4', () => {});
test('fog 1 turns a toward reply into a seen away when the draw is below 0.5', () => {});
test('fog 1 leaves a toward reply when the draw is 0.5 or more', () => {});
test('a first meeting gives with chance equal to Opener', () => {});
test('later, a creature with Forgiveness 0.5 gives at 2 remembered slights and keeps at 3', () => {});
test('Forgiveness 0 and Memory 1: one slight keeps through day 30 and forgives on day 31', () => {}); // with slight decay from M0.7
test('a gift costs the giver 1 and gives the receiver 3; in winter the receiver gets 2', () => {});
test('a fog-misread gift moves berries but the receiver sees a keep', () => {});
test('warmth changes match the table: +0.10, -0.05, -0.15, +0.15, -0.20', () => {});
test('keep after a gift adds one slight and 0.1 tightness to the giver', () => {});
test('a gift received adds 0.05 softness', () => {});
test('a creature with 0 berries keeps', () => {});
test('after a meeting each side sets its opinion of the other to its tie warmth', () => {});
test('a pair meets at most once per day; a creature joins at most one meeting per tick', () => {});
test('warmth stays in [-1, 1] after 100 hostile meetings', () => {});
test('light: a meeting in the lens adds a boost that raises the same behavior nearby by 0.15, capped at 0.3', () => {});
test('light: sky warmth rises 0.001 per tick in the lens, up to 0.1 per day', () => {});
```

- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** Order inside `resolveMeeting`: pick bidder, reply, fog on reply, both gift choices, fog on each gift, payoffs, warmth and slights and shells, opinions, light boosts, diary entries, events. **Step 4: Run** and see PASS.
- [ ] **Step 5: Commit.** `feat(sim): add meeting rules and light`

### Task M0.7: Daily rules

**Files:** Create `src/sim/daily/gossip.ts`, `eat.ts`, `shells.ts`, `population.ts`, `drift.ts`, `imitation.ts`, `art.ts`, `index.ts`, and `src/sim/commands.ts`. Test one file per rule under `tests/unit/sim/daily/` and `tests/unit/sim/commands.test.ts`.

**Interfaces:**
- Produces: each daily file exports one function `(world: World, tuning: Tuning, rng: Rng) => SimEvent[]`. `index.ts` exports `runDusk(world, tuning, rng): SimEvent[]`, which calls them in ADR 0004 item 1 order and then raises `day`. `commands.ts` exports `applyCommand(world: World, cmd: Command, tuning: Tuning, rng: Rng): SimEvent[]`. It returns `[]` and changes nothing for an unknown or `away` id, or a non-finite number.

- [ ] **Step 1: Write the failing tests**, one per rule in spec 9.4 and ADR 0004:
  - Gossip, simple: a listener with Ear 0.05 and two friends who hold the opinion takes it with chance 0.3 for each friend (scripted draws 0.29 and 0.31 decide).
  - Gossip, complex: Ear 0.5 and 2 of 4 friends hold it, so it takes the opinion. 1 of 4 does not.
  - Gossip value is the mean of the holders' values. A creature never shares an opinion about the listener.
  - Eat: a creature with 0 berries counts a hungry dusk and gains 0.05 bristle. A creature with 2 berries eats 1.
  - Shells: color moves 20% toward `min(friends, 5) / 5`. Tightness relaxes 5% toward rest.
  - Population: a bush at 4 of 10 grows by `0.2 × 4 × 0.6 + 0.5 = 0.98`. Spare berries above 3 per creature and population under the cap add one newcomer at the gate. A creature with 4 hungry dusks and 1 friend leaves. On day 7, an `away` creature returns when the draw is below 0.25 and average warmth is above 0.2.
  - Drift: a tie with no meeting today moves 2% toward 0. Slights decay by `exp2neg(1 / (1 + 29 × memory))`.
  - Imitation: runs only when `day % 3 === 2` (every third dusk). A neighbor with higher fitness is copied with chance 0.3. Equal fitness gives no copy. Only neighbors within 200 count.
  - Wind (`blow` command): each creature inside the 80-unit-wide gust path gets a push. With chance 0.2 one dial shifts by `(2 × draw − 1) × 0.15` and is clamped.
  - Art: two qualifying dusks in a row give one art event on the second.
  - Commands: `shine` sets the lens; `paintFog` adds with linear falloff and clamps to [0, 1]; `place` adds a bench or a bush with the next id; `thread` on and off per ADR 0002; `whisper` sets the opinion to ±0.6 and adds a rumor; `respond` changes sky warmth by +0.1, −0.03, or −0.15; `arrangeMeeting` sets both goals to the midpoint; `setSeason` sets the season.
  - Bad input: each command with an unknown id, an `away` id, or `NaN` returns `[]` and leaves the world hash unchanged.
  - Empty worlds: `runDusk` on a world with 0 creatures and on a world with 1 creature returns without NaN in any field.
- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** **Step 4: Run** and see PASS.
- [ ] **Step 5: Commit.** `feat(sim): add daily rules and commands`

### Task M0.8: Step function, state hash, invariants (T2)

**Files:** Create `src/sim/step.ts`, `src/sim/hash.ts`, `src/sim/invariants.ts`. Test `tests/unit/sim/hash.test.ts`, `tests/property/determinism.test.ts`, `tests/property/arbitraries.ts`.

**Interfaces:**
- Produces: `step(world: World, commands: readonly Command[], tuning: Tuning): SimEvent[]` (mutates `world`; order: commands, movement, meetings, light sky warmth, gust expiry, dusk when `tick % ticksPerDay === ticksPerDay − 1`, then `tick += 1`); `hashWorld(world: World): string`; `checkInvariants(world: World, tuning: Tuning): string[]` (berries ≥ 0, every number finite, warmth and opinions in [−1, 1], dials and shells in [0, 1], positions inside the scene, population ≤ `cap.sandbox`).
- Produces from `arbitraries.ts`: `scenarioArb`, `commandArb(ids)` (includes bad ids and `NaN` at 5%), `runArb` = `{ seed, scenario, schedule: { tick, cmd }[], ticks }`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('hash is 16 hex chars and stable for one world', () => {});
test('hash changes when one berry changes by 1e-12', () => {});
test('hash ignores Map insertion order', () => {});
test('a structured clone of a world has the same hash', () => {}); // checkpoint safety

// tests/property/determinism.test.ts
test('T2: the same seed and commands give the same hash', () => {
  fc.assert(fc.property(runArb, (run) => {
    const a = replay(run), b = replay(run);
    expect(hashWorld(a)).toBe(hashWorld(b));
  }), { numRuns: 10_000 });
});
test('T2: invariants hold every tick', () => {
  fc.assert(fc.property(runArb, (run) => { replay(run, (w) => expect(checkInvariants(w, tuning)).toEqual([])); }), { numRuns: 10_000 });
});
test('golden: the m0 scenario with seed 1 and the fixed m0 command list gives the stored hash after 4,000 ticks', () => {
  expect(hashWorld(runGolden())).toMatchSnapshot();
});
```

`runArb` uses 2 to 12 creatures, `ticksPerDay` 20, 1 to 120 ticks, and 0 to 15 commands, so every daily rule fires inside a short run. The golden command list lives in `tests/golden/m0-commands.json` and is shared with M0.10.

- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** `step` builds one `Rng` from `world.rngState` and stores `rng.state()` back at the end. **Step 4: Run** `npm run test:prop`. Expected: PASS, both properties with 10,000 runs, in under 5 minutes. Record the time.
- [ ] **Step 5: Commit.** `feat(sim): add step, state hash, and invariants`

### Task M0.9: Trust mode (T4)

Blocked on the user's choice in ADR 0006. The steps below use option A. With option B, replace the populations and cut points in Step 1 with the ones the search finds, and record them in ADR 0006.

**Files:** Create `src/sim/trust-mode.ts`. Test `tests/science/trust.test.ts`.

**Interfaces:**
- Produces: `type Strategy = 'copycat' | 'copykitten' | 'alwaysGive' | 'alwaysKeep' | 'grudger' | 'detective' | 'simpleton' | 'random'`; `runTournament(cfg: { population: Strategy[]; rounds: number; noise: number; generations: number; cut: number; seed: number }): { winner: Strategy; counts: Record<Strategy, number> }`. Payoffs: give costs 1, the receiver gets 3. Noise flips the intended move. Ranking ties break by the PRNG. Strategy behavior follows *The Evolution of Trust*.

- [ ] **Step 1: Write the failing tests.**

```ts
const MIX = { copycat: 3, copykitten: 3, alwaysGive: 3, alwaysKeep: 4, grudger: 3, detective: 3, simpleton: 3, random: 3 };
const share = (cfg, who) => /* fraction of seeds 1..50 whose winner is `who` */;
test.each([0.01, 0.03, 0.05, 0.07, 0.09])('T4: copykitten wins at %f noise in at least 70% of seeds', (n) => expect(share({ noise: n, rounds: 10 }, 'copykitten')).toBeGreaterThanOrEqual(0.7));
test.each([0.3, 0.4])('T4: always-keep wins at %f noise in at least 90% of seeds', (n) => expect(share({ noise: n, rounds: 10 }, 'alwaysKeep')).toBeGreaterThanOrEqual(0.9));
test.each([1, 2])('T4: always-keep wins with %i rounds in at least 90% of seeds', (r) => expect(share({ noise: 0.05, rounds: r }, 'alwaysKeep')).toBeGreaterThanOrEqual(0.9));
test('at 0% noise copycat wins in at least 70% of seeds', () => {});
```

- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** **Step 4: Run** and see PASS. **Step 5:** with option A, change the T4 row in spec section 18 to the tested cut points and set ADR 0006 to Accepted.
- [ ] **Step 6: Commit.** `feat(sim): add trust mode with science checks`

### Task M0.10: Worker host and protocol

**Files:** Create `src/sim-host/protocol.ts`, `lite.ts`, `worker-core.ts`, `worker.ts`, `host.ts`, `dev/worker.html`, `dev/worker.ts`. Test `tests/unit/sim-host/worker-core.test.ts`, `tests/unit/sim-host/host.test.ts`, `tests/e2e/worker.spec.ts`.

**Interfaces:**
- Produces in `protocol.ts`: `ToWorker` and `FromWorker` unions exactly as ADR 0009; `WorldLite`; `interface SimPort { send(list: Command[]): void; onMessage(cb: (m: FromWorker) => void): () => void; requestHash(): Promise<{ tick: number; value: string }> }`.
- Produces: `createWorkerCore(post: (m: FromWorker) => void, clock: { now(): number; every(ms: number, fn: () => void): () => void }): (m: ToWorker) => void`; `createSimHost(spawn: () => Worker | MessagePort): SimHost` where `SimHost extends SimPort` and adds `restart(): void` and `log(): readonly { tick: number; list: Command[] }[]`.
- In tests, `clock` is manual, so a test steps the core one tick at a time.

- [ ] **Step 1: Write the failing tests.**

```ts
test('commands through the core give the same hash as a direct run', async () => {
  // MessageChannel; init with the m0 scenario; send the golden command list at its ticks; advance 4,000 ticks
  expect(hashFromCore).toBe(hashWorld(runGolden()));
});
test('the core stamps each command list with the next tick and replies accepted', () => {});
test('the core posts a checkpoint at each dusk', () => {});
test('speed 0 pauses stepping', () => {});
test('a thrown error posts error with lastGoodTick', () => {});
test('host restart from checkpoint plus replay gives the same hash as an unbroken run', () => {});
```

`tests/e2e/worker.spec.ts`: open `/dev/worker.html?golden`, which runs the golden scenario in the real `Worker` and writes the hash into `#hash`. Expect it to equal the Node golden snapshot value from M0.8. This runs in the Chromium, Firefox, and WebKit projects (Review Focus 1).

- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** In development builds, the core runs `checkInvariants` after each step and posts `error` on a violation. **Step 4: Run** `npm test` and `npm run test:e2e -- tests/e2e/worker.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(sim-host): run the sim in a worker with replay`

### Task M0.11: Rig format and `svg-to-rig`

**Files:** Create `src/render/line/rig.ts`, `tools/svg-to-rig/svg-to-rig.ts`, `tools/svg-to-rig/cli.ts`, `content/placeholder/PLACEHOLDER-pim.svg` (hand-authored: one open path, round and loopy, with circles `eye-l`, `eye-r`, `blush`, and horizontal lines `neck` and `base`), `content/rigs/PLACEHOLDER-pim.rig.json` (tool output). Test `tests/unit/tools/svg-to-rig.test.ts`.

**Interfaces:**
- Produces: `RigSchema` (Zod) and `type Rig = { id: string; points: number[]; region: number[]; markers: { eyeL: [number, number]; eyeR: [number, number]; blush: [number, number]; prop?: [number, number] }; length: number }`. `points` holds 128 `x, y` pairs, normalized so the base center is (0, 0) and the height is 1. `region` holds 128 values: 0 head, 1 body, 2 base. `length` is the path length in rig units (audio uses it in M1 for pitch).
- Produces: `svgToRig(svgText: string, id: string): Rig`, which throws a clear message when the SVG has no single `path#line`, or lacks a required marker.

- [ ] **Step 1: Write the failing tests.**
  - The placeholder gives exactly 128 points, spaced along the path by equal arc length (each gap within 1% of the mean gap).
  - Points above the `neck` line are region 0, points below the `base` line are region 2, and the rest are region 1.
  - Two runs give byte-identical JSON (values rounded to 4 decimals).
  - An SVG with two paths, or no `eye-l`, throws a message that names the problem.
  - The checked-in rig file equals the tool output (a stale file fails).
- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement** with `svg-path-properties` for arc length. Read the SVG with small anchored regular expressions for the one `path` and the named marker elements. The tool runs in Node only. **Step 4: Run** and see PASS.
- [ ] **Step 5: Commit.** `feat(tools): add svg-to-rig and the Pim placeholder rig`

### Task M0.12: Line renderer with boil and shell values

**Files:** Create `src/render/line/deform.ts`, `strip.ts`, `line-view.ts`, `dev/rig.html`, `dev/rig.ts`. Test `tests/unit/render/deform.test.ts`, `tests/unit/render/strip.test.ts`, `tests/visual/rig.spec.ts`.

**Interfaces:**
- Produces: `deform(rig: Rig, shell: Shell, boilFrame: number, out: Float32Array): Float32Array`. Boil: each point moves by a small offset from an integer hash of `(boilFrame, index)`, amplitude 0.004 rig units. The boil frame is `floor(seconds × 12)` (spec 11.2). Tightness pulls points toward the body center by up to 25% (raised from 15% after the user's art review, so tension shows). Bristle adds a fine zigzag along the normal with alternating sign and an amplitude of `bristle × 0.012` (set by the user's art review: 0.02 read as a squiggle, and 0.006 did not read as hungry). Softness runs `round(softness × 3)` passes of neighbor averaging. Color does not move points; `line-view` uses it to tint the body from paper toward the accent (spec 5.2).
- Produces: `buildStrip(points: Float32Array, width: (i: number) => number, out: Float32Array): number` (writes 2 vertices per point offset along the miter normal, returns the vertex count). Width tapers to round ends.
- Produces: `createLineView(rig: Rig, colors: { ink: number; accent: number; paper: number }, scale?: number): { container: Container; update(shell: Shell, seconds: number, reducedMotion: boolean): void }`: an opaque body fill, paper tinted toward the accent by shell color so a creature in front hides the one behind (outline from `fillOutline`, curls cut out), one batched PixiJS `Mesh` for the ink line updated in place, and the eye and blush dots from the rig markers (spec 5.1). The second blush mirrors `markers.blush` across the eyes. The dots move with the tightness pull, and the blushes fade by up to 70% with bristle. Reduced motion freezes the boil frame at 0.

- [ ] **Step 1: Write the failing tests.**
  - `deform` with an all-zero shell and boil frame 0 returns the rig points plus the boil offsets only; the same inputs give the same output.
  - Tightness 1 moves every body point closer to the center than tightness 0 does.
  - Bristle 1 alternates the sign of the normal offset point by point.
  - Softness 1 lowers the sum of squared second differences (the curve is smoother).
  - `buildStrip` returns 256 vertices for 128 points, and each vertex pair is `width(i)` apart.
  - Visual: `dev/rig.html?shell=…&frame=0` draws one rig at fixed values: `rig-rest.png` at `0,0,0.5,0`, `rig-mid.png` at `0.5,0.5,0.5,0.5`, and `rig-overlap.png` (two Pims, `&pair=1`), each with `toHaveScreenshot(name, { maxDiffPixelRatio: 0.01 })`. The first run writes the baseline. The user approves the image before it is committed.
- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` and `npm run test:e2e -- tests/visual`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(render): add line rig renderer with boil and shells`

### Task M0.13: Performance probe

**Files:** Create `dev/perf.html`, `dev/perf.ts`, `tests/perf/rigs.spec.ts`.

**Interfaces:**
- Consumes: `createLineView`, `createSimHost`, the m0 scenario (30 creatures).
- Produces: `window.__perf = { frames: number; meanMs: number; p95Ms: number; p99Ms: number; drawCalls: number }` after the run.

- [ ] **Step 1: Write the probe test.** Open `/dev/perf.html?n=30&seconds=30`. The page runs the sim in the worker, draws 30 rigs from snapshots with interpolation, and records each frame time with `performance.now()`. Assert `meanMs <= 16.9`, `p95Ms <= 20`, and `drawCalls <= 100`. Print the numbers to the test log.
- [ ] **Step 2: Run** `npm run test:perf` in the container. The container has no GPU, so treat its numbers as a smoke check only.
- [ ] **Step 3: Run the real check on the user's desktop.** Start a Remote Control session on the user's machine in the repo folder. Run `npx playwright install chromium` and then `PERF_HEADED=1 npm run test:perf`. Record the numbers and the device in `tests/perf/RESULTS.md`.
- [ ] **Step 4: Commit.** `test(perf): add 30-rig frame-time probe`

### Task M0.14: Ink connected to the director

**Files:** Create `content/ink/m0.ink`, `src/story/beat-tags.ts`, `src/story/ink.ts`, `src/story/director.ts`. Test `tests/unit/story/beat-tags.test.ts`, `tests/unit/story/director.test.ts`.

**Interfaces:**
- Consumes: `SimPort`, `WorldLite`.
- Produces: `type BeatAction = { kind: 'arrange_meeting'; a: string; b: string }` (M1 adds more kinds); `parseBeatTag(tag: string): BeatAction | null` (grammar `beat:<name>(<arg>,<arg>)`, ids `[a-z0-9_-]+`; anything else returns `null`); `createInk(json: string): { setVar(name: string, value: number | string | boolean): void; play(knot: string): { lines: string[]; tags: string[] } }`; `createDirector(port: SimPort, ink: InkRunner): { runBeat(beat: { knot: string; vars: Record<string, (lite: WorldLite) => number> }): Promise<{ lines: string[] }> }`.
- `content/ink/m0.ink` holds one knot `m0_test` that prints `{pim_sky_warmth}` and carries the tags `#placeholder` and `#beat:arrange_meeting(krit,pim)`.

- [ ] **Step 1: Write the failing tests.**

```ts
test('parseBeatTag reads arrange_meeting', () => expect(parseBeatTag('beat:arrange_meeting(krit,pim)')).toEqual({ kind: 'arrange_meeting', a: 'krit', b: 'pim' }));
test.each(['beat:arrange_meeting(krit)', 'beat:drop_table()', 'beat:arrange_meeting(Krit,pim)', 'placeholder'])('parseBeatTag rejects %s', (t) => expect(parseBeatTag(t)).toBeNull());
test('a beat writes a sim value into Ink, plays the knot, and sends arrangeMeeting', async () => {
  // fake port over a direct sim; pim skyWarmth set to 0.25 in the scenario
  expect(result.lines[0]).toContain('0.25');
  expect(sent).toEqual([[{ t: 'arrangeMeeting', a: 'krit', b: 'pim' }]]);
});
test('honesty: the run with the director equals a direct run with the same accepted log', () => {
  expect(hashWorld(directorRun)).toBe(hashWorld(directRunWithSameLog));
});
test('the director never sends a command that the beat tags did not name', () => {});
```

- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** Compile Ink in tests with `inkjs/compiler`. **Step 4: Run** and see PASS.
- [ ] **Step 5: Commit.** `feat(story): connect Ink to the director through beat tags`

### Task M0.15: Placeholder build guard

**Files:** Create `tools/content-validate/placeholder-guard.ts`, `tools/content-validate/validate.ts`. Modify `vite.config.ts`. Test `tests/unit/tools/placeholder-guard.test.ts` with fixtures in `tests/unit/tools/fixtures/`.

**Interfaces:**
- Produces: `findPlaceholders(text: string): string[]` (matches `PLACEHOLDER-`, `#placeholder`, `[PLACEHOLDER]`); `placeholderGuard(): Plugin` (Vite). In `build` with `mode === 'production'` it scans every module id and every emitted chunk and asset, and calls `this.error` with the list of hits. In `serve` it does nothing.
- Produces: `validate.ts` checks `content/tuning.json` with `TuningSchema`, every `content/rigs/*.json` with `RigSchema`, and every `content/ink/*.ink` with the inkjs compiler. It prints the count of each placeholder kind and exits 1 on any schema or compile error.

- [ ] **Step 1: Write the failing tests.**
  - A fixture app that imports `PLACEHOLDER-x.svg` fails `vite build` (run with the Vite JS API), and the error names the file.
  - A fixture app whose Ink JSON holds `#placeholder` fails the same way.
  - A clean fixture builds.
  - The same placeholder fixture builds in `mode: 'development'`.
  - `validate.ts` exits 1 on a tuning file with a missing key.
- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run validate-content && npm run build`. Expected: PASS. The real production build passes because `index.html` references no placeholder.
- [ ] **Step 5: Commit.** `feat(tools): fail production builds that ship placeholders`

### Task M0.16: M0 exit check

- [ ] **Step 1:** Run `npm run lint && npm run typecheck && npm test && npm run test:prop && npm run validate-content && npm run build && npm run test:e2e`. Save the output summary.
- [ ] **Step 2:** Confirm the desktop perf numbers from M0.13 meet 60 fps.
- [ ] **Step 3:** Run superpowers:verification-before-completion, then superpowers:requesting-code-review on the whole branch. Fix findings.
- [ ] **Step 4:** Report to the user: the test summary, the T2 run time, the golden hash, the frame-time numbers, and the open questions that block M1 (handoff section 12, questions 3 and 4).

---

## Milestone M1: Vertical slice (chapters 0 to 3)

Exit check: an auto-player and a keyboard-only player finish chapters 0 to 3; T3 golden runs pass for chapters 2 and 3; axe-core finds no serious or critical issues; then a five-person playtest against S3 and S4.

M1 uses placeholder art and placeholder text (ADR 0010) until the designer and the writer deliver. M1 builds the Meadow view only. Cosmos and Soul views, peek, and zoom arrive in M2.

### M1 file structure

| Path | Responsibility |
| --- | --- |
| `src/sim/metrics.ts` | Bet and twist metrics computed from the world |
| `src/sim/types.ts` (modify) | Add commands `wake`, `promptSkyBid`, `overPoke`; events `wake`, `skyBid` |
| `src/story/schema.ts` | Zod schema for chapter configs |
| `src/story/flags.ts` | Carry-forward flag type; defaults come from `content/flags.json` |
| `src/story/twists.ts` | Named twist predicates (logic stays out of `content/`) |
| `src/story/chapter-runner.ts` | Runs one chapter: verbs, beats, bets, twist retries, variants, exit |
| `src/story/scenario.ts` | Builds a chapter scenario: overrides, the matching variant, ticks per day |
| `src/story/tuning.ts` | The typed tuning the story reads |
| `src/story/verbs.ts` | Verb and VerbInput types (ADR 0011) |
| `src/story/bets.ts` | Opens a bet, runs the reveal at 8×, measures, logs |
| `src/story/action-log.ts` | The accepted log plus verbs and bet results |
| `tools/ink-plugin.ts` | Vite plugin: compiles `.ink` on import |
| `content/chapters/ch0.json` to `ch3.json`, `content/flags.json`, `content/ink/main.ink`, `content/ink/ch0.ink` to `ch3.ink`, `content/cast/*.json`, `content/scenes/kith-meadow.json`, `content/placeholder/PLACEHOLDER-*.svg` | Data |
| `src/render/scene.ts`, `src/render/meadow-view.ts`, `src/render/camera.ts`, `src/render/effects/light.ts`, `src/render/effects/fog.ts` | Meadow view |
| `src/input/verbs.ts`, `src/input/keyboard.ts`, `src/input/pointer.ts`, `src/input/hints.ts`, `src/input/over-poke.ts` | Device events to verbs |
| `src/ui/App.svelte`, `src/ui/screens/Title.svelte`, `Game.svelte`, `Settings.svelte`, `src/ui/components/ToolTray.svelte`, `BetCard.svelte`, `BeatLine.svelte`, `Drawer.svelte`, `ChapterRibbon.svelte`, `TimeControls.svelte`, `src/ui/settings.ts` | Screens |
| `src/audio/engine.ts`, `src/audio/voices.ts`, `src/audio/scale.ts`, `src/audio/event-sounds.ts` | Sound |
| `src/persist/db.ts`, `src/persist/format.ts`, `src/persist/migrations.ts`, `src/persist/slots.ts` | Saves |
| `tests/golden/ch2.test.ts`, `tests/golden/ch3.test.ts`, `tests/e2e/slice.spec.ts`, `tests/e2e/a11y.spec.ts` | M1 checks |
| `docs/playtest/m1.md` | Playtest script for S3 and S4 |

### Task M1.1: App shell, settings, and Svelte

**Files:** Add the M1 packages from ADR 0008 (check versions again). Create `src/ui/App.svelte`, `Title.svelte`, `Settings.svelte`, `src/ui/settings.ts`. Modify `src/main.ts`, `eslint.config.js` (Svelte rules), `package.json` (`typecheck` becomes `tsc --noEmit && svelte-check`). Test `tests/unit/ui/settings.test.ts`, `tests/e2e/a11y.spec.ts`.

**Interfaces:** `Settings = { textScale: 1 | 1.25 | 1.5; highContrast: boolean; reducedMotion: boolean; sound: boolean; analytics: false }`; `createSettingsStore(storage: SettingsStorage): Writable<Settings>`. `reducedMotion` starts from `prefers-reduced-motion`. `sound` starts `false`. The title screen has Begin, Continue (disabled with no save), *Book of Skies* (disabled until M2), and Settings, all as real buttons.

- [ ] **Step 1: Write the failing tests:** defaults; the system reduced-motion preference sets the default; changes persist through the storage port; axe-core on the title and settings screens finds no serious or critical issue; every button is reachable with Tab and acts on Enter.
- [ ] **Step 2–4:** run and see FAIL, implement, run and see PASS. **Step 5: Commit.** `feat(ui): add app shell, title, and settings`

### Task M1.2: Sim additions for chapters 0 to 3, and metrics

**Files:** Modify `src/sim/types.ts`, `src/sim/commands.ts`, `src/sim/step.ts`. Create `src/sim/metrics.ts`. Test `tests/unit/sim/m1-commands.test.ts`, `tests/unit/sim/metrics.test.ts`; extend `tests/property/arbitraries.ts` with the new commands.

**Interfaces:**
- Commands: `{ t: 'wake'; who: string }` (a `sleep` creature becomes `wander`); `{ t: 'promptSkyBid'; who: string }` (story only: the creature bids to the sky and emits `skyBid`; the player's `respond` resolves it, and the director sends `respond` with `away` after 6 seconds with no reply); `{ t: 'overPoke' }` (every active creature adds `overPoke.skyWarmth` (−0.05) to its sky warmth and avoids the lens for `light.days`).
- Scenario creatures gain an optional `state`, so chapter 0 starts with everyone asleep.
- `metric(world: World, m: MetricSpec, tuning: Tuning): string | number`, with `MetricSpec = { kind: 'maxBerries' } | { kind: 'averageWarmth' } | { kind: 'friendPairs' }`.

- [ ] **Step 1: Write the failing tests:** each new command's effect; bad ids are ignored; `maxBerries` returns the id with the most berries (ties go to the lower id); `friendPairs` counts pairs where both sides are above 0.3. Run `npm run test:prop` again with the new commands in the arbitrary.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(sim): add wake, sky bids, over-poke, and metrics`

### Task M1.3: Chapter config schema, flags, and twists

**Files:** Create `src/story/schema.ts`, `src/story/flags.ts`, `src/story/twists.ts`, `content/flags.json`, `content/chapters/ch0.json` to `ch3.json`. Extend `tools/content-validate/validate.ts` to check chapters. Test `tests/unit/story/schema.test.ts`, `tests/unit/story/twists.test.ts`.

**Interfaces:**
- `ChapterSchema` fields, from spec 10.1: `id`, `season`, `scene`, `dayLengthSeconds`, `verbs` (unlocked), `newVerb`, `overrides` (cast positions, dials, weather, state), `beats: Beat[]`, `bet?: { id, knot, options: string[], metric: MetricSpec, afterDays }`, `twist?: { id: TwistId, withinDays, retryArrange: [string, string] }`, `reads: FlagKey[]`, `writes: FlagKey[]`, `variants: { when: FlagCondition, overrides }[]` (at most 2), `exit: ExitSpec`, `feeling`, `notes: string[]` (2 to 4).
- `Beat = { id; trigger: { at: number } | { event: SimEvent['t']; who?: string } | { verb: Verb }; actions: ({ camera: string } | { ink: string } | { arrange: [string, string] } | { pause: true } | { openBet: true })[] }`.
- `twists.ts`: `type TwistId = 'kritExploitsPim' | 'benchWarmsVillage'`; `checkTwist(id: TwistId, before: WorldLite, now: WorldLite, events: SimEvent[]): boolean`. `kritExploitsPim`: a `gift` event from Pim to Krit and a `keep` by Krit in the same meeting. `benchWarmsVillage`: `friendPairs` rises by at least 3 and average warmth by at least 0.1 within the window after the bench.
- `flags.ts`: `type Flags = { pimSkyBond: number; pimSkyOpinion: -1 | 0 | 1; pimScar: boolean; benchPlaced: boolean; friendThreads: number }`. Defaults in `content/flags.json` are the gentle values for skips (spec P3).

- [ ] **Step 1: Write the failing tests:** each shipped chapter file parses; a chapter with 3 variants fails; a beat with an unknown action fails; each twist predicate is true and false on hand-built inputs.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(story): add chapter schema, flags, and twists`

### Task M1.4: Chapter runner and bets

**Files:** Create `src/story/chapter-runner.ts`, `src/story/bets.ts`, `src/story/action-log.ts`. Extend `src/story/beat-tags.ts` with `camera`, `pause`, `open_bet`. Test `tests/unit/story/chapter-runner.test.ts`, `tests/unit/story/bets.test.ts`.

**Interfaces:**
- `createChapterRunner(port: SimPort, ink: InkRunner, config: Chapter, flags: Flags): ChapterRunner` with `onPrompt(cb: (p: Prompt) => void)`, `verb(v: VerbInput): boolean` (false when the verb is locked), `answerBet(option: string): void`, `skip(): Flags`, `done: Promise<Flags>`.
- `Prompt = { kind: 'line'; text: string } | { kind: 'bet'; question: string; options: string[] } | { kind: 'reveal'; answer: string; result: string } | { kind: 'hint'; verb: Verb }`.
- Honesty: the runner sends only `arrangeMeeting`, `setSeason`, `promptSkyBid`, `speed`, and the player's verbs. If the twist does not happen in its window, it sends `retryArrange` again, up to `story.honestyRetries` (3) times, then plays the chapter's close-call knot `<id>_close_call`.

- [ ] **Step 1: Write the failing tests:** a locked verb returns false and sends nothing; a time beat fires once at its tick; an event beat fires on the matching event; a bet sets speed 8, waits `afterDays`, measures, then sets speed 1 and logs the answer and the result; a twist that never happens triggers exactly 3 retries and then the close-call knot; `skip()` returns the chapter's writes filled from `content/flags.json`; the runner never sends a command outside its allowed list.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(story): add chapter runner with bets and honest retries`

### Task M1.5: Ink build and chapter scripts

**Files:** Create `tools/ink-plugin.ts`, `content/ink/main.ink`, `content/ink/ch0.ink` to `ch3.ink`. Modify `vite.config.ts`. Test `tests/unit/tools/ink-plugin.test.ts`.

The scripts hold the beat structure for chapters 0 to 3, one sentence per beat (spec P4). The cast voice lines in spec 5.3 are the user's text. Every other line carries `#placeholder` until a human writer replaces it.

- [ ] **Step 1: Write the failing tests:** importing a `.ink` file returns compiled JSON; a compile error fails the build with the Ink line number; every knot that a chapter config names exists in `main.ink`.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(story): compile Ink at build and add chapter 0 to 3 scripts`

### Task M1.6: Meadow view

**Files:** Create `src/render/scene.ts`, `meadow-view.ts`, `camera.ts`, `effects/light.ts`, `effects/fog.ts`, `content/scenes/kith-meadow.json`, placeholder SVGs and rigs for the 6 cast members and 1 shared villager body. Test `tests/unit/render/interpolate.test.ts`, `tests/visual/meadow.spec.ts`.

M1 draws fog as a soft wash. Spec 11.3 (lines inside fog break into dashes) moves to M2 with the Autumn fog chapter.

**Interfaces:** `createMeadowView(app: Application, scene: SceneData, rigs: Map<string, Rig>, palette: Palette): { update(prev: WorldLite, next: WorldLite, alpha: number, settings: Settings): void; pick(x: number, y: number): string | null }`. Interpolate positions between two snapshots. The creature that the current beat is about is the only one drawn in the accent color (spec 11.1 contrast). High contrast doubles line width. Reduced motion stops the boil, the sway, and camera moves.

- [ ] **Step 1: Write the failing tests:** interpolation at alpha 0, 0.5, and 1; `pick` returns the nearest creature within its hit radius and `null` elsewhere; a visual snapshot of the meadow at a fixed tick in normal and high-contrast modes.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(render): add the Meadow view`

### Task M1.7: Input and keyboard play

**Files:** Create `src/input/verbs.ts`, `keyboard.ts`, `pointer.ts`, `hints.ts`, `over-poke.ts`. Test `tests/unit/input/*.test.ts`.

**Interfaces:** `type Verb = 'wake' | 'respond' | 'bet' | 'place'` (M1); `type VerbInput = { verb: 'wake'; who: string } | { verb: 'respond'; reply: BidReply } | { verb: 'place'; x: number; y: number }`. `createKeyboard(target: EventTarget, ctx: InputContext): () => void` maps spec 12.5 keys: 1 to 3 pick a tool, arrows move the cursor 20 units, Tab and Shift+Tab cycle creatures in id order, Enter acts, Space pauses. `createOverPoke(windowSeconds, count, clock)` returns `poke(): boolean`, true on the 9th poke inside 30 seconds. `createHints(idleMs = 10000)` emits one ghost-hand hint per new verb.

- [ ] **Step 1: Write the failing tests:** each key maps to its verb or action; Tab order skips `away` creatures; `place` snaps to the nearest bench spot in the scene; the over-poke counter fires on the 9th poke and resets after the window; a hint fires once after 10 seconds idle and never again for that verb.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(input): add verbs, keyboard play, hints, and over-poke`

### Task M1.8: Game screen

**Files:** Create `src/ui/screens/Game.svelte` and the components in the M1 file table. Test `tests/e2e/slice.spec.ts` (partial), `tests/e2e/a11y.spec.ts` (extend).

The scene canvas fills the window. The chapter title sits small at the top left. The tool tray shows at most 3 tools. `BeatLine` is an `aria-live="polite"` region. The bet card is a modal dialog with focus trap and Escape disabled until an answer. The ribbon allows skips. The tab-hidden event sets sim speed 0, and the visible event restores it (no time passes unseen).

- [ ] **Step 1: Write the failing tests:** axe-core on the game screen with a bet open; the beat line text is in the DOM; the bet card takes focus and returns it; hiding the page sends `speed 0`.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(ui): add the game screen`

### Task M1.9: Sound

**Files:** Create `src/audio/engine.ts`, `voices.ts`, `scale.ts`, `event-sounds.ts`, `content/cast/*.json` (timbre params). Test `tests/unit/audio/*.test.ts`.

**Interfaces:** `pitchFor(lineLength: number, season: Season): number` returns a frequency on the season's pentatonic scale (longer line, lower pitch); `soundFor(e: SimEvent): SoundCue | null` maps spec 11.5; `createAudioEngine(ctxFactory: () => AudioContext)` makes no `AudioContext` until the first unmute, then plays the welcome chord once.

- [ ] **Step 1: Write the failing tests:** `pitchFor` returns only scale tones, and is monotonic in line length; each spec 11.5 event maps to its cue; no context exists while sound is off; the welcome chord plays once.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(audio): add creature voices and event sounds`

### Task M1.10: Saves

**Files:** Add `fake-indexeddb` as a dev dependency (check the version). Create `src/persist/db.ts`, `format.ts`, `migrations.ts`, `slots.ts`. Test `tests/unit/persist/*.test.ts`.

**Interfaces:** `SaveV1 = { version: 1; seed: number; tuningHash: string; ink: string; flags: Flags; chapterId: string; log: { tick: number; list: Command[] }[]; checkpoint: World }`; `migrate(raw: unknown): SaveV1` (throws on an unknown version); `createSlots(db: IDBFactory): { list(): Promise<SlotInfo[]>; save(slot: 0 | 1 | 2 | 'auto', s: SaveV1): Promise<void>; load(slot): Promise<SaveV1 | null> }`. The autosave writes at each chapter start and keeps the one before it. A damaged save loads the checkpoint before it. Blocked storage shows one notice and the game continues without saves.

- [ ] **Step 1: Write the failing tests:** save then load gives a world with the same hash; a damaged latest autosave falls back to the previous one; a blocked `indexedDB.open` resolves to a no-save mode with one notice; `migrate` rejects version 99.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(persist): add save slots with fallback`

### Task M1.11: Golden runs (T3) for chapters 2 and 3

**Files:** Create `tests/golden/ch2.test.ts`, `tests/golden/ch3.test.ts`, `tests/golden/run-chapter.ts`.

**Interfaces:** `runChapterHeadless(config: Chapter, seed: number, player: ScriptedPlayer): { twistFired: boolean; retries: number; usedCloseCall: boolean }`, with the chapter runner over a direct sim port and a scripted player that makes the obvious choices.

- [ ] **Step 1: Write the tests:** for each chapter, run 200 seeds; expect `usedCloseCall` in fewer than 10 of them (below 5%).
- [ ] **Step 2: Run** `npm run test:golden`. If a chapter fails, change only that chapter's overrides or tuning, never the twist check. Record any tuning change in an ADR.
- [ ] **Step 3: Commit.** `test(golden): add T3 runs for chapters 2 and 3`

### Task M1.12: End-to-end slice and playtest kit

**Files:** Complete `tests/e2e/slice.spec.ts`. Create `docs/playtest/m1.md`.

- [ ] **Step 1: Write the tests:** an auto-player finishes chapters 0 to 3; a keyboard-only run finishes them; a phone viewport (Pixel 7 emulation) finishes chapter 0; reduced motion finishes chapter 0 with no boil.
- [ ] **Step 2: Run** `npm run test:e2e`. Expected: PASS.
- [ ] **Step 3: Write `docs/playtest/m1.md`:** the session script, the S3 question ("explain what happened in your own words"), the S4 question ("name the feelings you had"), and a results table. Name no real tester.
- [ ] **Step 4: Run** the M0.16 checks again, request a code review, and report to the user.
- [ ] **Step 5: Commit.** `test(e2e): add the vertical slice runs and playtest kit`

---

## Milestone M2: Part 1 complete (chapters 4 to 10)

Exit check: T3 passes for chapters 4 to 10 (`npm run test:t3`); T4 passes (`tests/science/trust.test.ts`); T6 passes (at least 900 distinct myths in 1,000 random-play runs); the auto-player and a keyboard-only player both reach the end of Part 1 in Chromium; axe-core finds no serious or critical issue on any new screen. The golden hash in `tests/golden/m0-hash.json` stays `c29d2fa4dbda4dcf`: no M2 task rebaselines it, and every new sim rule is switched on only by an optional scenario field. Then run superpowers:verification-before-completion and superpowers:requesting-code-review, and report to the user.

Scope: chapters 4 to 10 and the five interludes as configs and Ink, with placeholder text (ADR 0010); the sim rules they need (land, ambient sky bids, the dew mushroom, the festival); the year carry; the Cosmos and Soul views with peek, zoom, rewind, and threads; the myth and the *Book of Skies*; the Quiet Visitor; the structured margin notes drawer; the action log in saves; and dash fog (spec 11.3). ADR 0012 holds every M2 ruling on a spec gap. A task that cites "ADR 0012 item n" uses that exact rule.

### M2 file structure

| Path | Responsibility |
| --- | --- |
| `src/sim/types.ts`, `world.ts`, `commands.ts`, `step.ts`, `move.ts`, `light.ts`, `meeting.ts`, `invariants.ts`, `tuning.ts` (modify) | Scenario ties and carry fields, structures, the new commands and events |
| `src/sim/land.ts` | Water, bridges, and the ridge (ADR 0012 item 3) |
| `src/sim/festival.ts` | The threshold dance (ADR 0012 item 6) |
| `src/sim/daily/sky-bid.ts`, `src/sim/daily/mushroom.ts` | Ambient sky bids and the mushroom dawn (ADR 0012 items 4 and 5) |
| `src/sim-host/protocol.ts`, `lite.ts`, `worker-core.ts`, `host.ts` (modify) | Snapshot detail and rewind |
| `src/story/carry.ts` | The year carry from a snapshot (ADR 0012 item 1) |
| `src/story/verbs.ts`, `schema.ts`, `scenario.ts`, `flags.ts`, `twists.ts`, `bets.ts`, `action-log.ts`, `chapter-runner.ts` (modify) | Part 1 verbs, configs, flags, twists, activities, the year log |
| `src/story/diary.ts`, `src/story/names.ts`, `src/story/peek.ts` | Diary lines, display names, the peek rule text |
| `src/myth/features.ts`, `src/myth/grammar.ts` | Action log to features; verses and slots (spec 10.6) |
| `src/render/line/strip.ts`, `line-view.ts`, `meadow-view.ts`, `palette.ts` (modify) | Dash fog, land, mushroom, dance, heat map, season palettes, the visitor |
| `src/render/cosmos-view.ts`, `src/render/soul-view.ts`, `src/render/timeline.ts` | The two new views and the timeline |
| `src/input/zoom.ts`, `hold-still.ts`, `wait.ts`; `keyboard.ts`, `pointer.ts`, `verbs.ts` (modify) | View changes, the hidden verbs, Part 1 tools |
| `src/ui/components/CosmosPanel.svelte`, `WhisperCard.svelte`, `MythScroll.svelte`; `ToolTray.svelte`, `Drawer.svelte` (modify) | Panels and cards |
| `src/ui/interludes/*.svelte`, `src/ui/interludes/activities.ts` | The five interlude activities |
| `src/ui/screens/BookOfSkies.svelte`; `Game.svelte`, `Title.svelte`, `App.svelte`, `game-service.ts` (modify) | Screens |
| `src/persist/format.ts`, `migrations.ts` (modify), `src/persist/profile.ts` | Save version 2 with the year log; myths and feathers |
| `content/chapters/ch4.json` to `ch10.json`, `i3.json`, `i4.json`, `i5.json`, `i7.json`, `i8.json`; `content/ink/` the same ids; `content/diary.json`; `content/myth/verses.json`; `content/palettes/<season>.json`; `content/placeholder/PLACEHOLDER-visitor.svg` and its rig | Data |
| `tests/golden/players.ts`, `year.ts`, `carry/*.json`, `ch4.test.ts` to `ch10.test.ts`, `ch9-control.test.ts`, `carry.test.ts` | T3 |
| `tests/unit/myth/*.test.ts`, `tests/e2e/part1.spec.ts` | T6, T7 runs |

### Task M2.1: Snapshot detail and the carried scenario (sim, sim-host)

**Files:** Modify `src/sim/types.ts`, `world.ts`, `daily/population.ts`, `src/sim-host/protocol.ts`, `lite.ts`, `tests/property/arbitraries.ts`. Test `tests/unit/sim/world.test.ts`, `tests/unit/sim/daily/population.test.ts`, `tests/unit/sim-host/lite.test.ts` (new).

**Interfaces:**
- Produces in `types.ts`: `Scenario.ties?: { a: string; b: string; ab: Side; ba: Side }[]`; scenario creature `skyWarmth?: number` and `gone?: true`; `Creature.gone?: true`.
- Produces in `protocol.ts`: `WorldLite.creatures[]` gains `dials: Dials`; `WorldLite.ties: { a: string; b: string; ab: number; ba: number }[]` (warmths, every tie, in tie-key order); `WorldLite.rumor: { about: string; sign: 1 | -1; holders: string[] } | null` (the last rumor; `holders` are the creatures, not away and not `about`, whose opinion of `about` has that sign and an absolute value of at least `opinion.holdAt`, in id order).
- `createWorld` adds each scenario tie with `meetings: 1` and `lastDay: -1`, warmths clamped to [−1, 1], and drops a tie that names an unknown id or one id twice. A scenario with no `ties` adds none. `skyWarmth` is clamped. `gone` copies only when set, so the m0 world has the same keys as before.
- `returnAway` never returns a `gone` creature.

- [ ] **Step 1: Write the failing tests.**

```ts
test('scenario ties become ties that are not first meetings', () => {
  const w = createWorld(1, t, { ...base, ties: [{ a: 'pim', b: 'krit', ab: { warmth: 0.5, slights: 1 }, ba: { warmth: -2, slights: 0 } }] });
  const tie = getTie(w, 'pim', 'krit');
  expect(tie).toMatchObject({ meetings: 1, lastDay: -1 });
  expect(side(tie!, 'pim')).toEqual({ warmth: 0.5, slights: 1 });
  expect(side(tie!, 'krit').warmth).toBe(-1);
});
test('a scenario tie with an unknown or repeated id is dropped', () => {});
test('a gone creature never returns', () => {}); // day 7, draw 0, average warmth 0.9
test('lite carries dials, tie warmths in key order, and the rumor holders', () => {
  // whisper echo about krit (-1), then set moss's opinion of krit to -0.4 and pim's to -0.2
  expect(toLite(w, t).rumor).toEqual({ about: 'krit', sign: -1, holders: ['echo', 'moss'] });
});
test('lite rumor is null with no rumor', () => {});
test('the m0 golden hash is unchanged', () => expect(hashWorld(runGolden())).toBe('c29d2fa4dbda4dcf'));
```

Add scenario ties (sometimes with unknown ids) and `skyWarmth` to `scenarioArb`.

- [ ] **Step 2: Run** `npx vitest run tests/unit/sim tests/unit/sim-host`. Expected: FAIL.
- [ ] **Step 3: Implement** the fields above. In `toLite`, sort ties by key with `byCodeUnit`.
- [ ] **Step 4: Run** `npm test && npm run test:prop`. Expected: PASS, golden hash unchanged.
- [ ] **Step 5: Commit.** `feat(sim): carry ties and sky warmth in scenarios; richer snapshots`

### Task M2.2: Land: water, bridges, lanterns, and the ridge (sim)

**Files:** Create `src/sim/land.ts`. Modify `types.ts`, `world.ts`, `move.ts`, `commands.ts`, `light.ts`, `step.ts`, `invariants.ts`, `tuning.ts`, `content/tuning.json`, `lite.ts`, `protocol.ts`, `tests/property/arbitraries.ts`. Test `tests/unit/sim/land.test.ts`, extend `tests/unit/sim/tuning.test.ts`, `commands.test.ts`.

**Interfaces:**
- Consumes: M2.1 scenario fields.
- Produces in `types.ts`: `interface Rect { x: number; y: number; w: number; h: number }`; `Structure.kind: 'bench' | 'bridge' | 'lantern'`; the `place` command's `kind: 'bench' | 'bush' | 'bridge' | 'lantern'`; `Scenario.water?: Rect[]`, `Scenario.ridgeX?: number`; `World.water?: Rect[]`, `World.ridgeX?: number` (set only when the scenario has them).
- Produces in `land.ts`: `inWater(world: World, x: number, y: number): boolean`; `bridgeNear(world: World, x: number, y: number, t: Tuning): Structure | null` (within `bridge.radius`); `crossRidge(world: World): SimEvent[]` (a `wander` creature with `x >= ridgeX` becomes `away` and `gone`, and emits `leave`).
- Produces in `protocol.ts`: `WorldLite.water: Rect[]` (`[]` with none).
- Tuning: `bridge: { radius: 32 }`, `lantern: { radius: 120, fogFactor: 0.5 }`.
- Rules (ADR 0012 item 3): `steer` refuses a move into water away from a bridge and sets the goal to the nearest bridge on that rectangle, or picks a new goal when it has none; a bridge `place` outside water is ignored; `fogAt` scales by `lantern.fogFactor` within `lantern.radius` of any lantern; with a ridge, random goals stay at `x < ridgeX` and `blow` sets each pushed creature's goal to the gust's end, clamped to the scene. `step` runs `crossRidge` after movement. A world with no water, lantern, or ridge takes the same PRNG draws as before.

- [ ] **Step 1: Write the failing tests.**

```ts
const brook: Rect = { x: 780, y: 0, w: 60, h: 900 };
test('with no bridge, no creature crosses the brook in 10 days', () => {
  // 30 creatures, half west and half east, goals across: every creature stays on its side every tick
});
test('with one bridge at (810, 450), a creature crosses only within 32 units of it', () => {});
test('a creature never stands in water away from a bridge (property, 500 runs)', () => {
  fc.assert(fc.property(landRunArb, (run) => replay(run, (w) => {
    for (const c of activeCreatures(w)) if (inWater(w, c.x, c.y)) expect(bridgeNear(w, c.x, c.y, t)).not.toBeNull();
  })), { numRuns: 500 });
});
test('a bridge placed outside water is ignored; one inside water is added', () => {});
test('a lantern halves the fog within 120 units and nowhere else', () => {
  expect(fogAt(w, 100, 100, t)).toBeCloseTo(0.3); expect(fogAt(w, 400, 400, t)).toBeCloseTo(0.6);
});
test('with a ridge at 1500, no random goal is at x >= 1500', () => {});
test('a gust from (1300, 300) by (400, 0) sends Wisp to the ridge, and Wisp leaves for good', () => {
  // step until Wisp is away: one leave event for wisp, wisp.gone true, never returns on day 7, 14, 21
});
test('without a ridge, blow leaves goals alone (the M0 rule)', () => {});
```

`landRunArb` extends `runArb` with 0 to 2 water rectangles, bridges, and lanterns. Review Focus 3 (below) pins this property.

- [ ] **Step 2: Run** and see FAIL.
- [ ] **Step 3: Implement.** Segment-to-rectangle tests use only `+ − × ÷` and `Math.min`/`Math.max`.
- [ ] **Step 4: Run** `npm test && npm run test:prop`. Expected: PASS, golden hash unchanged, T2 with 10,000 runs.
- [ ] **Step 5: Commit.** `feat(sim): add water, bridges, lanterns, and the ridge`

### Task M2.3: Season rules: ambient sky bids, lit meetings, the dew mushroom, the festival (sim)

**Files:** Create `src/sim/daily/sky-bid.ts`, `src/sim/daily/mushroom.ts`, `src/sim/festival.ts`. Modify `types.ts`, `world.ts`, `meeting.ts`, `move.ts`, `commands.ts`, `step.ts`, `daily/index.ts`, `invariants.ts`, `tuning.ts`, `content/tuning.json`, `lite.ts`, `protocol.ts`, `tests/golden/golden-hash.test.ts` (rename `M1Only` to `NotInM0` and add `dance`), `tests/property/arbitraries.ts`. Test `tests/unit/sim/daily/sky-bid.test.ts`, `mushroom.test.ts`, `tests/unit/sim/festival.test.ts`, extend `meeting.test.ts` and `tuning.test.ts`.

**Interfaces:**
- Produces in `types.ts`: `Scenario.mushroom?: { x: number; y: number }`, `Scenario.ambientSkyBids?: true`; scenario creature `danceThreshold?: number`; `World.mushroom?: { x: number; y: number; drops: number; taken: number; witherDays: number }`; `World.ambientSkyBids?: true`; `Creature.dancing?: true`, `Creature.danceThreshold?: number`, `Creature.mushroomDay?: number`; command `{ t: 'dance'; who: string }`; events `{ t: 'lit'; a: string; b: string; behaviors: Behavior[] }`, `{ t: 'dance'; who: string }`, `{ t: 'mushroom'; taken: number; drops: number }`.
- Produces: `ambientSkyBid: DailyRule` (last in `RULES`; draws one number only when `world.ambientSkyBids`); `mushroomDawn: DailyRule`; `spreadDance(world: World, t: Tuning): SimEvent[]` (called by `step` after meetings when `tick % festival.everyTicks === 0` and any creature dances).
- Produces in `protocol.ts`: `WorldLite.creatures[].dancing: boolean`; `WorldLite.mushroom: { x: number; y: number; drops: number; witherDays: number } | null`.
- `resolveMeeting` appends one `lit` event after its three events when the meeting midpoint is in the lens and neither side avoids it. Events are not part of the hash.
- Tuning: `sky.ambientBidChance` 0.5; `mushroom.takeBelowBerries` 1, `mushroom.trustFriends` 2; `festival: { threshold: 2, everyTicks: 10 }`.

- [ ] **Step 1: Write the failing tests.**

```ts
test.each([[0, 20], [6, 20], [7, 10], [8, 10]])('taking %i drops gives %i at the next dawn', (taken, next) => {});
test('taking 9 withers it: 0, 0, 0, then 10 at the next four dawns', () => {});
test('a creature takes one drop a day, only below 1 berry, or below 5 with fewer than 2 friends', () => {});
test('a hungry creature with a full mushroom in reach and no bush heads for the mushroom', () => {});
test('ambient: with chance draw 0.4, the awake creature with the highest sky warmth bids; at 0.6 nobody does', () => {});
test('ambient: a world without ambientSkyBids takes no draw at dusk', () => {
  // the rngState after runDusk equals the M0 value for the same world
});
test('dance: Bell (threshold 3) starts on the step where her third friend dances, not the second', () => {});
test('dance: the spread counts from the same set, so array order does not matter', () => {});
test('a meeting in the lens adds a lit event naming both creatures and the real behaviors', () => {});
test('empty winter: mushroom, ambient bid, and dance rules on 0 and 1 creatures give no NaN', () => {});
```

The last test is Review Focus 5.

- [ ] **Step 2: Run** and see FAIL.
- [ ] **Step 3: Implement** per ADR 0012 items 4 to 6. Taking a drop happens in `moveCreatures` next to foraging, so it uses the same reach test.
- [ ] **Step 4: Run** `npm test && npm run test:prop`. Expected: PASS, golden hash unchanged.
- [ ] **Step 5: Commit.** `feat(sim): add ambient sky bids, lit events, the dew mushroom, and the festival`

### Task M2.4: Rewind in the worker (sim-host)

**Files:** Modify `src/sim-host/protocol.ts`, `worker-core.ts`, `host.ts`. Test `tests/unit/sim-host/worker-core.test.ts`, `host.test.ts`.

**Interfaces:**
- Produces: `ToWorker` gains `{ t: 'rewind'; tick: number; id: number }`; `FromWorker` gains `{ t: 'rewound'; id: number; tick: number; lite: WorldLite }`. `SimHost.rewind(tick: number): Promise<{ tick: number; lite: WorldLite }>` rejects when the worker fails or restarts first.
- The core keeps a clone of its first world (the created world or the init checkpoint), a clone at each dusk, and every accepted list since init. A rewind clamps `tick` to [first world tick, current tick], clones the latest kept world at or before it, steps it with the logged lists to that tick, and posts `rewound`. The live world, its PRNG state, and pacing do not change (ADR 0012 item 10).

- [ ] **Step 1: Write the failing tests.**

```ts
test('rewound lite at tick T equals the live snapshot at T', () => {}); // golden commands, T = 1,234
test('rewinding does not change the live hash', () => {});
test('a tick past now gives now; a tick before the first world gives the first world', () => {});
test('after a restart from a checkpoint, rewinding earlier gives the checkpoint tick', () => {});
test('host.rewind rejects when the worker errors before answering', () => {});
```

- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(sim-host): rewind to an earlier tick without changing the run`

### Task M2.5: Story verbs, overrides, and the year carry (story)

**Files:** Create `src/story/carry.ts`, `src/story/names.ts`. Modify `src/story/verbs.ts`, `schema.ts`, `scenario.ts`, `chapter-runner.ts`, `src/ui/screens/Game.svelte` (use `displayName`, tray from `WORLD_VERBS`), `src/input/verbs.ts` (`keyboardTools` keeps world verbs only), `src/main.ts` (carry and year log), `src/ui/game-service.ts`, `content/tuning.json`, `src/sim/tuning.ts`. Test `tests/unit/story/carry.test.ts`, `scenario.test.ts`, `chapter-runner.test.ts`, `schema.test.ts`, `tests/unit/sim/tuning.test.ts`.

**Interfaces:**
- Produces in `verbs.ts`: `WORLD_VERBS = ['wake', 'respond', 'place', 'shine', 'whisper', 'thread', 'fog', 'blow'] as const`; `MIND_VERBS = ['peek', 'zoom', 'rewind'] as const`; `VERBS = [...WORLD_VERBS, 'bet', 'listen', ...MIND_VERBS] as const`; `WorldVerb`, `MindVerb`, `Verb`; `VerbInput` adds `{ verb: 'shine'; x; y }`, `{ verb: 'whisper'; target: string; about: string; sign: 1 | -1 }`, `{ verb: 'thread'; a: string; b: string; on: boolean }`, `{ verb: 'fog'; x; y; clear: boolean }`, `{ verb: 'blow'; x; y; dx; dy }`. `place` keeps `{ verb: 'place'; x; y }`.
- Produces in `carry.ts`: `interface Carry { creatures: { id: string; dials: Dials; shell: Shell; skyWarmth: number; away: boolean }[]; ties: { a: string; b: string; ab: number; ba: number }[] }`; `carryFrom(lite: WorldLite): Carry` (ADR 0012 item 1).
- Produces in `names.ts`: `displayName(id: string): string` (`'villager-3'` gives `'Villager 3'`, `'pim'` gives `'Pim'`), moved from `Game.svelte`'s `nameOf`.
- `buildScenario(chapter: Chapter, flags: Flags, base: Scenario, carry?: Carry): Scenario` applies the carry (base creatures only; tie sides with 0 slights), then overrides, then the variant.
- Schema: chapter `carry: boolean`; `place?: { kind: 'bench' | 'bridge' | 'lantern'; limit: number }` (absent means one bench); `when: FlagCondition | FlagCondition[]` (every condition must hold); overrides add `structures?: Structure[]`, `bushes?: Scenario['bushes']` (replaces the base list), `water?: Rect[]`, `ridgeX?: number`, `gone?: string[]` (sets `gone` and `away`), `grudges?: { holder: string; against: string; slights: number }[]`, `danceThreshold?: Record<string, number>`, `mushroom?: { x: number; y: number }`, `ambientSkyBids?: true`, and a `'*'` key in `state` (every creature; named ids win). Beat actions add `{ rumor: { target: string; about: string; sign: 1 | -1 } }` (sends `whisper`) and `{ dance: string }` (sends `dance`). The chapter's `verbs` list at most three world verbs (ADR 0012 item 8).
- Runner: `RUNNER_COMMANDS` adds `shine`, `paintFog`, `blow`, `thread`, `whisper`, `dance`. `fog` sends `paintFog` with `r = fog.brushRadius` (120) and `amount = ±fog.brushAmount` (0.3). `place` sends the chapter's kind, up to its `limit`. A sky bid the runner did not prompt gets the automatic `away` and is not prompted again.
- `type YearLog = { chapterId: string; log: ActionLog }[]` in `action-log.ts`. `GameService.startChapter(chapter, flags)` passes `carryFrom(last snapshot)` when `chapter.carry`; `main.ts` keeps one `YearLog`, pushing each runner's log when `done` settles (a skip included).

- [ ] **Step 1: Write the failing tests.**

```ts
test('carryFrom keeps dials, shell, sky warmth, away, and tie warmths', () => {});
test('buildScenario applies a carry to base creatures only, then overrides win', () => {
  // carry pim opener 0.2, override pim opener 0.9: scenario pim opener is 0.9; a carried 'kith-31' is absent
});
test('a carried chapter keeps Krit away; a fresh chapter does not', () => {});
test('grudges set the holder side slights on the carried tie', () => {});
test("state '*' sets every creature; a named id wins", () => {});
test('when [a, b] needs both conditions', () => {});
test.each([
  [{ verb: 'shine', x: 10, y: 20 }, { t: 'shine', x: 10, y: 20 }],
  [{ verb: 'fog', x: 1, y: 2, clear: true }, { t: 'paintFog', x: 1, y: 2, r: 120, amount: -0.3 }],
  [{ verb: 'thread', a: 'pim', b: 'echo', on: false }, { t: 'thread', a: 'pim', b: 'echo', on: false }],
])('verb %o sends %o', () => {});
test('place sends the chapter kind and stops at its limit', () => {}); // bridge, limit 2: third returns false
test('an ambient sky bid gets away after 6 s and is not prompted again', () => {});
test('a beat rumor sends one whisper; a beat dance sends one dance', () => {});
test('a chapter listing four world verbs fails the schema', () => {});
```

- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** Update ch0 to ch3 configs to set `carry: false`, and add `peek` and `zoom` to ch2 and ch3 (spec 8 teaches them in chapter 2). **Step 4: Run** `npm test && npm run typecheck && npm run validate-content`. Expected: PASS; the ch2 and ch3 T3 runs are unchanged, since fresh chapters build the same scenario.
- [ ] **Step 5: Commit.** `feat(story): add Part 1 verbs, overrides, and the year carry`

### Task M2.6: Twists, flags, activities, the year log, diaries, and margin notes (story)

**Files:** Create `src/story/diary.ts`, `content/diary.json`. Modify `src/story/schema.ts`, `flags.ts`, `twists.ts`, `bets.ts`, `action-log.ts`, `chapter-runner.ts`, `src/sim/metrics.ts` (the `MetricSpec` type), `content/flags.json`, `content/ink/main.ink` (VARs), `content/chapters/ch0.json` to `ch3.json` (notes as objects), `tools/content-validate/validate.ts` (diary), `src/ui/components/Drawer.svelte` (render a note's fields), `src/ui/screens/Game.svelte` (the heading reads `Chapter n: Title` with `n` from the id `ch<n>`, and `Interlude: Title` for an interlude). Test `tests/unit/story/twists.test.ts`, `bets.test.ts`, `chapter-runner.test.ts`, `schema.test.ts`, `tests/unit/story/diary.test.ts`.

**Interfaces:**
- Flags add, with these skip defaults (spec P3): `litConflict: 0.3`, `rumorStuck: false`, `echoForgiveness: 0.5`, `wispPushed: true`, `mossShared: true`, `winterLeft: 0`, `bellDanced: true`, `festivalShare: 0.6`, `greetingSong: 0`. `main.ink` declares each as a VAR.
- `TwistId` adds `'thornsGrow'` (mean tightness of creatures not away rose by at least 0.03 since `before`), `'rumorDrowns'` (`rumor.holders` are at least half of the creatures not away, `about` left out), `'revengeLoop'` (both warmths of the echo and krit tie are below 0), `'wispLeaves'` (Wisp is away), `'mossShares'` (a `gift` event from moss to krit with move `give`), `'bellDances'` (Bell is dancing).
- `MetricSpec` adds `{ kind: 'maxShell'; shell: keyof Shell }`, `{ kind: 'rumorShare' }`, `{ kind: 'warmth'; from: string; to: string }` (0 with no tie), `{ kind: 'awayCount' }`. The bet gains `buckets?: number[]`: required for the three numeric kinds (length = options − 1), forbidden for `maxBerries` and `maxShell`. `measureBet` returns the option at index "count of buckets at or below the value" (ADR 0012 item 14).
- `LogEntry` adds `{ kind: 'event'; tick: number; e: SimEvent }` for the kinds in `YEAR_EVENTS = ['lit', 'arrive', 'leave', 'return', 'dance', 'mushroom']`, and `{ kind: 'activity'; tick: number; activity: Activity; result: string }`.
- Schema: `kind: 'chapter' | 'interlude'`; `activity?: Activity` with `type Activity = 'rhythm' | 'telephone' | 'bubbles' | 'postcard' | 'stillness' | 'fire'`; beat trigger `{ activity: true }`; beat action `{ show: 'heatmap' }`; `diary?: Record<string, string[]>` (authored lines, such as Krit's hunger in chapter 5); `notes: Note[]` with `Note = { title, science, limits, counter, question, sources: { label: string; url: string }[] }` (ADR 0012 item 13): 2 to 4 for a chapter, 0 to 4 for an interlude.
- Runner adds: `finishActivity(result: string): boolean` (false without an activity or after the first call; logs the entry and runs `{ activity: true }` beats); `onShow(cb: (what: 'heatmap') => void): () => void`; `diary(id: string): readonly string[]` (the chapter's authored lines, then the last 20 bid, gift, leave, return, and dance events that name `id`, as text from `content/diary.json` with `{other}` filled by `displayName`).
- `FLAG_SOURCES` take `(lite, twistFired, log)`: `litConflict` is the share of this chapter's `lit` events with `against` or `keep`; `rumorStuck`, `wispPushed`, `mossShared` are `twistFired`; `echoForgiveness` is Echo's dial; `winterLeft` counts `leave` events; `bellDanced` reads Bell's `dancing`; `festivalShare` is the dancing share of creatures not away; `greetingSong` is `Number` of the activity result.

- [ ] **Step 1: Write the failing tests.** One true and one false hand-built input per new twist. Then:

```ts
test('a bucket bet answers the option whose bucket holds the value', () => {
  expect(measureBet({ kind: 'rumorShare' }, liteWith(0.5), ['few', 'half', 'most'], [0.25, 0.5])).toBe('most');
  expect(measureBet({ kind: 'warmth', from: 'echo', to: 'krit' }, liteWarmth(-0.1), ['no', 'yes'], [0])).toBe('no');
});
test('lit, leave, and dance events go in the log; bid events do not', () => {});
test('finishActivity logs once, runs the activity beat, and returns false the second time', () => {});
test('litConflict is 2/3 after three lit meetings, two with a keep', () => {});
test("Krit's diary starts with the chapter's authored line, then a line that names Echo for Echo's gift", () => {});
test('a diary keeps the last 20 events', () => {});
test('a note without a source fails the schema; an interlude with no notes passes', () => {});
```

- [ ] **Step 2: Run** and see FAIL. **Step 3: Implement.** Every text value in `content/diary.json` and every note field starts with `[PLACEHOLDER] ` (ADR 0010). The diary keys are `bid.<seenAs>`, `gift.gave.<own move>`, `gift.got.<seenAs>`, `leave`, `return`, and `dance`; at least one template holds a mixed feeling (spec 10.5). **Step 4: Run** `npm test && npm run validate-content`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat(story): add Part 1 twists, flags, activities, diaries, and notes`

### Task M2.7: The myth (myth)

**Files:** Create `src/myth/features.ts`, `src/myth/grammar.ts`, `content/myth/verses.json`. Modify `tools/content-validate/validate.ts`. Test `tests/unit/myth/features.test.ts`, `tests/unit/myth/grammar.test.ts`, `tests/unit/myth/t6.test.ts`, `tests/unit/myth/random-year.ts`.

**Interfaces:**
- Consumes (types only): `YearLog`, `Flags`, `VerbInput`.
- Produces in `features.ts`: `interface MythFeatures { lightOnConflict: number; lightOnKindness: number; rumbles: number; fogPainted: number; gusts: number; welcomes: number; mostLit: string | null; winterLeft: number; mossShared: boolean; bellDanced: boolean; festivalShare: number; wispPushed: boolean; narrator: string }`; `extractFeatures(year: YearLog, flags: Flags, skyWarmth: Readonly<Record<string, number>>): MythFeatures`. Shares count `lit` events (a meeting can count toward both); 0 with none. `rumbles` counts `respond` verbs with `against`; `fogPainted` is the sum of π × `fog.brushRadius`² × `fog.brushAmount` over `fog` verbs with `clear: false`, divided by the scene area (all from `content/tuning.json`); `gusts` counts `blow` verbs; `welcomes` counts `arrive` events; `mostLit` is the id in most `lit` events, a tie to the lower id; `narrator` is the highest sky warmth, a tie to the lower id, `'pim'` with no creatures. The rest come from flags.
- Produces in `grammar.ts`: `VersesSchema` (exactly five verses in spec order with ids `waking`, `eye`, `moods`, `winter`, `asking` and titles "The Waking", "The Sky's Eye", "The Sky's Moods", "The Long Winter", "The Asking"; 6 to 8 templates each; a template is `{ when: { feature: keyof MythFeatures; op: 'eq' | 'gte' | 'lte'; value: number | boolean | string }[]; text: string; note?: string }`; the last template's `when` is `[]`; slots are only `{narrator}`, `{mostLit}`, `{rumbles}`, `{gusts}`, `{welcomes}`, `{winterLeft}`); `type Verses`; `interface MythPage { narrator: string; verses: { title: string; text: string; note: string | null }[] }`; `tellMyth(f: MythFeatures, verses: Verses, name: (id: string) => string): MythPage` (the first template whose every condition holds; spec 10.6 items 3 to 5).
- Produces in `random-year.ts` (test only): `randomYear(rng: Rng): { year: YearLog; flags: Flags; skyWarmth: Record<string, number> }`: per chapter id, 0 to 12 random verbs of the chapter's world verbs, 0 to 40 `lit` events over random pairs of the 30 m0 ids with random behaviors, 0 to 3 `arrive` events, random flags of the right types, and random sky warmths (ADR 0012 item 11).

- [ ] **Step 1: Write the failing tests.**

```ts
test('features from a hand-built year', () => {
  expect(extractFeatures(year, flags, { pim: 0.4, krit: 0.6 })).toMatchObject({
    lightOnConflict: 0.5, rumbles: 2, gusts: 1, welcomes: 1, mostLit: 'krit', narrator: 'krit',
  });
});
test('an all-skipped year gives five whole verses with no open slot', () => {
  const page = tellMyth(extractFeatures([], defaultFlags, {}), verses, displayName);
  expect(page.verses).toHaveLength(5);
  for (const v of page.verses) expect(v.text).not.toMatch(/\{|undefined|null/);
});
test('fog near fights reads as the sky sulking, with a margin note', () => {
  // fogPainted 0.2, lightOnConflict 0.6: the moods verse has a non-null note
});
test('a template with an unknown slot or a verse with 5 templates fails the schema', () => {});
test('T6: at least 900 of 1,000 random years give different myths', () => {
  const rng = createRng(6);
  const texts = new Set<string>();
  for (let i = 0; i < 1000; i++) { const r = randomYear(rng); texts.add(JSON.stringify(tellMyth(extractFeatures(r.year, r.flags, r.skyWarmth), verses, displayName).verses)); }
  expect(texts.size).toBeGreaterThanOrEqual(900);
});
```

The second test is Review Focus 2.

- [ ] **Step 2: Run** and see FAIL.
- [ ] **Step 3: Implement.** Write `verses.json` with 6 to 8 templates per verse, every text starting with `[PLACEHOLDER] `, conditions over every feature, at least two misreading templates with notes, and templates that name the narrator in its own voice (conditions on `narrator`). Add the schema check to `validate.ts`.
- [ ] **Step 4: Run** `npm test && npm run validate-content`. Expected: PASS, with the T6 count printed.
- [ ] **Step 5: Commit.** `feat(myth): add features, the verse grammar, and placeholder templates (T6)`

### Task M2.8: Chapters 4 to 7 and their T3 runs (content)

**Files:** Create `content/chapters/ch4.json` to `ch7.json`, `i3.json`, `i4.json`, `i5.json`, `content/ink/ch4.ink` to `ch7.ink`, `i3.ink`, `i4.ink`, `i5.ink`, `tests/golden/players.ts`, `tests/golden/year.ts`, `tests/golden/carry.test.ts`, `tests/golden/carry/*.json`, `tests/golden/ch4.test.ts` to `ch7.test.ts`. Modify `content/ink/main.ink` (INCLUDEs), `tests/golden/run-chapter.ts`, `ch2.test.ts`, `ch3.test.ts`, `ch3-control.test.ts` (players move to `players.ts`), `src/main.ts` (the chapter list in `CHAPTER_ORDER` order), `tests/e2e/slice.spec.ts` (the slice runs now end when the heading "Interlude: The Door for Two" shows).

**Interfaces:**
- `runChapterHeadless(config, seed, player, flags, stopAfterTicks?, carry?: Carry): Promise<HeadlessResult>`; `HeadlessResult` gains `last: WorldLite`, `flags: Flags`, `log: ActionLog`, and `twistFired` becomes `boolean | null` (null for a chapter without a twist).
- `PLAYERS: Record<string, () => ScriptedPlayer>` in `players.ts`; `CHAPTER_ORDER = ['ch0', 'ch1', 'ch2', 'ch3', 'i3', 'ch4', 'i4', 'ch5', 'i5', 'ch6', 'ch7', 'i7', 'ch8', 'i8', 'ch9', 'ch10']`; `runYear(seed: number, upTo: string): Promise<{ results: Record<string, HeadlessResult>; carries: Record<string, Carry> }>` in `year.ts` (starts at ch3 with default flags, passes each result's flags on, and gives a chapter with `carry: true` the carry from the result before it).
- `carry.test.ts` (t3 project) runs `runYear(1, …)` and checks each stored carry with `toMatchFileSnapshot('carry/<id>.json')`; T3 tests read those files.

Chapters (each config sets `carry: true`, the bench from chapter 3 under the crooked tree in `structures`, and `ambientSkyBids`; Ink lines one sentence per beat with `#placeholder`; 2 to 4 placeholder notes):

| Id | Season, day | Verbs (tray first) | Bet | Twist, window, retry | Writes | Scripted player |
| --- | --- | --- | --- | --- | --- | --- |
| i3 The Door for Two | spring, 600 s | none; activity `rhythm` | none | none | `greetingSong` | finishes with `'0'` |
| ch4 The Long Gaze | summer, 40 s | shine, respond, bet, peek, zoom | "Where will the thorns grow?" `maxShell` tightness over the six named, 4 days | `thornsGrow`, 6 days, krit and echo; the twist beat has `show: heatmap` | `litConflict` | shines on Krit every 40 ticks; answers the first option |
| i4 The Telephone Sketch | summer, 600 s | activity `telephone` | none | none | none | finishes |
| ch5 The Rumor | lateSummer, 40 s | whisper, thread, respond, bet, peek, zoom | "How many will believe it?" `rumorShare`, buckets [0.25, 0.5], options few, half, most, 4 days | `rumorDrowns`, 6 days, echo and pim; a beat at 2 s has `rumor` echo about krit, −1; the twist beat says who got hurt (spec 19.2) | `rumorStuck` | threads Echo to Pim and to six villagers on its first tick |
| i5 Dream Bubbles | lateSummer, 600 s | activity `bubbles`; `state` `'*'` sleep | none | none | none | finishes |
| ch6 Fog | autumn, 40 s | fog, place (lantern, limit 2), respond, bet, rewind, peek, zoom | "Will Echo forgive Krit in this fog?" `warmth` echo to krit, buckets [0], options no, yes, 3 days | `revengeLoop`, 5 days, echo and krit | `echoForgiveness` | paints fog three times at the Echo and Krit midpoint |
| ch7 Wind | autumn, 40 s | blow, respond, rewind, peek, zoom | none | `wispLeaves`, 4 days, wisp and pim; `ridgeX` 1500; Wisp starts at (1300, 300) | `wispPushed` | blows from Wisp by (400, 0) on its first tick |

The `newVerb` is the first tray verb of ch4 to ch7. Krit's authored diary line in ch5 tells of last winter's hunger (spec 6.2).

- [ ] **Step 1: Write the T3 tests** in the M1.11 form, one file per chapter: 200 seeds from the stored carry, the chapter's scripted player, default flags; `expect(closeCalls).toBeLessThan(10)`. Move the ch2 and ch3 players into `players.ts` unchanged.
- [ ] **Step 2: Write the configs, Ink, and players, then run** `npx vitest run --project t3 tests/golden/carry.test.ts -u` once to write the carries, and `npm run test:t3`. If a chapter fails, change only its overrides or tuning, never its twist check (M1.11), and record a tuning change in ADR 0012.
- [ ] **Step 3: Run** `npm test && npm run validate-content && npm run test:e2e -- tests/e2e/slice.spec.ts`. Expected: PASS, every knot a config names exists.
- [ ] **Step 4: Commit.** `feat(content): add chapters 4 to 7 and interludes 3 to 5 with T3 runs`

### Task M2.9: Chapters 8 to 10, the last interludes, and their T3 runs (content)

**Files:** Create `content/chapters/ch8.json`, `ch9.json`, `ch10.json`, `i7.json`, `i8.json`, their Ink files, `tests/golden/ch8.test.ts`, `ch9.test.ts`, `ch10.test.ts`, `ch9-control.test.ts`. Modify `main.ink`, `players.ts`, `src/main.ts`.

Every config from ch8 on lists `gone: ["wisp"]`. ch8 and ch9 set `ambientSkyBids`.

| Id | Season, day | Verbs | Key overrides | Bet | Twist, window, retry | Writes | Scripted player |
| --- | --- | --- | --- | --- | --- | --- | --- |
| i7 Wisp's Postcard | autumn, 600 s | activity `postcard` | none | none | none | none | finishes |
| ch8 The Dew Mushroom | winter, 40 s | respond, bet, rewind, peek, zoom; `newVerb` null | `bushes: []`, `mushroom` (800, 600), grudge moss against krit, 1 slight (ADR 0012 item 7); variant `when` [`litConflict` gte 0.5, `rumorStuck` eq true] sets Krit away (spec P6) | "How many will leave this winter?" `awayCount`, buckets [1.5, 4.5], options none, few, many, 6 days (Wisp counts as away) | `mossShares`, 8 days, moss and krit | `mossShared`, `winterLeft` | answers the first option, nothing else |
| i8 The Long Night | winter, 600 s | activity `stillness` | none | none | none | none | finishes |
| ch9 Seed and Dance | thaw, 40 s | place (bridge, limit 2), respond, zoom, peek; `newVerb` null | `water` [{ x 780, y 0, w 60, h 900 }], `danceThreshold` bell 3; a beat at day 1 has `dance: pim` | none | `bellDances`, 4 days, bell and pim | `bellDanced`, `festivalShare` | places bridges at (810, 300) and (810, 600) |
| ch10 The Sky Story | thaw, 60 s | listen; activity `fire` | the water from ch9 | none | none; the `{ activity: true }` beat plays `ch10_ask` (the creatures ask the sky to find Wisp), and the exit is that beat | none | finishes with `'heard'` |

- [ ] **Step 1: Write the T3 tests:** ch8 and ch9 in the M2.8 form. ch10: in all 200 seeds the runner reaches its exit. `ch9-control.test.ts`: from an empty carry (no ties), `bellDances` fires in at most 20 of 200 seeds in its first window, so earlier choices really decide (spec 6.2), in the form of `ch3-control.test.ts`.
- [ ] **Step 2: Write the configs, Ink, and players; run** the carry update and `npm run test:t3`, calibrating as in M2.8.
- [ ] **Step 3: Add a myth check** to `tests/golden/carry.test.ts`: the seed-1 year log through ch9 gives `tellMyth` five verses with no open slot (ADR 0012 item 11).
- [ ] **Step 4: Run** `npm test && npm run validate-content`. **Step 5: Commit.** `feat(content): add chapters 8 to 10 and interludes 7 and 8 with T3 runs`

### Task M2.10: Meadow additions: dash fog, land, seasons, and the heat map (render)

**Files:** Create `content/palettes/summer.json`, `lateSummer.json`, `autumn.json`, `winter.json`, `thaw.json`. Modify `src/render/palette.ts`, `content/palettes/spring.json`, `src/render/line/strip.ts`, `line-view.ts`, `meadow-view.ts`, `src/main.ts`, `src/ui/game-service.ts`. Test `tests/unit/render/strip.test.ts`, `meadow-view.test.ts`, `tests/visual/meadow.spec.ts`.

**Interfaces:**
- `PaletteSchema` adds `water: Hex` and `full: Hex[]` (six colors for the Soul view). Accents from spec 11.3: summer gold, late summer violet, autumn blue-grey, winter ember red, thaw spring green, each safe for color blindness and never used for text.
- `dashMask(i: number, fog: number): 0 | 1` in `strip.ts`: 1 for every point when `fog < 0.25`; otherwise runs of `max(2, round(12 × (1 − fog)))` points alternate 1 and 0, starting with 1. `createLineView(...).update` takes `fog: number` and multiplies the width by `dashMask` (spec 11.3; deferred from M1.6).
- `MeadowView` adds `setPalette(p: Palette): void` and `showHeatmap(on: boolean): void`. It draws the water in `palette.water`, bridges as planks across it, lanterns as small warm glows, the mushroom with one dot per drop, and a small hop for dancing creatures (none with reduced motion). The heat map counts the lens center over a 16 × 9 grid from every snapshot of the chapter and draws each cell's share as an ink wash.
- `Stage` adds `setSeason(season: Season): void` and `showHeatmap(on: boolean): void`. `Game.svelte` calls `stage.setSeason(chapter.season)` at each chapter start and turns the heat map on from `runner.onShow`.

- [ ] **Step 1: Write the failing tests:** `dashMask` is all 1 at fog 0.2; at fog 0.5 it reads 1 × 6, 0 × 6, 1 × 6; a lite with water, a bridge, a lantern, and a mushroom adds no draw call per creature (the call count rises by at most 4); the heat map cell under a lens held for 10 snapshots has the largest share. Visual: add `meadow-thaw.png` at a fixed tick with the brook, two bridges, and a dancing Bell. The user approves the new baseline before it is committed; the M1 baselines must not change.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(render): add dash fog, land, season palettes, and the heat map`

### Task M2.11: Cosmos and Soul views and zoom (render, input)

**Files:** Create `src/render/cosmos-view.ts`, `src/render/soul-view.ts`, `src/render/timeline.ts`, `src/input/zoom.ts`. Modify `src/main.ts`, `src/ui/game-service.ts`. Test `tests/unit/render/cosmos.test.ts`, `soul.test.ts`, `timeline.test.ts`, `tests/unit/input/zoom.test.ts`.

**Interfaces:**
- `type ViewName = 'cosmos' | 'meadow' | 'soul'`; `nextView(current: ViewName, dir: 'in' | 'out', picked: string | null): ViewName` (out: soul to meadow to cosmos; in: cosmos to meadow, meadow to soul only with a pick).
- `cosmosEdges(lite: WorldLite, threshold: number): { a: string; b: string; kind: 'friend' | 'scar'; warmth: number }[]`: a friend when both warmths are above the threshold, a scar when either is below 0, neither otherwise (left out); creatures away are left out.
- `soulLayout(lite: WorldLite, id: string, threshold: number): { id: string; x: number; y: number; kind: 'friend' | 'scar' | 'met' }[]`: every creature with a tie to `id`, at angles in id order, at a distance that falls as `id`'s warmth toward it rises.
- `interface TimelinePoint { tick: number; population: number; trust: number }`; `sampleTimeline(points: TimelinePoint[], tick: number, lite: WorldLite, every: number): void` (adds a point when `tick` is at least `every` past the last); `friendshipBreaks(prev: WorldLite, next: WorldLite, threshold: number): { a: string; b: string }[]` (ties whose two-sided friendship ended).
- `createCosmosView(app, palette, threshold)` and `createSoulView(app, palette, rigs, threshold)` each return `{ container; update(lite, settings, …): void; pick(x, y): string | null }`. Cosmos fades the meadow to 25% and snaps its pick to the nearest node within 44 screen pixels (spec 12.4). Soul draws in `palette.full` (spec 11.3: full color, for the first time).
- `Stage` adds `setView(view: ViewName, soul: string | null): void`, `snapshot(tick: number, lite: WorldLite): void` (feeds the timeline and the break marks), `timeline(): { points: readonly TimelinePoint[]; breaks: readonly number[] }`. `pick` uses the current view. `GameService.onSnapshot` passes `(lite, tick)`.

- [ ] **Step 1: Write the failing tests:** `nextView` for every pair; `cosmosEdges` on a hand-built lite (a friend, a scar, a plain tie left out, an away creature left out); `soulLayout` puts a warmth 0.9 creature nearer than a warmth 0.1 one and leaves out creatures with no tie; `sampleTimeline` adds one point per `every` ticks; `friendshipBreaks` names a pair that falls from 0.5 to 0.2; Cosmos `pick` returns a node 40 pixels away and `null` at 50; Soul on a creature with no ties draws only the center (Review Focus 5).
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(render): add the Cosmos and Soul views and zoom`

### Task M2.12: Part 1 tools in input and the tray (input, ui)

**Files:** Modify `src/input/keyboard.ts`, `pointer.ts`, `verbs.ts`, `src/ui/components/ToolTray.svelte`, `src/ui/screens/Game.svelte`. Create `src/ui/components/WhisperCard.svelte`. Test `tests/unit/input/input.test.ts`, `tests/e2e/a11y.spec.ts` (whisper card).

**Interfaces:**
- `InputContext` adds `view(): ViewName`, `zoom(dir: 'in' | 'out'): void`, `water(): readonly Rect[]`, `isFriend(a: string, b: string): boolean`, `threadFrom(): string | null`, `setThreadFrom(id: string | null): void`, `openWhisper(target: string): void`.
- `snapToWater(p: Point, water: readonly Rect[]): Point | null` (the point clamped into the nearest rectangle; null with none).
- Keyboard: Z zooms out and X in (when `zoom` is unlocked); Enter acts with the tool: shine at the cursor, fog paints at the cursor and Shift+Enter clears, blow sends a gust of 300 units from the cursor in the last arrow direction (east before any arrow), place snaps a bench to a bench spot, a bridge into water, and sets a lantern at the cursor, whisper opens the card for the picked creature, thread marks the picked creature and a second Enter on another sends `on: !isFriend(a, b)` (Escape clears the mark).
- Pointer: a click acts as Enter at that point; a drag of at least 40 pixels with blow sends the drag as the gust; with thread in Cosmos a drag from one node to another sends a thread, and a drag that ends on its start or on no node sends nothing; the wheel zooms (one step per 300 ms); two pointers that spread past 1.25 times their start distance zoom in, and closer than 0.8 zoom out, once per gesture.
- Tray labels: Sunlight, Whisper, Thread, Fog, Wind, and Bench, Bridge, or Lantern by the chapter's place kind. Each new tray verb gets one `[PLACEHOLDER]` hint line (spec 12.6), also when a chapter teaches two (P1's chapter 5 exception).
- `WhisperCard`: a modal dialog, "Whisper about whom?" with one button per named creature other than the target, then Kind or Unkind; Escape cancels.

- [ ] **Step 1: Write the failing tests:** each key and gesture above maps to its `VerbInput` or zoom; a bridge Enter with no water sends nothing; a thread drag ending on the start node, on empty space, or on an away creature sends nothing (Review Focus 4); pinch fires once per gesture; axe finds no serious issue with the whisper card open.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(input): add Part 1 tools, threads with snapping, and zoom gestures`

### Task M2.13: Mind verbs on screen: Cosmos panel, rewind, peek, diary (ui, story)

**Files:** Create `src/story/peek.ts`, `src/ui/components/CosmosPanel.svelte`. Modify `src/ui/components/Drawer.svelte`, `src/ui/screens/Game.svelte`, `src/ui/game-service.ts`, `src/main.ts`. Test `tests/unit/story/peek.test.ts`, `tests/e2e/a11y.spec.ts`.

**Interfaces:**
- `peekRule(dials: Dials, season: Season): { payoff: { cost: number; value: number }; lines: string[] }`: the payoff from tuning (cost 1, value 3, or 2 in winter) and three lines with the creature's numbers, from spec 9.3: the first-meeting give chance (its Opener), the slights it forgives (`round(3 × Forgiveness)`), and its slight half-life (`1 + 29 × Memory` days).
- `GameService.rewind(tick: number): Promise<WorldLite>` (from `SimHost.rewind`).
- `CosmosPanel` (shown in the Cosmos view): an HTML list of creatures not away, each "Name: n friends, m scars", plus, during the rumor, "imagines k of n friends believe it" (spec 6.2's pond reflection, from `lite.rumor` and the ties); and, when `rewind` is unlocked, a range input labelled "Rewind" from the chapter's first tick to now, with the break ticks as a `datalist`, and a "Back to now" button. Moving the range pauses the sim, asks for that tick (only the newest request is drawn), and draws the rewound lite; verbs do nothing until "Back to now", which restores the speed. The range is disabled while a bet runs.
- `Drawer` gains `diary: { name: string; lines: readonly string[]; dials: Dials; peek: ReturnType<typeof peekRule> | null } | null`: sections Diary, Dials, Under the hood (when `peek` is unlocked), and Margin notes. P opens the drawer at Under the hood for the picked creature. The Soul view opens the drawer at Diary.

- [ ] **Step 1: Write the failing tests:** `peekRule` gives "forgives 2 slights" at Forgiveness 0.5 and a winter value of 2; axe finds no serious issue in the Cosmos view with the panel and in the Soul view with the drawer open; e2e on `?chapter=9` (ch6): the rewind range moves, the sim speed is 0, verbs send nothing, and "Back to now" restores the speed.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(ui): add the Cosmos panel, rewind, peek, and the diary drawer`

### Task M2.14: Interludes and the fire (ui, input)

**Files:** Create `src/ui/interludes/activities.ts`, `Rhythm.svelte`, `Telephone.svelte`, `Bubbles.svelte`, `Postcard.svelte`, `Stillness.svelte`, `src/ui/components/MythScroll.svelte`, `src/input/hold-still.ts`. Modify `src/ui/screens/Game.svelte`, `src/ui/game-service.ts`, `src/main.ts`, `src/audio/event-sounds.ts`. Test `tests/unit/ui/activities.test.ts`, `tests/unit/input/hold-still.test.ts`, `tests/e2e/a11y.spec.ts`.

**Interfaces:**
- `activities.ts`: `RHYTHMS: readonly (readonly number[])[]` (four 4-beat patterns); `sharedRhythm(left: readonly number[], right: readonly number[]): number` (the one index both sides accept); `copySketch(points: readonly number[], generation: number): number[]` (each copy moves each point by a fixed hash of `(generation, index)` up to 3 units, so drift adds up; spec 6.4); `traceProgress(path: readonly number[], visited: readonly number[], tolerance: number): number` (share of path points within `tolerance` of a visited point); `poppable(id: string): boolean` (false for moss; spec 6.4).
- `createHoldStill(clock: () => number): { move(x: number, y: number): void; held(): number }`: seconds since the cursor last moved more than 4 pixels.
- Each activity component takes `{ lite: WorldLite; finish: (result: string) => void }` and uses real buttons: Rhythm shows the four patterns as "Tap rhythm n" and finishes with the shared index; Telephone has "Pass it on" six times; Bubbles has "Pop Name's bubble" for each sleeper with a scar (Moss's wobbles and stays) and finishes when only Moss's is left; Postcard traces the path with the pointer or one Enter per segment and finishes at 0.9 progress (the path spells "home"); Stillness finishes after 5 seconds held still. `Game.svelte` shows the activity in place of the tool tray and calls `runner.finishActivity`.
- `MythScroll` takes `{ page: MythPage; finish: () => void }`: a heading "The Sky Story, told by {narrator}", one verse at a time in an `aria-live="polite"` region, a Listen button (Enter) for the next verse, the verse's note behind a "What the sky did" toggle, and `finish` after the last verse. `GameService.myth(flags: Flags): MythPage` builds it from the year log, the flags, and the last snapshot's sky warmths.
- Audio: a `toward` bid plays its harmony in the `greetingSong` rhythm (spec 6.4).

- [ ] **Step 1: Write the failing tests:** `sharedRhythm` finds the one shared index; `copySketch` of generation 6 differs from generation 0 more than generation 1 does; `traceProgress` is 1 for the path itself and 0 far away; `poppable('moss')` is false; `held()` grows while still and resets on a 5-pixel move; axe finds no serious issue on each activity and on the myth scroll; e2e on `?chapter=15` (ch10): Listen five times shows five verses and ends Part 1.
- [ ] **Step 2–4.** **Step 5: Commit.** `feat(ui): add the five interludes and the fireside myth`

### Task M2.15: Saves with the year log, the *Book of Skies*, and the Quiet Visitor (persist, ui, input, render)

**Files:** Create `src/persist/profile.ts`, `src/ui/screens/BookOfSkies.svelte`, `src/input/wait.ts`, `content/placeholder/PLACEHOLDER-visitor.svg`, `content/rigs/PLACEHOLDER-visitor.rig.json`. Modify `src/persist/format.ts`, `migrations.ts`, `slots.ts`, `src/render/meadow-view.ts`, `src/ui/App.svelte`, `Title.svelte`, `Game.svelte`, `game-service.ts`, `src/main.ts`. Test `tests/unit/persist/slots.test.ts`, `tests/unit/persist/profile.test.ts`, `tests/unit/input/wait.test.ts`, `tests/e2e/a11y.spec.ts`.

**Interfaces:**
- `SaveV2 = Omit<SaveV1, 'version' | 'log'> & { version: 2; year: YearLog }` (the year so far, at the chapter start; spec 15.1). `migrate(raw: unknown): SaveV2`: a version 1 save gets `year: []`, drops `log`, and fills missing flags from `content/flags.json`.
- `interface BookPage extends MythPage { year: number; seed: number }`; `createProfile(factory: IDBFactory): Promise<{ pages(): Promise<BookPage[]>; keepMyth(page: MythPage, seed: number): Promise<BookPage>; feathers(): Promise<number>; addFeather(): Promise<number> }`, stored under the key `profile` in the save database. Blocked storage gives an in-memory profile.
- `createWait(ms: number, timer: HintTimer): { activity(): void; onVisit(cb: () => void): () => void; dispose(): void }`: fires once after `ms` (180,000) with no activity, then not again until `activity()` and another full `ms` (ADR 0012 item 12).
- `MeadowView.visitor(): Promise<void>`: the visitor walks in from the gate to the nearest bench (or bench spot), sits 20 seconds, leaves a feather, and walks out; reduced motion shows it seated, then gone.
- `GameService` adds `book(): Promise<BookPage[]>`, `keepMyth(page: MythPage): Promise<void>`, `addFeather(): Promise<number>`, `input.createWait()`. The title's *Book of Skies* button is enabled with at least one page; B opens the book in the game as a modal dialog with the sim paused. After ch10 the end screen reads "End of Part 1" with "Open the Book of Skies" and "Back to title".
- `BookOfSkies`: one `article` per page with a "Year n" heading, the narrator, each verse as a heading and paragraph, and its note as an `aside`; the feather count; a Back button.

- [ ] **Step 1: Write the failing tests:**

```ts
test('a v2 save keeps the year log through save and load', async () => {});
test('a v1 save migrates with an empty year and the new flags at their defaults', () => {});
test('Continue in chapter 7 gives a myth built from chapters 0 to 6', async () => {
  // save at ch7 start with a year log holding 3 rumbles; load; myth features show rumbles 3
});
test('keepMyth numbers pages from year 1; pages survive a new profile on the same database', async () => {});
test('wait fires once after 180 s idle, and again only after activity and 180 s more', () => {});
```

Add axe checks for the *Book of Skies* on the title and in the game. The third test is Review Focus 1.

- [ ] **Step 2–4.** **Step 5: Commit.** `feat(persist): keep the year log and myths; add the Book of Skies and the Quiet Visitor`

### Task M2.16: End of Part 1 and the M2 exit check (e2e)

**Files:** Create `tests/e2e/part1.spec.ts`. Modify `tests/e2e/a11y.spec.ts`.

- [ ] **Step 1: Write the tests.** The auto-player from `slice.spec.ts`, extended: it answers every bet with its last option; with Sunlight it clicks the scene's middle once a day; with Whisper it whispers unkindly about Krit; with Thread it drags between the first two nodes; with Fog and Wind it clicks or drags once; with Bridge or Lantern it clicks the scene's middle row; in each interlude it presses the activity's buttons (or waits 6 seconds for Stillness); at the fire it presses Listen until the end. A keyboard-only run does the same with keys only. Both run in Chromium only, at `?fast=10` from Begin with a 1,200-second timeout, end on "End of Part 1" with focus on it, see no page error, and find the *Book of Skies* enabled on the title. axe runs on each chapter's first screen, the Cosmos and Soul views, an open bet, and the book.
- [ ] **Step 2: Run** `npm run lint && npm run typecheck && npm test && npm run test:prop && npm run test:t3 && npm run validate-content && npx vite build --mode development && npm run test:e2e`. Expected: all pass; record the T3 close-call counts, the T6 distinct count, and the T4 shares.
- [ ] **Step 3:** Run superpowers:verification-before-completion, then superpowers:requesting-code-review on the M2 commits. Fix findings.
- [ ] **Step 4:** Report to the user: the test summary, the numbers from Step 2, the golden hash (still `c29d2fa4dbda4dcf`), and the content still marked placeholder.
- [ ] **Step 5: Commit.** `test(e2e): play Part 1 to its end`

### M2 Review Focus

1. **Continue mid-year.** A player who closes the tab in autumn and presses Continue expects the myth to remember spring and summer. Owner: M2.15, "Continue in chapter 7 gives a myth built from chapters 0 to 6".
2. **Skipping.** A player who skips every chapter still hears a whole myth, with no empty verse or raw slot. Owner: M2.7, "an all-skipped year gives five whole verses with no open slot".
3. **A brook with no bridge.** A player who never places a bridge must not see creatures walk on water, freeze, or vanish. Owner: M2.2, "a creature never stands in water away from a bridge".
4. **Threads by finger.** On a phone, a thread drag that ends between nodes or back on its start must do nothing, not cut a friendship. Owner: M2.12, the thread drag test.
5. **An empty winter.** If most of the village leaves, the mushroom, the dance, the views, and the myth must still work with 0 or 1 creature. Owner: M2.3, "empty winter", and M2.11, Soul with no ties.

### M2 pre-flight scan

Pairs of tasks that touch the same file or interface. Each runs after the one before it; the later task adds to what the earlier one made and changes no earlier name.

| Tasks | Shared file or interface | How they stay consistent |
| --- | --- | --- |
| M2.1, M2.2, M2.3 | `sim/types.ts`, `world.ts`, `lite.ts`, `protocol.ts`, `arbitraries.ts` | Each adds optional fields and union members only; each runs the golden hash test. |
| M2.2, M2.3 | `move.ts`, `step.ts`, `commands.ts` | M2.2 adds water steering and `crossRidge`; M2.3 adds drop taking and `spreadDance` after meetings. Step order: commands, movement, `crossRidge`, meetings, dance, light, gusts, dusk. |
| M2.3, M2.6 | `SimEvent` `lit`, `dance`, `mushroom`; `YEAR_EVENTS` | M2.6 lists exactly the M2.3 kinds plus `arrive`, `leave`, `return`. |
| M2.4, M2.13 | `SimHost.rewind` | M2.13 wraps it as `GameService.rewind`. |
| M2.5, M2.6 | `chapter-runner.ts`, `schema.ts` | M2.5 adds verbs, overrides, carry; M2.6 adds twists, activities, log kinds, diaries, notes. |
| M2.5, M2.8, M2.9 | `Carry`, `buildScenario(..., carry)`, `chapter.carry` | `runChapterHeadless` and `runYear` pass the carry the same way `main.ts` does. |
| M2.6, M2.7 | `YearLog`, `LogEntry`, `Flags` | `extractFeatures` reads only `verb`, `event`, and flag fields that M2.6 defines. |
| M2.7, M2.14, M2.15 | `MythPage`, `tellMyth` | M2.14 shows a page; M2.15 stores it as a `BookPage`. |
| M2.8, M2.9 | `players.ts`, `year.ts`, `carry/*.json`, `main.ink`, `main.ts` chapter list | M2.9 appends to `CHAPTER_ORDER` order already fixed in M2.8 and regenerates the carries after ch7. |
| M2.10, M2.11, M2.15 | `meadow-view.ts`, `Stage`, `main.ts` | M2.10 adds `setPalette`, `showHeatmap`; M2.11 adds `setView`, `snapshot`, `timeline`; M2.15 adds `visitor`. |
| M2.11, M2.12 | `ViewName`, Cosmos `pick` with 44-pixel snapping | Input calls `ctx.zoom` and the stage's `pick`; it never computes node positions. |
| M2.12, M2.13, M2.14, M2.15 | `Game.svelte`, `game-service.ts`, `keyboard.ts` | Keys: Z, X, P, B are new and unused before; G, H, R act only with the respond tool. |
| M2.6, M2.13 | `Note`, `Drawer.svelte` | M2.6 renders a note's fields; M2.13 adds the diary, dials, and peek sections around them. |

Per-task self-consistency:

- M2.1 to M2.4 change no M0 rule when the new scenario fields are absent; each ends with `c29d2fa4dbda4dcf`.
- M2.5's tray limit (three world verbs) matches every config row in M2.8 and M2.9.
- M2.6's flag defaults are the skip path of M2.7's "all-skipped year" test.
- M2.8 and M2.9 use only twist ids, metric kinds, and override fields that M2.5 and M2.6 define.
- M2.12 sends only `VerbInput` shapes that M2.5 maps to commands.
- M2.14's activity results are the strings M2.6's `greetingSong` source and the scripted players use (`'0'` to `'3'`, `'heard'`).
- M2.15's `SaveV2.year` is the `YearLog` that `main.ts` keeps since M2.5.

---

## Milestones M2 to M5 (outline)

Each milestone gets a detailed plan, in the same format, after the one before it passes its exit check. M2's detailed plan is above.

| Milestone | Contents | Exit check |
| --- | --- | --- |
| **M2: Part 1 complete** | Detailed in "Milestone M2: Part 1 complete (chapters 4 to 10)" above, with its rulings in ADR 0012. Chapters 4 to 10 and the 5 interludes as chapter configs and Ink. Sim additions: lanterns and bridges with walk-mesh effects, ambient sky bids, dew mushroom rule (`mushroom.*`), festival threshold dance for Bell. Cosmos view (network schematic, timeline) and Soul view (constellation, diary, dials). Mind verbs: peek, zoom, rewind (rewind replays the log to a tick). Threads in Cosmos with finger snapping. Myth module: `src/myth/features.ts` (action log to features), `src/myth/grammar.ts` (5 verses, 6 to 8 templates each, first true condition wins, narrator = highest sky warmth), templates in `content/myth/*.json` with `[PLACEHOLDER]` until a writer delivers. *Book of Skies* screen. The Quiet Visitor. Margin notes drawer. Persist the runner action log in saves (spec 10.4; myth needs it). | T3 for chapters 4 to 10; T4 (from M0.9); T6: at least 90% distinct myths over 1,000 random-play runs; the auto-player and a keyboard player reach the end of Part 1 |
| **M3: Part 2, Stage 1** | `RulePack` interface (spec 9.5) and `heroGift`/`localVerb` commands. Bridge scene and hero choice with naming (six designed heroes, knacks as exact rules from spec 5.5). Rule packs for Murmuration Fen, Hearsay Hollow, Halcyon (ADR 0007). Reputation (spec 9.6), postcards with Kith fast-forward, travel journal with keepsakes and "What they say about you". Homecoming and the sixth myth verse. Wisp's choice (spec 7.4). | T3 for each valley; every hero playtested in every valley; playtest |
| **M4: Launch quality** | Sandbox (4 panels, timeline, 3 challenges, modes from finished valleys). Seed links with fflate (`#v1.<data>`, file fallback above 2 KB) and the broken-link page. Postcard GIF ring buffer and PNG page exports. Opt-in count-only analytics. Accessibility pass and a manual screen-reader pass. Phone performance at 30 fps on the reference phone. No-WebGL still-image fallback. Asset retry. Offline after first load (service worker). "Where this model is wrong" page. | T7 to T11 pass |
| **M5: Stage 2** | Foglight Heights, Toadstool Council, Lily Shallows rule packs. Rule cards. Travelers by code. Remix tree for seed links. | T3 and T5 pass |

---

## Self-review notes

- **Spec coverage for M0:** spec 9.1 to 9.4, 9.7, 9.8, 10.3, 11.1 step 2, 11.2, 14, 16 (worker restart, dev limit checks), and 18 T1, T2, T4 map to tasks M0.1 to M0.15. Spec 9.5 and 9.6 move to M3 by design.
- **Deferred on purpose:** `bridge` and `lantern` structures, `heroGift`, `localVerb`, `rule` events, and the `RulePack` interface. Each arrives in the milestone that uses it, so M0 carries no unused code.
- **Names checked across tasks:** `createRng`, `Rng.state`, `parseTuning`, `ticksPerDay`, `createWorld`, `ensureTie`, `side`, `friendCount`, `averageWarmth`, `resolveMeeting`, `runDusk`, `applyCommand`, `step`, `hashWorld`, `checkInvariants`, `runTournament`, `SimPort`, `WorldLite`, `createWorkerCore`, `createSimHost`, `svgToRig`, `deform`, `buildStrip`, `createLineView`, `parseBeatTag`, `createInk`, `createDirector`, `findPlaceholders`, `placeholderGuard`.
