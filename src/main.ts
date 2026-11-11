// The composition root (ADR 0011): the only file that imports every module.
import { Application } from 'pixi.js';
import { mount } from 'svelte';
import tuningJson from '../content/tuning.json';
import flagsJson from '../content/flags.json';
import scenarioJson from '../content/scenarios/m0.json';
import springJson from '../content/palettes/spring.json';
import meadowJson from '../content/scenes/kith-meadow.json';
import ch0 from '../content/chapters/ch0.json';
import ch1 from '../content/chapters/ch1.json';
import ch2 from '../content/chapters/ch2.json';
import ch3 from '../content/chapters/ch3.json';
import inkStory from '../content/ink/main.ink';
import { createAudioEngine, enableOnGesture } from './audio/engine.ts';
import { soundFor } from './audio/event-sounds.ts';
import { VoiceSchema, type Timbre } from './audio/voices.ts';
import { createHints } from './input/hints.ts';
import { createKeyboard } from './input/keyboard.ts';
import { createOverPoke } from './input/over-poke.ts';
import { createPointer } from './input/pointer.ts';
import { CastSchema, type Cast } from './render/cast.ts';
import { RigSchema, type Rig } from './render/line/rig.ts';
import { createMeadowView } from './render/meadow-view.ts';
import { PaletteSchema } from './render/palette.ts';
import { SceneSchema } from './render/scene.ts';
import { createSimHost } from './sim-host/host.ts';
import type { SimPort, WorldLite } from './sim-host/protocol.ts';
import type { Scenario, Season } from './sim/types.ts';
import { createChapterRunner } from './story/chapter-runner.ts';
import { parseFlags } from './story/flags.ts';
import { createInk } from './story/ink.ts';
import { buildScenario } from './story/scenario.ts';
import { ChapterSchema } from './story/schema.ts';
import App from './ui/App.svelte';
import type { GameService } from './ui/game-service.ts';
import { createSettingsStore, type SettingsStorage } from './ui/settings.ts';

const KEY = 'fair-weather.settings';

const storage: SettingsStorage = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw === null ? undefined : (JSON.parse(raw) as unknown);
    } catch {
      return undefined;
    }
  },
  save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      // Blocked storage: settings last for this visit only.
    }
  },
};

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const settings = createSettingsStore(storage, reduced);

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
// Audio reads its own field (`timbre`) from the same cast files; render's CastSchema ignores it.
const timbres = new Map<string, Timbre>(
  Object.values(castFiles).map((json) => {
    const v = VoiceSchema.parse(json);
    return [v.id, v.timbre];
  }),
);
const palette = PaletteSchema.parse(springJson);
const scene = SceneSchema.parse(meadowJson);
const chapters = [ch0, ch1, ch2, ch3].map((c) => ChapterSchema.parse(c));
const ink = createInk(inkStory);

const host = createSimHost(
  () => new Worker(new URL('./sim-host/worker.ts', import.meta.url), { type: 'module' }),
);
/** Dev only: every speed sent to the sim, and frames drawn, so e2e can see the tab-hidden pause. */
const dev = { speeds: [] as number[], frames: 0 };
if (import.meta.env.DEV) (window as unknown as { fairWeather: unknown }).fairWeather = dev;
function send(multiplier: number): void {
  if (import.meta.env.DEV) dev.speeds.push(multiplier);
  host.speed(multiplier);
}
// No time passes unseen: while the tab is hidden the sim gets speed 0, whatever the runner or the
// screen asks for; the speed they asked for last is sent when the tab is visible again.
let wanted = 0;
let hidden = document.visibilityState === 'hidden';
function speed(multiplier: number): void {
  wanted = multiplier;
  send(hidden ? 0 : multiplier);
}
document.addEventListener('visibilitychange', () => {
  const now = document.visibilityState === 'hidden';
  if (now === hidden) return;
  hidden = now;
  send(hidden ? 0 : wanted);
});
const port: SimPort = { ...host, speed };

// Sound (spec 11.5): the engine makes no AudioContext until the first unmute.
let season: Season = 'spring';
const engine = createAudioEngine(() => new AudioContext(), {
  season: () => season,
  voice(who) {
    const timbre = timbres.get(who);
    const length = rigs.get(who)?.length;
    return timbre && length !== undefined ? { timbre, lineLength: length } : undefined;
  },
});
let soundOn = false;
let firstSettings = true;
settings.subscribe((s) => {
  soundOn = s.sound;
  if (firstSettings) {
    firstSettings = false;
    // A saved "on" waits for the first gesture; the browser would keep a context made now suspended.
    if (s.sound) enableOnGesture(engine, document, () => soundOn);
    return;
  }
  engine.setEnabled(s.sound);
});
host.onMessage((m) => {
  if (m.t === 'events') {
    for (const e of m.list) {
      const cue = soundFor(e);
      if (cue) engine.play(cue);
    }
  } else if (m.t === 'snapshot') {
    const cells = m.lite.fog.cells;
    let sum = 0;
    for (const c of cells) sum += c;
    engine.setFog(cells.length > 0 ? sum / cells.length : 0);
  }
});

const devChapter = Number(new URLSearchParams(location.search).get('chapter'));
const firstChapter =
  import.meta.env.DEV && Number.isInteger(devChapter) && devChapter >= 0 && devChapter < chapters.length
    ? devChapter
    : 0;

const game: GameService = {
  chapters,
  defaultFlags: parseFlags(flagsJson),
  firstChapter,
  async createStage(el) {
    const app = new Application();
    await app.init({ resizeTo: el, background: palette.background, antialias: true, autoStart: false });
    app.canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(app.canvas);
    const view = createMeadowView(app, scene, rigs, palette, {
      lensRadius: tuningJson.light.lensRadius,
      cast,
    });
    const local = (x: number, y: number): [number, number] => {
      const r = app.canvas.getBoundingClientRect();
      return [x - r.left, y - r.top];
    };
    return {
      draw(prev: WorldLite, next: WorldLite, alpha, s) {
        if (import.meta.env.DEV) dev.frames += 1;
        view.update(prev, next, alpha, s);
        app.ticker.update(); // advances the view's clock and renders
      },
      pick: (x, y) => view.pick(...local(x, y)),
      toScene(x, y) {
        const [sx, sy] = view.toScene(...local(x, y));
        return { x: sx, y: sy };
      },
      setFocus: (id) => {
        view.setFocus(id);
      },
      setShot: (name) => {
        view.setShot(name);
      },
      benchSpots: scene.benchSpots,
      destroy() {
        app.destroy(true, true);
      },
    };
  },
  startChapter(chapter, flags) {
    const scenario = buildScenario(chapter, flags, scenarioJson as Scenario);
    season = scenario.season;
    host.post({ t: 'init', seed: 1, tuning: tuningJson, scenario });
    return createChapterRunner(port, ink, chapter, flags);
  },
  onSnapshot(cb) {
    return host.onMessage((m) => {
      if (m.t === 'snapshot') cb(m.lite);
    });
  },
  speed,
  currentSpeed: () => wanted,
  input: {
    createKeyboard,
    createPointer,
    createHints: () => createHints(),
    createOverPoke: () =>
      createOverPoke(tuningJson.overPoke.windowSeconds, tuningJson.overPoke.count, () => performance.now()),
  },
};

const app = document.getElementById('app');
if (app) mount(App, { target: app, props: { settings, hasSave: false, game } });
