// Dev page: the Meadow view over a fixed sim snapshot, drawn once at boil frame 0, with Pim in
// focus, a light lens, a fog patch, and a bench in the west meadow. ?contrast=1 sets high
// contrast. body[data-calls] is the WebGL draw-call count of the frame.
import { Application } from 'pixi.js';
import tuningJson from '../content/tuning.json';
import scenarioJson from '../content/scenarios/m0.json';
import springJson from '../content/palettes/spring.json';
import meadowJson from '../content/scenes/kith-meadow.json';
import { CastSchema, type Cast } from '../src/render/cast.ts';
import { RigSchema, type Rig } from '../src/render/line/rig.ts';
import { createMeadowView } from '../src/render/meadow-view.ts';
import { PaletteSchema } from '../src/render/palette.ts';
import { SceneSchema } from '../src/render/scene.ts';
import { toLite } from '../src/sim-host/lite.ts';
import { step } from '../src/sim/step.ts';
import { parseTuning } from '../src/sim/tuning.ts';
import type { Command, Scenario } from '../src/sim/types.ts';
import { createWorld } from '../src/sim/world.ts';
import type { Settings } from '../src/ui/settings.ts';

const W = 1280;
const H = 720;
const SEED = 1;
const TICK = 180;

const rigFiles = import.meta.glob<unknown>('../content/rigs/*.rig.json', { eager: true, import: 'default' });
const rigs = new Map<string, Rig>(
  Object.values(rigFiles).map((json) => {
    const rig = RigSchema.parse(json);
    return [rig.id, rig];
  }),
);
const castFiles = import.meta.glob<unknown>('../content/cast/*.json', { eager: true, import: 'default' });
const cast = new Map<string, Cast>(
  Object.values(castFiles).map((json) => {
    const c = CastSchema.parse(json);
    return [c.id, c];
  }),
);
const palette = PaletteSchema.parse(springJson);
const scene = SceneSchema.parse(meadowJson);

// The sim runs on this thread here: the snapshot must be the same every load.
const tuning = parseTuning(tuningJson);
const world = createWorld(SEED, tuning, scenarioJson as Scenario);
const setup: Command[] = [
  { t: 'shine', x: 820, y: 330 },
  { t: 'paintFog', x: 1300, y: 700, r: 180, amount: 0.9 },
];
step(world, setup, tuning);
while (world.tick < TICK - 1) step(world, [], tuning);
const prev = toLite(world, tuning);
// The bench is placed on the last tick, before a crowd gathers on it, so the baseline shows it.
step(world, [{ t: 'place', kind: 'bench', x: 290, y: 700 }], tuning);
const next = toLite(world, tuning);

const app = new Application();
await app.init({
  width: W,
  height: H,
  background: palette.background,
  preserveDrawingBuffer: true,
  antialias: true,
  autoStart: false,
});
document.body.appendChild(app.canvas);

const gl = (app.renderer as unknown as { gl: WebGL2RenderingContext }).gl;
let calls = 0;
for (const name of ['drawElements', 'drawArrays'] as const) {
  const original = gl[name].bind(gl) as (...a: unknown[]) => void;
  (gl as unknown as Record<string, unknown>)[name] = (...a: unknown[]): void => {
    calls += 1;
    original(...a);
  };
}

const settings: Settings = {
  textScale: 1,
  highContrast: new URLSearchParams(location.search).get('contrast') === '1',
  reducedMotion: false,
  sound: false,
  analytics: false,
};
const view = createMeadowView(app, scene, rigs, palette, { lensRadius: tuning.light.lensRadius, cast });
view.setFocus('pim');
view.update(prev, next, 0.5, settings);
app.render();
document.body.dataset['calls'] = String(calls);
document.body.dataset['ready'] = '1';
