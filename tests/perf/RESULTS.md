# Perf results: 30 line rigs

The probe is `tests/perf/rigs.spec.ts` with `dev/perf.html?n=30&seconds=30`. It skips a 1 s warm-up. Budget: mean ≤ 16.9 ms, p95 ≤ 20 ms, draw calls ≤ 100.

## Desktop (M0 gate)

- Date: 2026-11-11, commit 6b818d4.
- Machine: Windows 11 Home 25H2, Intel Core Ultra 7 258V, Intel Arc 140V GPU (16 GB).
- Browser: Playwright Chromium, headed (`PERF_HEADED=1`).
- Display: 60 Hz. The run drew 1800 frames in 30 s, so the frame rate locked to the display.

| Frames | Mean     | p95     | p99     | Draw calls | Result |
| ------ | -------- | ------- | ------- | ---------- | ------ |
| 1800   | 16.68 ms | 16.8 ms | 17.0 ms | 1          | Pass   |

The same machine passed the e2e test (golden hash in the real worker) in Chromium, Firefox and WebKit.

## Cloud container (smoke check only)

Headless Chromium with software rendering and no GPU. The timing asserts do not apply there. Mean about 20.4 ms, 1 draw call.
