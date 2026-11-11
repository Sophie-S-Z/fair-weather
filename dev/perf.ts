// Dev page: draws N line rigs from worker snapshots and records frame times. ?n=30&seconds=30
import { Application } from 'pixi.js';
import pimJson from '../content/rigs/PLACEHOLDER-pim.rig.json';
import tuningJson from '../content/tuning.json';
import scenarioJson from '../content/scenarios/m0.json';
import { RigSchema } from '../src/render/line/rig.ts';
import { createLineView } from '../src/render/line/line-view.ts';
import { createSimHost } from '../src/sim-host/host.ts';
import type { WorldLite } from '../src/sim-host/protocol.ts';
import type { Scenario } from '../src/sim/types.ts';

const W = 1280;
const H = 720;
const WORLD_SCALE = 0.8; // scenario coordinates run to about 1600 by 900
const INK = 0x2b2a28;
const WARMUP_MS = 1000;

const params = new URLSearchParams(location.search);
const n = Number(params.get('n') ?? 30);
const seconds = Number(params.get('seconds') ?? 30);

declare global {
  interface Window {
    __perf?: { frames: number; meanMs: number; p95Ms: number; p99Ms: number; drawCalls: number };
  }
}

const app = new Application();
await app.init({ width: W, height: H, background: 0xffffff, antialias: true, autoStart: false });
document.body.appendChild(app.canvas);

// Pixi 8 has no draw-call counter: count the WebGL2 draw calls per frame.
const gl = (app.renderer as unknown as { gl: WebGL2RenderingContext }).gl;
let calls = 0;
for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
  const original = gl[name].bind(gl) as (...a: unknown[]) => void;
  (gl as unknown as Record<string, unknown>)[name] = (...a: unknown[]): void => {
    calls += 1;
    original(...a);
  };
}

const rig = RigSchema.parse(pimJson);
const views = Array.from({ length: n }, () => {
  const v = createLineView(rig, INK, 60);
  app.stage.addChild(v.container);
  return v;
});

let prev: WorldLite | null = null;
let last: WorldLite | null = null;
let lastAt = 0;
let interval = 1000 / 30;
const host = createSimHost(
  () => new Worker(new URL('../src/sim-host/worker.ts', import.meta.url), { type: 'module' }),
);
host.onMessage((m) => {
  if (m.t !== 'snapshot') return;
  const now = performance.now();
  if (last) interval = Math.max(1, now - lastAt);
  prev = last;
  last = m.lite;
  lastAt = now;
});
host.post({ t: 'init', seed: 1, tuning: tuningJson, scenario: scenarioJson as Scenario });
host.post({ t: 'speed', multiplier: 1 });

const times: number[] = [];
let maxCalls = 0;
let lastFrame = 0;
let first = 0;

function frame(now: number): void {
  first ||= now;
  const measuring = now - first >= WARMUP_MS;
  if (measuring && lastFrame > 0) times.push(now - lastFrame);
  lastFrame = now;
  if (last) {
    const t = prev ? Math.min(1, (now - lastAt) / interval) : 1;
    views.forEach((v, i) => {
      const b = last?.creatures[i];
      if (!b) return;
      const a = prev?.creatures[i] ?? b;
      v.container.position.set((a.x + (b.x - a.x) * t) * WORLD_SCALE, (a.y + (b.y - a.y) * t) * WORLD_SCALE);
      v.update(b.shell, now / 1000, false);
    });
  }
  calls = 0;
  app.render();
  if (measuring) maxCalls = Math.max(maxCalls, calls);
  if (now - first < WARMUP_MS + seconds * 1000) {
    requestAnimationFrame(frame);
    return;
  }
  const sorted = [...times].sort((x, y) => x - y);
  const at = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  window.__perf = {
    frames: times.length,
    meanMs: times.reduce((s, x) => s + x, 0) / Math.max(1, times.length),
    p95Ms: at(0.95),
    p99Ms: at(0.99),
    drawCalls: maxCalls,
  };
  document.body.dataset['done'] = '1';
}
requestAnimationFrame(frame);
