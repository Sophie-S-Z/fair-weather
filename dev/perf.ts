// Dev page: draws N creatures from worker snapshots and records frame times. ?n=30&seconds=30
// draws bare line rigs. ?scene=meadow draws the heaviest Meadow instead (the sandbox with fog, the
// lens, the heat map, the brook with two bridges, a lantern, the mushroom, and two paths), then
// times a 60-frame postcard GIF encode at 480 x 318. The result is also text on the page.
import { Application } from 'pixi.js';
import pimJson from '../content/rigs/PLACEHOLDER-pim.rig.json';
import tuningJson from '../content/tuning.json';
import scenarioJson from '../content/scenarios/m0.json';
import { RigSchema } from '../src/render/line/rig.ts';
import { createLineView } from '../src/render/line/line-view.ts';
import { createMeadowView } from '../src/render/meadow-view.ts';
import { SceneSchema } from '../src/render/scene.ts';
import { encodeGif, type RgbaFrame } from '../src/persist/gif.ts';
import { createSimHost } from '../src/sim-host/host.ts';
import type { WorldLite } from '../src/sim-host/protocol.ts';
import { parseTuning } from '../src/sim/tuning.ts';
import type { Command, Scenario } from '../src/sim/types.ts';
import meadowJson from '../content/scenes/kith-meadow.json';
import type { Settings } from '../src/ui/settings.ts';
import {
  BROOK_MUSHROOM,
  BROOK_WATER,
  BROOK_PLACEMENTS,
  cast,
  paletteFor,
  rigs,
  SANDBOX_SETUP,
} from './meadow-setup.ts';

const W = 1280;
const H = 720;
const WORLD_SCALE = 0.8; // scenario coordinates run to about 1600 by 900
const INK = 0x2b2a28;
const ACCENT = 0xf7c59f;
const PAPER = 0xffffff;
const WARMUP_MS = 1000;
/** The postcard (ADR 0014 item 8): 60 frames of 480 x 318, a 270-high scene over a 48-pixel band. */
const GIF_FRAMES = 60;
const GIF_W = 480;
const GIF_H = 318;
const GIF_SCENE_H = 270;

const params = new URLSearchParams(location.search);
const n = Number(params.get('n') ?? 30);
const seconds = Number(params.get('seconds') ?? 30);
const meadow = params.get('scene') === 'meadow';

declare global {
  interface Window {
    __perf?: {
      frames: number;
      meanMs: number;
      p95Ms: number;
      p99Ms: number;
      drawCalls: number;
      gifMs?: number;
      /** What the measured Meadow holds, from its last snapshot (meadow scene only). */
      world?: Record<string, number | boolean>;
    };
  }
}

const app = new Application();
const palette = paletteFor('spring');
// The Meadow is sized to the window with the game's own Pixi options (createStage in src/main.ts).
await app.init(
  meadow
    ? {
        resizeTo: window,
        background: palette.background,
        antialias: true,
        autoStart: false,
        skipExtensionImports: true,
      }
    : { width: W, height: H, background: PAPER, antialias: true, autoStart: false },
);
app.canvas.style.display = 'block';
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

/** Puts the creatures where a snapshot pair says, `t` of the way from `prev` to `next`. */
let draw: (prev: WorldLite | null, next: WorldLite, t: number, now: number) => void;
/** Called with each new snapshot. */
let onSnapshot: (lite: WorldLite) => void = () => undefined;
const tuning = parseTuning(tuningJson);
let scenario = scenarioJson as Scenario;
const setup: Command[] = [];

