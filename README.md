# Fair Weather

Fair Weather is a toybox for the browser. Twelve small one-line ink creatures live on a table. You carry them, poke them, tie them together with yarn, and give them silly props from a drawer.

Some actions start a known effect from game theory, psychology, philosophy, or network science. A short, funny scene plays, and you get a sticker. The sticker book gives a riddle for each sticker that you did not find yet. Each sticker opens a page with small looping animations that explain the idea.

The game runs only in the browser. After the first load, it works offline. It has no accounts and no cookies. It keeps your stickers in `localStorage`.

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

You can play with a pointer or with the keyboard. Settings, How to play shows the controls.

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

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run lint`      | Runs ESLint and the Prettier check.                 |
| `npm run format`    | Formats all files with Prettier.                    |
| `npm run typecheck` | Runs the TypeScript and Svelte type checks.         |
| `npm run rig`       | Makes a rig in `content/rigs/` from a creature SVG. |

## Run the tests

| Command                | What it does                                                                      |
| ---------------------- | --------------------------------------------------------------------------------- |
| `npm test`             | Runs the unit tests. They play each discovery on a table and check the result.    |
| `npm run test:e2e`     | Runs the browser tests in Chromium. They start their own dev server on port 5179. |
| `npm run test:offline` | Checks that the toybox opens with no network. Run `npm run build` first.          |

The browser tests use Playwright. Install Chromium once with `npx playwright install chromium`. On Linux, add `--with-deps` to also install the system libraries. To use a Chromium that is already on your machine, set `PW_CHROMIUM_PATH` to its path.

## Project layout

| Folder        | What it holds                                                                    |
| ------------- | -------------------------------------------------------------------------------- |
| `src/toy`     | The table state, the commands, the scene director, and the twelve discoveries.   |
| `src/render`  | The ink line renderer and the Pixi.js view of the table.                         |
| `src/ui`      | The Svelte controls, the drawer, the sticker book, and the lesson pages.         |
| `src/audio`   | The creature chirps and the sticker sound.                                       |
| `src/persist` | The saved stickers.                                                              |
| `content/`    | The creature drawings, their rigs, and the sticker book text. It holds no logic. |
| `tests/`      | The unit, browser, and offline tests.                                            |
| `tools/`      | The build plugins, the placeholder guard, and the rig tool.                      |
| `docs/`       | The design, the plan, and the decision records (`docs/adr/`).                    |
