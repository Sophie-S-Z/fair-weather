// Dev page: the Cosmos or the Soul view over the Meadow, from ch6 played on its stored carry for
// a fixed number of ticks, drawn once at boil frame 0. ?view=cosmos (default) or ?view=soul;
// ?soul=<id> picks the creature (Echo by default): the Soul view's, and the Cosmos view's picked
// one, whose friendships stand out. ?contrast=1 sets high contrast. The views baselines come from
// the stored ch6 carry: re-approve them whenever the golden carries are regenerated.
// body[data-calls] is the WebGL draw-call count of the frame.
import { Application } from 'pixi.js';
import tuningJson from '../content/tuning.json';
import scenarioJson from '../content/scenarios/m0.json';
import flagsJson from '../content/flags.json';
import ch6Json from '../content/chapters/ch6.json';
import meadowJson from '../content/scenes/kith-meadow.json';
import carryJson from '../tests/golden/carry/ch6.json';
import { CastSchema, type Cast } from '../src/render/cast.ts';
import { createCosmosView } from '../src/render/cosmos-view.ts';
import { RigSchema, type Rig } from '../src/render/line/rig.ts';
import { CREATURE_HEIGHT, createMeadowView } from '../src/render/meadow-view.ts';
import { PaletteSchema } from '../src/render/palette.ts';
import { SceneSchema } from '../src/render/scene.ts';
import { createSoulView } from '../src/render/soul-view.ts';
import { friendshipBreaks, sampleTimeline, type TimelinePoint } from '../src/render/timeline.ts';
import { toLite } from '../src/sim-host/lite.ts';
import type { WorldLite } from '../src/sim-host/protocol.ts';
import { step } from '../src/sim/step.ts';
import { parseTuning } from '../src/sim/tuning.ts';
import type { Scenario } from '../src/sim/types.ts';
import { createWorld } from '../src/sim/world.ts';
import { parseFlags } from '../src/story/flags.ts';
import { buildScenario } from '../src/story/scenario.ts';
import { ChapterSchema } from '../src/story/schema.ts';
import type { Settings } from '../src/ui/settings.ts';

const W = 1280;
const H = 720;
const SEED = 1;
const TICKS = 1200;
/** As main.ts samples the timeline. */
const TIMELINE_EVERY = 10;

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
const paletteFiles = import.meta.glob<unknown>('../content/palettes/*.json', {
  eager: true,
  import: 'default',
});
const chapter = ChapterSchema.parse(ch6Json);
const palette = PaletteSchema.parse(
  Object.values(paletteFiles).find((json) => (json as { id: string }).id === chapter.season),
);
const scene = SceneSchema.parse(meadowJson);
const params = new URLSearchParams(location.search);
const which = params.get('view') === 'soul' ? 'soul' : 'cosmos';
const soulId = params.get('soul') ?? 'echo';

// The sim runs on this thread here: the snapshot must be the same every load.
const tuning = parseTuning(tuningJson);
const threshold = tuning.friend.threshold;
const scenario = buildScenario(chapter, parseFlags(flagsJson), scenarioJson as Scenario, carryJson);
const world = createWorld(SEED, tuning, scenario);
const points: TimelinePoint[] = [];
const breaks: number[] = [];
let prev: WorldLite = toLite(world, tuning);
while (world.tick < TICKS) {
  step(world, [], tuning);
  const lite = toLite(world, tuning);
  sampleTimeline(points, world.tick, lite, TIMELINE_EVERY);
  if (friendshipBreaks(prev, lite, threshold).length > 0) breaks.push(world.tick);
  prev = lite;
}

const app = new Application();
await app.init({
  width: W,
  height: H,
  background: palette.background,
  preserveDrawingBuffer: true,
  antialias: true,
  // Sharp on a high-density screen, for review images; the baseline runs at density 1.
  resolution: window.devicePixelRatio,
  autoDensity: true,
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
  highContrast: params.get('contrast') === '1',
  reducedMotion: false,
  sound: false,
  analytics: false,
};
const meadow = createMeadowView(app, scene, rigs, palette, {
  lensRadius: tuning.light.lensRadius,
  bridgeRadius: tuning.bridge.radius,
  cast,
});
meadow.update(prev, prev, 1, settings);
// As main.ts composes the stage: the view sits over the meadow.
if (which === 'cosmos') {
  const cosmos = createCosmosView(app, palette, threshold);
  app.stage.addChild(cosmos.container);
  const nodeAt = (x: number, y: number): [number, number] => meadow.toScreen(x, y - CREATURE_HEIGHT / 2);
  cosmos.update(prev, settings, nodeAt, { points, breaks }, soulId);
} else {
  const soul = createSoulView(app, palette, rigs, threshold);
  app.stage.addChild(soul.container);
  soul.update(prev, settings, soulId, 0);
}
app.render();
document.body.dataset['calls'] = String(calls);
document.body.dataset['ready'] = '1';
