# ADR 0008: Toolchain and version pins

**Status:** Accepted

## Context

The handoff says to look up current stable versions and pin exact versions. We looked them up with `npm view` on 2026-11-11.

## Decision

1. **Pin rule:** pin the newest stable release that is at least 7 days old on the install day. A release from the last 7 days has had little use. Check the list again on the install day.
2. **TypeScript 6, not 7.** TypeScript 7.0.2 is the newest release. `typescript-eslint` 8.72 supports only `>=4.8.4 <6.1.0`. So we pin TypeScript 6.0.3. Move to 7 when `typescript-eslint` supports it.
3. **Node:** 22 LTS (`.nvmrc` = 22). Vite 8 needs Node 20.19 or later.
4. **M0 packages** (candidates on 2026-11-11):

| Package | Version | Released |
| --- | --- | --- |
| vite | 8.3.5 | 2026-10-21 |
| typescript | 6.0.3 | 2026-04-16 |
| pixi.js | 8.22.0 | 2026-10-01 |
| inkjs | 2.4.0 | 2026-02-17 |
| zod | 4.6.7 | 2026-10-12 |
| vitest | 5.1.0 | 2026-11-02 |
| fast-check | 4.10.2 | 2026-09-19 |
| @playwright/test | 1.64.1 | 2026-10-14 |
| eslint | 10.14.0 | 2026-10-30 |
| @eslint/js | 10.0.1 | 2026-02-06 |
| typescript-eslint | 8.72.1 | 2026-10-26 |
| globals | 17.14.0 | 2026-11-01 |
| prettier | 3.9.10 | 2026-10-10 |
| @types/node | 22.20.5 | 2026-10-01 |
| svg-path-properties | 2.2.0 | 2026-10-16 (tools only) |

5. **M1 packages** (add in M1, check again then): svelte 5.57.3, @sveltejs/vite-plugin-svelte 7.3.1, svelte-check 4.7.8, eslint-plugin-svelte 3.24.0, prettier-plugin-svelte 4.1.1, @axe-core/playwright 4.14.0.
6. **Later:** fflate 0.8.3 for seed links (M4).
7. **No other runtime packages** without a new ADR.

## Consequences

- `npm ci` with a committed lockfile gives the same tree on every machine.
- The cloud container has a preinstalled Chromium for Playwright 1.63. With 1.64.1 pinned, the Playwright config reads an optional `PW_CHROMIUM_PATH` to use that browser. On the user's machine, `npx playwright install chromium` installs the matching one.
