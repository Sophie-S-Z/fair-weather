# Fair Weather Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build *Fair Weather*, a client-only browser story game, starting with a technical spike (M0) that proves the deterministic simulation in a worker, the line-rig renderer, and Ink connected to the director.

**Architecture:** Ten modules with hard boundaries (spec 14.2). A pure, deterministic `sim` runs inside a Web Worker through `sim-host`. The `story` director is the only module that changes the chapter or the unlocked verbs, and it talks to the sim only through commands. `render` (PixiJS) and `ui` (Svelte, from M1) read snapshots only.

**Tech Stack:** TypeScript 6 (strict), Vite 8, PixiJS 8, inkjs 2, Zod 4, Vitest 5, fast-check 4, Playwright 1.64, ESLint 10 with typescript-eslint, Prettier 3. Svelte 5 and axe-core arrive in M1. Exact pins are in ADR 0008.

**Spec:** `docs/superpowers/specs/2026-11-11-fair-weather-design.md`. Read it with this plan. The decisions on spec gaps are in `docs/adr/0001` to `docs/adr/0010`. A task that cites "ADR n" uses the exact rule in that file.

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
- [ ] **Step 2: Create `package.json`** with `"type": "module"`, `"private": true`, `"engines": { "node": ">=22.12" }`, exact versions (no `^`), and these scripts:

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run --project unit",
  "test:prop": "vitest run --project property",
  "test:golden": "vitest run --project golden --passWithNoTests",
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
- Produces: `deform(rig: Rig, shell: Shell, boilFrame: number, out: Float32Array): Float32Array`. Boil: each point moves by a small offset from an integer hash of `(boilFrame, index)`, amplitude 0.004 rig units. The boil frame is `floor(seconds × 12)` (spec 11.2). Tightness pulls points toward the body center by up to 15%. Bristle adds a zigzag along the normal with alternating sign and an amplitude of `bristle × 0.02`. Softness runs `round(softness × 3)` passes of neighbor averaging. Color does not move points; `line-view` uses it as the fill alpha of the accent.
- Produces: `buildStrip(points: Float32Array, width: (i: number) => number, out: Float32Array): number` (writes 2 vertices per point offset along the miter normal, returns the vertex count). Width tapers to round ends.
- Produces: `createLineView(rig: Rig, color: number): { container: Container; update(shell: Shell, seconds: number, reducedMotion: boolean): void }` with one PixiJS `Mesh` per rig, updating its buffer in place. Reduced motion freezes the boil frame at 0.

- [ ] **Step 1: Write the failing tests.**
  - `deform` with an all-zero shell and boil frame 0 returns the rig points plus the boil offsets only; the same inputs give the same output.
  - Tightness 1 moves every body point closer to the center than tightness 0 does.
  - Bristle 1 alternates the sign of the normal offset point by point.
  - Softness 1 lowers the sum of squared second differences (the curve is smoother).
  - `buildStrip` returns 256 vertices for 128 points, and each vertex pair is `width(i)` apart.
  - Visual: `dev/rig.html?shell=0.5,0.5,0.5,0.5&frame=0` draws one rig at fixed values. `expect(page.locator('canvas')).toHaveScreenshot('rig-mid.png', { maxDiffPixelRatio: 0.01 })`. The first run writes the baseline. The user approves the image before it is committed.
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

## Milestones M2 to M5 (outline)

Each milestone gets a detailed plan, in the same format, after the one before it passes its exit check.

| Milestone | Contents | Exit check |
| --- | --- | --- |
| **M2: Part 1 complete** | Chapters 4 to 10 and the 5 interludes as chapter configs and Ink. Sim additions: lanterns and bridges with walk-mesh effects, ambient sky bids, dew mushroom rule (`mushroom.*`), festival threshold dance for Bell. Cosmos view (network schematic, timeline) and Soul view (constellation, diary, dials). Mind verbs: peek, zoom, rewind (rewind replays the log to a tick). Threads in Cosmos with finger snapping. Myth module: `src/myth/features.ts` (action log to features), `src/myth/grammar.ts` (5 verses, 6 to 8 templates each, first true condition wins, narrator = highest sky warmth), templates in `content/myth/*.json` with `[PLACEHOLDER]` until a writer delivers. *Book of Skies* screen. The Quiet Visitor. Margin notes drawer. | T3 for chapters 4 to 10; T4 (from M0.9); T6: at least 90% distinct myths over 1,000 random-play runs |
| **M3: Part 2, Stage 1** | `RulePack` interface (spec 9.5) and `heroGift`/`localVerb` commands. Bridge scene and hero choice with naming (six designed heroes, knacks as exact rules from spec 5.5). Rule packs for Murmuration Fen, Hearsay Hollow, Halcyon (ADR 0007). Reputation (spec 9.6), postcards with Kith fast-forward, travel journal with keepsakes and "What they say about you". Homecoming and the sixth myth verse. Wisp's choice (spec 7.4). | T3 for each valley; every hero playtested in every valley; playtest |
| **M4: Launch quality** | Sandbox (4 panels, timeline, 3 challenges, modes from finished valleys). Seed links with fflate (`#v1.<data>`, file fallback above 2 KB) and the broken-link page. Postcard GIF ring buffer and PNG page exports. Opt-in count-only analytics. Accessibility pass and a manual screen-reader pass. Phone performance at 30 fps on the reference phone. No-WebGL still-image fallback. Asset retry. Offline after first load (service worker). "Where this model is wrong" page. | T7 to T11 pass |
| **M5: Stage 2** | Foglight Heights, Toadstool Council, Lily Shallows rule packs. Rule cards. Travelers by code. Remix tree for seed links. | T3 and T5 pass |

---

## Self-review notes

- **Spec coverage for M0:** spec 9.1 to 9.4, 9.7, 9.8, 10.3, 11.1 step 2, 11.2, 14, 16 (worker restart, dev limit checks), and 18 T1, T2, T4 map to tasks M0.1 to M0.15. Spec 9.5 and 9.6 move to M3 by design.
- **Deferred on purpose:** `bridge` and `lantern` structures, `heroGift`, `localVerb`, `rule` events, and the `RulePack` interface. Each arrives in the milestone that uses it, so M0 carries no unused code.
- **Names checked across tasks:** `createRng`, `Rng.state`, `parseTuning`, `ticksPerDay`, `createWorld`, `ensureTie`, `side`, `friendCount`, `averageWarmth`, `resolveMeeting`, `runDusk`, `applyCommand`, `step`, `hashWorld`, `checkInvariants`, `runTournament`, `SimPort`, `WorldLite`, `createWorkerCore`, `createSimHost`, `svgToRig`, `deform`, `buildStrip`, `createLineView`, `parseBeatTag`, `createInk`, `createDirector`, `findPlaceholders`, `placeholderGuard`.
