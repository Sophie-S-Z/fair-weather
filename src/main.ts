// The composition root (ADR 0011): the only file that imports every module.
import { Application } from 'pixi.js';
import { mount } from 'svelte';
import tuningJson from '../content/tuning.json';
import flagsJson from '../content/flags.json';
import scenarioJson from '../content/scenarios/m0.json';
import meadowJson from '../content/scenes/kith-meadow.json';
import ch0 from '../content/chapters/ch0.json';
import ch1 from '../content/chapters/ch1.json';
import ch2 from '../content/chapters/ch2.json';
import ch3 from '../content/chapters/ch3.json';
import i3 from '../content/chapters/i3.json';
import ch4 from '../content/chapters/ch4.json';
import i4 from '../content/chapters/i4.json';
import ch5 from '../content/chapters/ch5.json';
import i5 from '../content/chapters/i5.json';
import ch6 from '../content/chapters/ch6.json';
import ch7 from '../content/chapters/ch7.json';
import i7 from '../content/chapters/i7.json';
import ch8 from '../content/chapters/ch8.json';
import i8 from '../content/chapters/i8.json';
import ch9 from '../content/chapters/ch9.json';
import ch10 from '../content/chapters/ch10.json';
import inkStory from '../content/ink/main.ink';
import versesJson from '../content/myth/verses.json';
import { createAudioEngine, enableOnGesture } from './audio/engine.ts';
import { soundFor } from './audio/event-sounds.ts';
import { VoiceSchema, type Timbre } from './audio/voices.ts';
import { createHints } from './input/hints.ts';
import { createHoldStill } from './input/hold-still.ts';
import { createKeyboard } from './input/keyboard.ts';
import { createOverPoke } from './input/over-poke.ts';
import { createPointer } from './input/pointer.ts';
import { nextView, type ViewName } from './input/zoom.ts';
import { extractFeatures } from './myth/features.ts';
import { tellMyth, VersesSchema } from './myth/grammar.ts';
import { CastSchema, type Cast } from './render/cast.ts';
import { RigSchema, type Rig } from './render/line/rig.ts';
import { createCosmosView, valleyTop, type Band } from './render/cosmos-view.ts';
import { CREATURE_HEIGHT, createMeadowView } from './render/meadow-view.ts';
import { PaletteSchema, type Palette } from './render/palette.ts';
import { SceneSchema } from './render/scene.ts';
import { createSoulView } from './render/soul-view.ts';
import { tieKind } from './render/ties.ts';
import { friendshipBreaks, sampleTimeline, type TimelinePoint } from './render/timeline.ts';
import { hashTuning } from './persist/format.ts';
import type { SaveV1 } from './persist/format.ts';
import { createSlots } from './persist/slots.ts';
import { createSimHost } from './sim-host/host.ts';
import type { SimPort, WorldLite } from './sim-host/protocol.ts';
import { parseTuning } from './sim/tuning.ts';
import type { Scenario, Season } from './sim/types.ts';
import type { YearLog } from './story/action-log.ts';
import { carriedDiaries, carryFrom, receivedDials, restoreDials } from './story/carry.ts';
import type { Carry } from './story/carry.ts';
import { createChapterRunner } from './story/chapter-runner.ts';
import type { ChapterRunner } from './story/chapter-runner.ts';
import { parseFlags } from './story/flags.ts';
import { displayName } from './story/names.ts';
import { peekRule } from './story/peek.ts';
import { createInk } from './story/ink.ts';
import { buildScenario, chosenOverrides } from './story/scenario.ts';
import { ChapterSchema } from './story/schema.ts';
import type { Overrides } from './story/schema.ts';
import App from './ui/App.svelte';
import type { GameService } from './ui/game-service.ts';
import { RHYTHMS } from './ui/interludes/activities.ts';
import { createSettingsStore, type SettingsStorage } from './ui/settings.ts';
import { createSpeedControl } from './ui/speed.ts';

