// Dev page: the Meadow view over a fixed sim snapshot, drawn once at boil frame 0, with Pim in
// focus, a light lens, a fog patch, and a bench in the west meadow. ?contrast=1 sets high
// contrast. ?season=<id> draws in that season's palette. ?land=brook plays the ch9 scenario
// with two bridges over the brook, a lantern, the mushroom, and Bell dancing; ?land=islet plays ch6 (Echo and Krit on the
// islet) with a lantern on the bank. ?fog=1 paints thick fog over the west meadow, where lines
// break into dashes. ?heat=1 moves the lens and shows the heat map of every snapshot.
// ?valley=fen plays Murmuration Fen in its scene and palette, with Tove in focus: a Lantern-bearer
// walks to Tove and joins the flock at dusk, and the frame is drawn just after the flock goes up.
// ?valley=hollow and ?valley=halcyon play Hearsay Hollow and Halcyon by day, with their guide in
// focus and a Lantern-bearer at the guide's side. body[data-calls] is the WebGL draw-call count of the frame.
import { Application } from 'pixi.js';
import tuningJson from '../content/tuning.json';
import scenarioJson from '../content/scenarios/m0.json';
import flagsJson from '../content/flags.json';
import ch6Json from '../content/chapters/ch6.json';
import ch9Json from '../content/chapters/ch9.json';
import meadowJson from '../content/scenes/kith-meadow.json';
import fenSceneJson from '../content/scenes/fen.json';
import fenScenarioJson from '../content/scenarios/fen.json';
import fenJson from '../content/valleys/fen.json';
import hollowSceneJson from '../content/scenes/hollow.json';
import hollowScenarioJson from '../content/scenarios/hollow.json';
import hollowJson from '../content/valleys/hollow.json';
import halcyonSceneJson from '../content/scenes/halcyon.json';
import halcyonScenarioJson from '../content/scenarios/halcyon.json';
import halcyonJson from '../content/valleys/halcyon.json';
import { CastSchema, type Cast } from '../src/render/cast.ts';
import { RigSchema, type Rig } from '../src/render/line/rig.ts';
import { createMeadowView } from '../src/render/meadow-view.ts';
import { PaletteSchema } from '../src/render/palette.ts';
import type { WorldLite } from '../src/sim-host/protocol.ts';
import { SceneSchema } from '../src/render/scene.ts';
import { toLite } from '../src/sim-host/lite.ts';
import { step } from '../src/sim/step.ts';
import { parseTuning } from '../src/sim/tuning.ts';
import type { Command, Scenario } from '../src/sim/types.ts';
import { createWorld } from '../src/sim/world.ts';
import { parseFlags } from '../src/story/flags.ts';
import { buildScenario, chapterTicksPerDay } from '../src/story/scenario.ts';
import { ChapterSchema } from '../src/story/schema.ts';
import type { Settings } from '../src/ui/settings.ts';

const W = 1280;
const H = 720;
const SEED = 1;
const TICK = 180;
/** The Fen's frame is this many ticks after dusk begins: the flock is up, Tove beside the hero. */
const FEN_AFTER_DUSK = 70;
const FEN_STEP_ASIDE = 30;
/** The Hollow and Halcyon are drawn this many ticks into their first day. */
const DAY_TICK = 600;
const tuning = parseTuning(tuningJson);

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
const params = new URLSearchParams(location.search);
const valleys = {
  fen: { chapter: fenJson, scene: fenSceneJson, scenario: fenScenarioJson },
  hollow: { chapter: hollowJson, scene: hollowSceneJson, scenario: hollowScenarioJson },
  halcyon: { chapter: halcyonJson, scene: halcyonSceneJson, scenario: halcyonScenarioJson },
};
const valleyId = params.get('valley');
const valley = valleyId && valleyId in valleys ? valleys[valleyId as keyof typeof valleys] : null;
const fen = valleyId === 'fen';
const valleyChapter = valley ? ChapterSchema.parse(valley.chapter) : null;
const guide = valleyChapter?.valley?.guide ?? null;
const fenDay = valleyChapter ? chapterTicksPerDay(valleyChapter) : 0;
const paletteFiles = import.meta.glob<unknown>('../content/palettes/*.json', {
  eager: true,
  import: 'default',
});
const season = params.get('season') ?? valleyChapter?.palette ?? 'spring';
const palette = PaletteSchema.parse(
  Object.values(paletteFiles).find((json) => (json as { id: string }).id === season),
);
const scene = SceneSchema.parse(valley ? valley.scene : meadowJson);
const land = params.get('land');
const chapterJson = land === 'brook' ? ch9Json : land === 'islet' ? ch6Json : null;
const scenario = valleyChapter
  ? buildScenario(valleyChapter, parseFlags(flagsJson), valley?.scenario as Scenario, undefined, {
      kind: 'lantern',
      name: 'Test',
      keepsakes: [],
      rumor: null,
      shell: null,
      companion: null,
      kithWarmth: 0.3,
    })
  : chapterJson
    ? buildScenario(ChapterSchema.parse(chapterJson), parseFlags(flagsJson), scenarioJson as Scenario)
    : (scenarioJson as Scenario);
