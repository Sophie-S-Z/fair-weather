# Fair Weather

Fair Weather is a story game for the browser. It is about small one-line ink creatures, trust, and the worlds that shape them.

- **Part 1, A Year in Kith.** You are the weather over one valley for one year. Sunlight, fog, wind, rain, and the seasons are your tools. Each tool holds one idea from game theory or network science. At the end, the creatures tell a myth about the sky. Your actions make the myth.
- **Part 2, Elsewhither.** You fall as rain and pick a hero. You walk through other valleys to find Wisp, a lost friend. Each valley runs on a different social rule.
- **Sandbox.** After the story, each rule becomes a tool.

The game runs only in the browser. After the first load, it works offline. It has no accounts and no cookies.

## Prerequisites

- Node.js 22.18 or later. The file `.nvmrc` gives the major version (22).
- npm 10 or later. npm comes with Node.js.

If you use nvm, run this command in the project folder:

```sh
nvm use
```

## Install

1. Clone the repository:

   ```sh
   git clone https://github.com/Sophie-S-Z/fair-weather.git
   ```

2. Go to the project folder:

   ```sh
   cd fair-weather
   ```

3. Install the packages from the lockfile:

   ```sh
   npm ci
   ```

## Play the game

1. Start the dev server:

   ```sh
   npm run dev
   ```

2. Open http://localhost:5173 in your browser.

The `dev/` folder holds check pages for the art and the engine. The dev server shows them at `/dev/<name>.html`, for example http://localhost:5173/dev/cast.html.

## Build for production

1. Make the production build in `dist/`:

   ```sh
   npm run build
   ```

2. Serve the build:

   ```sh
   npm run preview
   ```

3. Open http://localhost:4173 in your browser.

The build stops with an error if any file still refers to placeholder content (`PLACEHOLDER-*` files).

## Check the code

| Command                    | What it does                                |
| -------------------------- | ------------------------------------------- |
| `npm run lint`             | Runs ESLint and the Prettier check.         |
| `npm run format`           | Formats all files with Prettier.            |
| `npm run typecheck`        | Runs the TypeScript and Svelte type checks. |
| `npm run validate-content` | Checks the files in `content/`.             |

## Run the tests

### Unit tests

| Command             | What it does                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `npm test`          | Runs the unit and golden tests. This takes about 30 seconds.                                    |
| `npm run test:prop` | Runs the property tests. These take about 2 minutes.                                            |
| `npm run test:t3`   | Runs the long golden tests for chapters, valleys, and the sandbox. These take about 30 minutes. |

### Browser tests

The browser tests use Playwright. They start their own dev server on port 5179.

1. Install the Playwright browsers once:

   ```sh
   npx playwright install chromium firefox webkit
   ```

   On Linux, add `--with-deps` to also install the system libraries.

2. Run the tests in Chromium:

   ```sh
   npx playwright test --project=e2e --project=e2e-year
   ```

| Command                | What it does                                                                   |
| ---------------------- | ------------------------------------------------------------------------------ |
| `npm run test:e2e`     | Runs all browser tests in Chromium, Firefox, and WebKit, and the visual tests. |
| `npm run test:offline` | Checks that the game starts with no network. Run `npm run build` first.        |
| `npm run test:perf`    | Measures the frame rate. Set `PERF_HEADED=1` to show the browser window.       |

The visual tests compare screenshots with baselines from one Chromium build. On a different machine, small changes in the render can make them fail.

To use a Chromium that is already on your machine, set `PW_CHROMIUM_PATH` to its path.

## Project layout

| Folder     | What it holds                                                        |
| ---------- | -------------------------------------------------------------------- |
| `src/`     | The game code. `src/sim` is the simulation. It runs in a Web Worker. |
| `content/` | The story script, the art, and the data. It holds no logic.          |
| `tests/`   | The unit, golden, property, browser, offline, and performance tests. |
| `tools/`   | The build plugins, the content check, and the rig tool.              |
| `docs/`    | The design spec, the plans, and the decision records (`docs/adr/`).  |
| `dev/`     | The check pages for the dev server.                                  |