const KEY = 'fair-weather.settings';
/** The Cosmos timeline takes one point per this many ticks: one a second at 1x. */
const TIMELINE_EVERY = 10;
/** Every player gets the same valley in M1; seed links come in M4. */
const SEED = 1;
const tuning = parseTuning(tuningJson);

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
const paletteFiles = import.meta.glob<unknown>('../content/palettes/*.json', {
  eager: true,
  import: 'default',
});
const palettes = new Map<string, Palette>(
  Object.values(paletteFiles).map((json) => {
    const p = PaletteSchema.parse(json);
    return [p.id, p];
  }),
);
/** The palette of a season: content has one for each (tests/unit/render/meadow-view.test.ts). */
function paletteOf(s: Season): Palette {
  const p = palettes.get(s);
  if (!p) throw new Error(`No palette for ${s}`);
  return p;
}
const palette = paletteOf('spring');
const scene = SceneSchema.parse(meadowJson);
// In play order (tests/golden/year.ts CHAPTER_ORDER).
const chapters = [ch0, ch1, ch2, ch3, i3, ch4, i4, ch5, i5, ch6, ch7, i7, ch8, i8, ch9, ch10].map((c) =>
  ChapterSchema.parse(c),
);
const ink = createInk(inkStory);
const verses = VersesSchema.parse(versesJson);
/** The interlude whose rhythm becomes the village greeting song (spec 6.4). */
const songFrom = chapters.findIndex((c) => c.activity === 'rhythm');

const host = createSimHost(
  () => new Worker(new URL('./sim-host/worker.ts', import.meta.url), { type: 'module' }),
);
/**
 * Dev only: every speed sent to the sim, frames drawn, and command lists the runner sent, so e2e can
 * see the tab-hidden pause and that a rewind sends nothing.
 */
const dev = { speeds: [] as number[], frames: 0, sent: 0 };
if (import.meta.env.DEV) (window as unknown as { fairWeather: unknown }).fairWeather = dev;
const params = new URLSearchParams(location.search);
/** Dev only: ?fast=N multiplies every speed sent to the sim, so e2e can play whole chapters in minutes. */
const devFast = Number(params.get('fast'));
const fast = import.meta.env.DEV && devFast > 0 ? devFast : 1;
function send(multiplier: number): void {
  if (import.meta.env.DEV) dev.speeds.push(multiplier);
  host.speed(multiplier * fast);
}
// The runner's speed times the player's 1x or 2x; 0 while the tab is hidden (src/ui/speed.ts).
const speedControl = createSpeedControl(send, document.visibilityState === 'hidden');
document.addEventListener('visibilitychange', () => {
  speedControl.setHidden(document.visibilityState === 'hidden');
});
const port: SimPort = {
  ...host,
  send: (list) => {
    if (import.meta.env.DEV) dev.sent += 1;
    host.send(list);
  },
  speed: (m) => {
    speedControl.runner(m);
  },
};

// Sound (spec 11.5): the engine makes no AudioContext until the first unmute.
let season: Season = 'spring';
/** The greeting song's rhythm in the chapters after the Door for Two. */
let greeting: readonly number[] | undefined;
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
      const cue = soundFor(e, greeting);
      if (cue) engine.play(cue);
    }
  } else if (m.t === 'snapshot') {
    const cells = m.lite.fog.cells;
    let sum = 0;
    for (const c of cells) sum += c;
    engine.setFog(cells.length > 0 ? sum / cells.length : 0);
  }
});

const devChapter = Number(params.get('chapter'));
const firstChapter =
  import.meta.env.DEV && Number.isInteger(devChapter) && devChapter >= 0 && devChapter < chapters.length
    ? devChapter
    : 0;

// Saves (spec 15.1). The notice is role=status, a polite live region. If storage is blocked or full, one polite notice says so and play goes on.
const noticeEl = document.createElement('p');
noticeEl.setAttribute('role', 'status');
noticeEl.style.cssText =
  'position:fixed;left:0.75rem;bottom:0.75rem;z-index:10;margin:0;padding:0.25rem 0.5rem;max-width:30rem;background:var(--bg);color:var(--fg);border:2px solid var(--accent);border-radius:0.4rem';
noticeEl.hidden = true;
document.body.appendChild(noticeEl);
// Not awaited at the top, so the title screen mounts without waiting for the database.
const slotsReady = createSlots(indexedDB, () => {
  noticeEl.hidden = false;
  noticeEl.textContent =
    'Saving is not available in this browser, so progress will not be kept. You can keep playing.';
});
const tuningHash = hashTuning(JSON.stringify(tuningJson));
/** The loaded autosave, held until its chapter starts. */
let resuming: SaveV1 | null = null;
/** The last snapshot of the run so far: a carried chapter starts from it, a skip included. */
let lastLite: WorldLite | null = null;
/** The last chapter's runner: a carried chapter keeps its diaries. */
let lastRunner: ChapterRunner | null = null;
/** What the last chapter started from and its dial overrides, which the carry puts back. */
let lastStart: { carry: Carry | undefined; overrides: Overrides[] } | null = null;
host.onMessage((m) => {
  if (m.t === 'snapshot') lastLite = m.lite;
});
/** The scenario the current chapter was built from, variants included; peek reads its rules. */
let scenarioNow: Scenario | null = null;
/** Every chapter's log this visit, in play order (spec 10.4); the myth reads it. */
const yearLog: YearLog = [];

