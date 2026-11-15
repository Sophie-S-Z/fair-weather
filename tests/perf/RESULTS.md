# Perf results: 30 line rigs

The probe is `tests/perf/rigs.spec.ts` with `dev/perf.html?n=30&seconds=30`. It skips a 1 s warm-up. Budget: mean ≤ 16.9 ms, p95 ≤ 20 ms, draw calls ≤ 100.

## Desktop (M0 gate)

- Date: 2026-11-11. Two runs: at 6b818d4, and at d17a27f after every body became an opaque fill.
- Machine: Windows 11 Home 25H2, Intel Core Ultra 7 258V, Intel Arc 140V GPU (16 GB).
- Browser: Playwright Chromium, headed (`PERF_HEADED=1`).
- Display: 60 Hz. The run drew 1800 frames in 30 s, so the frame rate locked to the display.

| Commit  | Frames | Mean     | p95     | p99     | Draw calls | Result |
| ------- | ------ | -------- | ------- | ------- | ---------- | ------ |
| 6b818d4 | 1800   | 16.68 ms | 16.8 ms | 17.0 ms | 1          | Pass   |
| d17a27f | 1801   | 16.67 ms | 16.9 ms | 17.7 ms | 1          | Pass   |

The same machine passed the e2e test (golden hash in the real worker) in Chromium, Firefox and WebKit.

## Cloud container (smoke check only)

Headless Chromium with software rendering and no GPU. The timing asserts do not apply there. Mean about 31 ms at d17a27f, because software rendering fills every body. 1 draw call.

# Perf results: the Meadow (M4, test T9)

CI checks the draw-call budget only (`tests/e2e/budget.spec.ts`: at most 100 a frame). Frame times are your measurement on real devices (ADR 0014 item 16). The probe is `dev/perf.html?scene=meadow&n=30&seconds=30`. It draws the heaviest Meadow: 30 creatures, fog, the lens, the heat map, the brook with two bridges, a lantern, the mushroom, and two paths. It skips a 1 s warm-up. It then times a 60-frame postcard GIF encode at 480 x 318.

## Your steps

### Reference desktop

1. Open a terminal in the project folder.
2. Run `PERF_HEADED=1 npm run test:perf`.
3. Wait for both tests to pass. Each takes about 40 s.
4. Copy the `perf (...)` lines from the output into the table below.
5. Pass is: mean at most 16.9 ms, p95 at most 20 ms, draw calls at most 100, GIF encode at most 2000 ms.

### Reference phone

1. Name the phone in the blank below. Spec 22 leaves it open.
2. Connect the phone and the computer to the same network.
3. Run `npm run dev -- --host`.
4. Open `/dev/perf.html?scene=meadow&n=30&seconds=30` on the phone. Use the address that the command prints.
5. Wait 35 s for the page to show the numbers.
6. Copy the printed numbers into the table below.
7. Pass is: mean at most 33.4 ms and p95 at most 40 ms.

A failed phone run becomes its own follow-up task. Attach the trace to that task.

Reference phone: ______________________

| Device            | Date | Commit | Frames | Mean | p95 | p99 | Draw calls | GIF encode | Result |
| ----------------- | ---- | ------ | ------ | ---- | --- | --- | ---------- | ---------- | ------ |
| Reference desktop |      |        |        |      |     |     |            |            |        |
| Reference phone   |      |        |        |      |     |     |            | not run    |        |

## Phone proxy (printed only)

`PERF_PHONE=1 npm run test:perf` uses 4x CPU throttling and a 412 x 915 viewport. It never asserts. It does not replace the phone run.

## Cloud container (smoke check only)

Headless Chromium with software rendering and no GPU. The timing asserts do not apply there.

- Meadow, 2026-11-15, smoke only: 189 frames, mean 160 ms, p95 200 ms, p99 200 ms, 9 draw calls, 60-frame GIF encode 175 ms. Software rendering fills every pixel, so the frame time says nothing about a GPU.
- Meadow with `PERF_PHONE=1` (proxy, printed only): mean 230 ms, p95 267 ms, 9 draw calls, GIF encode 848 ms.