/** In the Fen: dusk on day 0 (fen.duskAt), and the frame a little after the flock goes up. */
const fenDusk = Math.ceil(tuning.fen.duskAt * fenDay);
const tick = fen ? fenDusk + FEN_AFTER_DUSK : valley ? DAY_TICK : TICK;
if (land === 'brook') scenario.mushroom = { x: 1120, y: 560 };

// The sim runs on this thread here: the snapshot must be the same every load.
const world = createWorld(SEED, tuning, scenario);
const setup: Command[] = valley
  ? []
  : [
      { t: 'shine', x: 820, y: 330 },
      { t: 'paintFog', x: 1300, y: 700, r: 180, amount: 0.9 },
    ];
if (params.get('fog') === '1') setup.push({ t: 'paintFog', x: 350, y: 450, r: 300, amount: 0.9 });
if (land === 'brook') {
  setup.push(
    { t: 'place', kind: 'bridge', x: 810, y: 260 },
    { t: 'place', kind: 'bridge', x: 810, y: 640 },
    { t: 'place', kind: 'lantern', x: 960, y: 820 },
  );
}
if (land === 'islet') setup.push({ t: 'place', kind: 'lantern', x: 900, y: 470 });
const heat = params.get('heat') === '1';
/** With ?heat=1 the lens rests at each spot in turn, longest at the first. */
const lensPath: [number, number, number][] = [
  [820, 330, 80],
  [300, 650, 50],
  [1250, 250, 30],
];
const snapshots: WorldLite[] = [];
step(world, setup, tuning);
while (world.tick < tick - 1) {
  let cmds: Command[] = [];
  // The Fen's T3 player (tests/golden/players.ts): walks to Tove every 20 ticks, joins at dusk.
  if (fen && world.tick < fenDusk && world.tick % 20 === 0) cmds.push({ t: 'walk', to: 'tove' });
  if (fen && world.tick === fenDusk) cmds.push({ t: 'local', verb: { verb: 'join', on: true } });
  // Once the flock is up, the hero steps a little east of Tove, so both show side by side.
  const tove = fen && world.tick === fenDusk + FEN_STEP_ASIDE && world.creatures.find((c) => c.id === 'tove');
  if (tove) cmds.push({ t: 'walk', x: tove.x + 56, y: tove.y + 8 });
  // In the Hollow and Halcyon the hero walks to the guide and stands at its side.
  if (valley && !fen && guide && world.tick % 20 === 0) {
    const g = world.creatures.find((c) => c.id === guide);
    if (g) cmds.push({ t: 'walk', x: g.x + 60, y: g.y + 10 });
  }
  if (heat) {
    let at = 0;
    for (const [x, y, ticks] of lensPath) {
      if (world.tick === at) cmds = [{ t: 'shine', x, y }];
      at += ticks;
    }
  }
  step(world, cmds, tuning);
  if (heat) snapshots.push(toLite(world, tuning));
}
const prev = toLite(world, tuning);
// The bench is placed on the last tick, before a crowd gathers on it, so the baseline shows it.
// Bell starts dancing then too, so the dance has not spread yet.
const last: Command[] = valley ? [] : [{ t: 'place', kind: 'bench', x: 290, y: 700 }];
if (land === 'brook') last.push({ t: 'dance', who: 'bell' });
step(world, last, tuning);
const next = toLite(world, tuning);

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
const view = createMeadowView(app, scene, rigs, palette, {
  lensRadius: tuning.light.lensRadius,
  cast,
  gate: { x: tuning.scene.gateX, y: tuning.scene.gateY },
});
view.setFocus(guide ?? 'pim');
for (const lite of snapshots) view.countLens(lite);
view.showHeatmap(heat);
view.update(prev, next, 0.5, settings);
app.render();
document.body.dataset['calls'] = String(calls);
document.body.dataset['ready'] = '1';