const game: GameService = {
  chapters,
  defaultFlags: parseFlags(flagsJson),
  castIds: [...cast.keys()].sort(),
  isFriend(lite, a, b) {
    const t = lite.ties.find((t) => (t.a === a && t.b === b) || (t.a === b && t.b === a));
    return t !== undefined && tieKind(t.ab, t.ba, tuning.friend.threshold) === 'friend';
  },
  ties(lite) {
    const out = new Map<string, { friends: string[]; scars: string[] }>();
    const of = (id: string) => {
      const entry = out.get(id) ?? { friends: [], scars: [] };
      out.set(id, entry);
      return entry;
    };
    for (const t of lite.ties) {
      const kind = tieKind(t.ab, t.ba, tuning.friend.threshold);
      if (kind === null) continue;
      const list = kind === 'friend' ? 'friends' : 'scars';
      of(t.a)[list].push(t.b);
      of(t.b)[list].push(t.a);
    }
    return out;
  },
  firstChapter,
  async createStage(el) {
    const app = new Application();
    // The HTML UI owns accessibility and input, so Pixi's browser extensions stay out: no Pixi
    // accessibility layer (its touch hook button and Tab hook), no Pixi events, no DOM or filters.
    await app.init({
      resizeTo: el,
      background: palette.background,
      antialias: true,
      autoStart: false,
      skipExtensionImports: true,
    });
    app.canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(app.canvas);
    const view = createMeadowView(app, scene, rigs, palette, {
      lensRadius: tuning.light.lensRadius,
      cast,
    });
    const threshold = tuning.friend.threshold;
    const cosmos = createCosmosView(app, palette, cast, threshold);
    const soul = createSoulView(app, palette, rigs, cast, threshold);
    app.stage.addChild(cosmos.container, soul.container);
    let current: ViewName = 'meadow';
    /** The Soul view's creature, and under Cosmos the picked creature whose friendships stand out. */
    let soulId: string | null = null;
    /** The beat's camera shot; the Cosmos and Soul views show the whole valley under them. */
    let shot: string | null = null;
    /** The screen pixels the HTML takes on the right and at the bottom; the Soul view keeps clear. */
    let insets = { right: 0, bottom: 0 };
    /** The Cosmos timeline band the HTML lays out, or null outside the Cosmos. */
    let band: Band | null = null;
    const showView = (): void => {
      cosmos.container.visible = current === 'cosmos';
      soul.container.visible = current === 'soul';
      view.setShot(current === 'meadow' ? shot : null);
    };
    showView();
    /** This run's timeline; a snapshot from an earlier tick than the last point starts a new run. */
    const points: TimelinePoint[] = [];
    const breaks: number[] = [];
    let lastSeen: WorldLite | null = null;
    // Every live snapshot as it arrives; a rewound world comes as `rewound` and is not counted.
    const stopCounting = host.onMessage((m) => {
      if (m.t === 'snapshot') view.countLens(m.lite);
    });
    const local = (x: number, y: number): [number, number] => {
      const r = app.canvas.getBoundingClientRect();
      return [x - r.left, y - r.top];
    };
    // A node sits on its creature's body center, a villager's half height above its feet.
    const nodeAt = (x: number, y: number): [number, number] => view.toScreen(x, y - CREATURE_HEIGHT / 2);
    const views = { meadow: view, cosmos, soul };
    return {
      draw(prev: WorldLite, next: WorldLite, alpha, s) {
        if (import.meta.env.DEV) dev.frames += 1;
        const cosmosBand = current === 'cosmos' ? band : null;
        view.setTopInset(cosmosBand ? valleyTop(cosmosBand, app.screen.height, scene.height) : 0);
        view.update(prev, next, alpha, s);
        if (current === 'cosmos') cosmos.update(next, s, nodeAt, { points, breaks }, cosmosBand, soulId);
        if (current === 'soul') soul.update(next, s, soulId, insets);
        app.ticker.update(); // advances the view's clock and renders
      },
      pick: (x, y) => views[current].pick(...local(x, y)),
      toScene(x, y) {
        const [sx, sy] = view.toScene(...local(x, y));
        return { x: sx, y: sy };
      },
      setFocus: (id) => {
        view.setFocus(id);
      },
      setShot: (name) => {
        shot = name;
        showView();
      },
      setView(v, id) {
        current = v;
        soulId = id;
        showView();
      },
      snapshot(tick, lite) {
        if (tick < (points.at(-1)?.tick ?? 0)) {
          points.length = 0;
          breaks.length = 0;
          lastSeen = null;
        }
        sampleTimeline(points, tick, lite, TIMELINE_EVERY);
        if (lastSeen && friendshipBreaks(lastSeen, lite, threshold).length > 0) breaks.push(tick);
        lastSeen = lite;
      },
      timeline: () => ({ points, breaks }),
      setInsets(i) {
        insets = i;
      },
      setTimelineBand(b) {
        band = b;
      },
      setSeason(s) {
        const p = paletteOf(s);
        view.setPalette(p);
        cosmos.setPalette(p);
        soul.setPalette(p);
        app.renderer.background.color = p.background;
      },
      showHeatmap: (on) => {
        view.showHeatmap(on);
      },
      setCursor: (p) => {
        view.setCursor(p);
      },
      benchSpots: scene.benchSpots,
      sceneSize: { width: scene.width, height: scene.height },
      destroy() {
        stopCounting();
        app.destroy(true, true);
      },
    };
  },
  async resume() {
    const save = await (await slotsReady).load('auto');
    const index = save ? chapters.findIndex((c) => c.id === save.chapterId) : -1;
    if (!save || index < 0) return null;
    try {
      ink.load(save.ink);
    } catch {
      return null;
    }
    resuming = save; // a different tuning hash still loads: tuning changes between versions are expected
    return { index, flags: save.flags };
  },
  async hasSave() {
    return (await slotsReady).hasAuto();
  },
  startChapter(chapter, flags) {
    const carry =
      chapter.carry && lastLite ? carryFrom(lastLite, lastRunner?.diaries ?? new Map()) : undefined;
    if (carry && lastStart)
      restoreDials(carry, lastStart.carry, scenarioJson as Scenario, lastStart.overrides);
    lastStart = { carry, overrides: chosenOverrides(chapter, flags) };
    const scenario = buildScenario(chapter, flags, scenarioJson as Scenario, carry);
    season = scenario.season;
    greeting = chapters.indexOf(chapter) > songFrom ? RHYTHMS[flags.greetingSong] : undefined;
    scenarioNow = scenario;
    const resumed = resuming?.chapterId === chapter.id ? resuming : null;
    resuming = null;
    host.post({
      t: 'init',
      seed: SEED,
      tuning: tuningJson,
      scenario,
      ...(resumed ? { checkpoint: resumed.checkpoint } : {}),
    });
    if (!resumed) {
      // The autosave at the chapter start: the world now, and Ink before the chapter plays.
      const inkState = ink.state();
      host.requestCheckpoint().then(
        async ({ world }) =>
          (await slotsReady).save('auto', {
            version: 1,
            seed: SEED,
            tuningHash,
            ink: inkState,
            flags,
            chapterId: chapter.id,
            log: [], // the action log is kept from M2 (spec 10.4; the myth reads it)
            checkpoint: world,
          }),
        () => undefined, // the worker gave up; the chapter plays without this save
      );
    }
    const runner = createChapterRunner(
      port,
      ink,
      chapter,
      flags,
      carry && carriedDiaries(carry, scenarioJson as Scenario),
      receivedDials(carry, scenarioJson as Scenario),
    );
    lastRunner = runner;
    const keep = (): void => {
      yearLog.push({ chapterId: chapter.id, log: runner.log });
    };
    runner.done.then(keep, keep);
    return runner;
  },
  peek(dials) {
    return peekRule(dials, scenarioNow?.season ?? 'spring', scenarioNow?.friendsForgive === true);
  },
  async rewind(tick) {
    return (await host.rewind(tick)).lite;
  },
  myth(flags) {
    const here = (lastLite?.creatures ?? []).filter((c) => !c.gone && c.state !== 'away');
    const skyWarmth = Object.fromEntries(here.map((c) => [c.id, c.skyWarmth]));
    return tellMyth(extractFeatures(yearLog, flags, skyWarmth), verses, displayName);
  },
  onSnapshot(cb) {
    return host.onMessage((m) => {
      if (m.t === 'snapshot') cb(m.lite, m.tick);
    });
  },
  speed: (m) => {
    speedControl.player(m);
  },
  currentSpeed: () => speedControl.current(),
  input: {
    createKeyboard,
    createPointer,
    createHints: () => createHints(),
    createOverPoke: () =>
      createOverPoke(tuning.overPoke.windowSeconds, tuning.overPoke.count, () => performance.now()),
    createHoldStill: () => createHoldStill(() => performance.now()),
    nextView,
  },
};

const app = document.getElementById('app');
if (app) mount(App, { target: app, props: { settings, hasSave: false, game } });