if (meadow) {
  scenario = { ...scenario, sandbox: true, mushroom: BROOK_MUSHROOM, water: BROOK_WATER };
  setup.push(
    { t: 'shine', x: 820, y: 330 },
    { t: 'paintFog', x: 1300, y: 700, r: 180, amount: 0.9 },
    { t: 'paintFog', x: 350, y: 450, r: 300, amount: 0.9 },
    ...BROOK_PLACEMENTS,
    ...SANDBOX_SETUP,
  );
  const settings: Settings = {
    textScale: 1,
    highContrast: false,
    reducedMotion: false,
    sound: false,
    analytics: false,
  };
  const view = createMeadowView(app, SceneSchema.parse(meadowJson), rigs, palette, {
    lensRadius: tuning.light.lensRadius,
    cast,
    gate: { x: tuning.scene.gateX, y: tuning.scene.gateY },
  });
  view.setFocus('pim');
  view.setGateLamp(true);
  view.showHeatmap(true);
  draw = (prev, next, t) => {
    view.update(prev ?? next, next, t, settings);
  };
  onSnapshot = (lite) => {
    view.countLens(lite);
  };
} else {
  const rig = RigSchema.parse(pimJson);
  const views = Array.from({ length: n }, () => {
    const v = createLineView(rig, { ink: INK, accent: ACCENT, paper: PAPER }, 60);
    app.stage.addChild(v.container);
    return v;
  });
  draw = (prev, next, t, now) => {
    views.forEach((v, i) => {
      const b = next.creatures[i];
      if (!b) return;
      const a = prev?.creatures[i] ?? b;
      v.container.position.set((a.x + (b.x - a.x) * t) * WORLD_SCALE, (a.y + (b.y - a.y) * t) * WORLD_SCALE);
      v.update(b.shell, now / 1000, false, 0);
    });
  };
}

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
  onSnapshot(m.lite);
});
host.post({ t: 'init', seed: 1, tuning: tuningJson, scenario });
if (setup.length > 0) host.post({ t: 'commands', list: setup });
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
    draw(prev, last, t, now);
  }
  calls = 0;
  app.render();
  if (measuring) maxCalls = Math.max(maxCalls, calls);
  if (now - first < WARMUP_MS + seconds * 1000) {
    requestAnimationFrame(frame);
    return;
  }
  void finish();
}

/** Captures 60 frames of the Meadow as the postcard does, and times the GIF encode of them. */
async function timeGifEncode(): Promise<number> {
  const ctx = new OffscreenCanvas(GIF_W, GIF_H).getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d context');
  const frames: RgbaFrame[] = [];
  for (let i = 0; i < GIF_FRAMES; i++) {
    const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    if (last) draw(prev, last, prev ? Math.min(1, (now - lastAt) / interval) : 1, now);
    app.render();
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, GIF_W, GIF_H);
    // The whole canvas, squeezed: the encode cost does not depend on the crop.
    ctx.drawImage(app.canvas, 0, 0, GIF_W, GIF_SCENE_H);
    frames.push({
      width: GIF_W,
      height: GIF_H,
      data: ctx.getImageData(0, 0, GIF_W, GIF_H).data,
      delayMs: 83,
    });
  }
  const start = performance.now();
  encodeGif(frames);
  return performance.now() - start;
}

/** What the last snapshot holds, so a missing part of the Meadow shows in the numbers. */
function describe(): Record<string, number | boolean> {
  const count = (kind: string): number => last?.structures.filter((x) => x.kind === kind).length ?? 0;
  return {
    creatures: last?.creatures.length ?? 0,
    water: last?.water.length ?? 0,
    bridges: count('bridge'),
    lanterns: count('lantern'),
    paths: count('path'),
    mushroom: last?.mushroom ? 1 : 0,
    fog: last?.fog.cells.some((c) => c > 0) ?? false,
    lens: last?.light != null,
    canvasW: app.canvas.width,
    canvasH: app.canvas.height,
  };
}

async function finish(): Promise<void> {
  const sorted = [...times].sort((x, y) => x - y);
  const at = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  window.__perf = {
    frames: times.length,
    meanMs: times.reduce((s, x) => s + x, 0) / Math.max(1, times.length),
    p95Ms: at(0.95),
    p99Ms: at(0.99),
    drawCalls: maxCalls,
    ...(meadow && { gifMs: await timeGifEncode(), world: describe() }),
  };
  const text = document.createElement('pre');
  text.textContent = JSON.stringify(window.__perf);
  document.body.append(text);
  document.body.dataset['calls'] = String(maxCalls);
  document.body.dataset['done'] = '1';
}
requestAnimationFrame(frame);
