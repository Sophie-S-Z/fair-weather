// The composition root (ADR 0011): the only file that imports every module.
import { Application } from 'pixi.js';
import { mount } from 'svelte';
import tuningJson from '../content/tuning.json';
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
import bridge from '../content/chapters/bridge.json';
import fen from '../content/valleys/fen.json';
import hollow from '../content/valleys/hollow.json';
import halcyon from '../content/valleys/halcyon.json';
import home from '../content/valleys/home.json';
import inkStory from '../content/ink/main.ink';
import versesJson from '../content/myth/verses.json';
import sixthJson from '../content/myth/sixth.json';
import { createAudioEngine, enableOnGesture } from './audio/engine.ts';
import { soundFor } from './audio/event-sounds.ts';
import { VoiceSchema, type Timbre } from './audio/voices.ts';
import { createHints, realTimer } from './input/hints.ts';
import { createHoldStill } from './input/hold-still.ts';
import { createKeyboard } from './input/keyboard.ts';
import { createOverPoke } from './input/over-poke.ts';
import { createPointer } from './input/pointer.ts';
import { createWait } from './input/wait.ts';
import { nextView, type ViewName } from './input/zoom.ts';
import { brushShare, extractFeatures } from './myth/features.ts';
import { tellMyth, VersesSchema } from './myth/grammar.ts';
import { SixthSchema, sixthFeatures, tellSixth } from './myth/sixth.ts';
import { CastSchema, type Cast } from './render/cast.ts';
import { RigSchema, type Rig } from './render/line/rig.ts';
import { createCosmosView, valleyTop, type Band } from './render/cosmos-view.ts';
import { CREATURE_HEIGHT, createMeadowView } from './render/meadow-view.ts';
import { PaletteSchema, type Palette } from './render/palette.ts';
import { SceneSchema, type SceneData } from './render/scene.ts';
import { createSoulView } from './render/soul-view.ts';
import { tieKind } from './render/ties.ts';
import { friendshipBreaks, sampleTimeline, type TimelinePoint } from './render/timeline.ts';
import { hashTuning } from './persist/format.ts';
import type { SaveV2 } from './persist/format.ts';
import { createProfile } from './persist/profile.ts';
import type { BookPage } from './persist/profile.ts';
import { createSlots } from './persist/slots.ts';
import { createSimHost } from './sim-host/host.ts';
import type { SimHost } from './sim-host/host.ts';
import type { SimPort, WorldLite } from './sim-host/protocol.ts';
import { parseTuning } from './sim/tuning.ts';
import type { Scenario, Season } from './sim/types.ts';
import type { YearLog } from './story/action-log.ts';
import { carriedDiaries, receivedDials } from './story/carry.ts';
import type { Carry } from './story/carry.ts';
import { createChapterRunner } from './story/chapter-runner.ts';
import type { ChapterRunner } from './story/chapter-runner.ts';
import { DEFAULT_FLAGS } from './story/flags.ts';
import {
  FIRST_HERO,
  journeyStart,
  KITH_VALLEYS,
  kithCarry,
  kithLeg,
  kithScenario,
  leaveValley,
  newJourney,
  parseHero,
  setCaption,
} from './story/journey.ts';
import type { Journey } from './story/journey.ts';
import { displayName } from './story/names.ts';
import { peekRule } from './story/peek.ts';
import { createInk } from './story/ink.ts';
import { buildScenario, chapterStart, chosenOverrides } from './story/scenario.ts';
import type { ChapterStart, JourneyStart } from './story/scenario.ts';
import { ChapterSchema } from './story/schema.ts';
import type { Chapter } from './story/schema.ts';
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
/** Three minutes of real time with no input bring the Quiet Visitor (spec 6.4). */
const QUIET_VISIT_MS = 180_000;
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
/**
 * The palette of a season or a valley: content has one for each season and each Part 2 valley
 * (tests/unit/render/meadow-view.test.ts).
 */
function paletteOf(id: string): Palette {
  const p = palettes.get(id);
  if (!p) throw new Error(`No palette for ${id}`);
  return p;
}
const palette = paletteOf('spring');
const sceneFiles = import.meta.glob<unknown>('../content/scenes/*.json', { eager: true, import: 'default' });
const scenes = new Map<string, SceneData>(
  Object.values(sceneFiles).map((json) => {
    const s = SceneSchema.parse(json);
    return [s.id, s];
  }),
);
/** The scene a chapter names: content validation checks that each one has a file. */
function sceneOf(id: string): SceneData {
  const s = scenes.get(id);
  if (!s) throw new Error(`No scene ${id}`);
  return s;
}
const firstScene = sceneOf('kith-meadow');
// In play order (tests/golden/year.ts CHAPTER_ORDER), then Part 2: the bridge, the valleys, home.
const chapters = [
  ch0,
  ch1,
  ch2,
  ch3,
  i3,
  ch4,
  i4,
  ch5,
  i5,
  ch6,
  ch7,
  i7,
  ch8,
  i8,
  ch9,
  ch10,
  bridge,
  fen,
  hollow,
  halcyon,
  home,
].map((c) => ChapterSchema.parse(c));
/** The homecoming: Kith counts its days while the player is away (ADR 0013 item 18). */
const homecoming = ChapterSchema.parse(home);
const scenarioFiles = import.meta.glob<Scenario>('../content/scenarios/*.json', {
  eager: true,
  import: 'default',
});
/** The base scenario a chapter names: content/scenarios/<chapter.scenario>.json. */
function baseOf(chapter: Chapter): Scenario {
  const s = scenarioFiles[`../content/scenarios/${chapter.scenario}.json`];
  if (!s) throw new Error(`${chapter.id} names scenario ${chapter.scenario}, which has no file`);
  return s;
}
/** The journal's drawings by path (ADR 0010: placeholders, which the production build refuses). */
const journalDrawings = import.meta.glob<string>('../content/placeholder/PLACEHOLDER-journal-*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});
const ink = createInk(inkStory);
const verses = VersesSchema.parse(versesJson);
const sixth = SixthSchema.parse(sixthJson);
/** The interlude whose rhythm becomes the village greeting song (spec 6.4). */
const songFrom = chapters.findIndex((c) => c.activity === 'rhythm');

const spawnWorker = (): Worker =>
  new Worker(new URL('./sim-host/worker.ts', import.meta.url), { type: 'module' });
const host = createSimHost(spawnWorker);
/**
 * Dev only: every speed sent to the sim, frames drawn, command lists the runner sent, and snapshots
 * since the chapter started, so e2e can see the tab-hidden pause, that a rewind sends nothing, and
 * when a new chapter's runner takes verbs (after its first snapshot).
 */
const dev = {
  speeds: [] as number[],
  frames: 0,
  sent: 0,
  snapshots: 0,
  /** The journey now (undefined outside Part 2), so e2e can write pages without playing whole valleys. */
  journey: (): Journey | null => journeyNow,
};
if (import.meta.env.DEV) {
  (window as unknown as { fairWeather: unknown }).fairWeather = dev;
  host.onMessage((m) => {
    if (m.t === 'snapshot') dev.snapshots += 1;
  });
}
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
const storageNotice = (): void => {
  noticeEl.hidden = false;
  noticeEl.textContent =
    'Saving is not available in this browser, so progress will not be kept. You can keep playing.';
};
// Not awaited at the top, so the title screen mounts without waiting for the database.
const slotsReady = createSlots(indexedDB, storageNotice);
/** The Book of Skies and the feathers; blocked storage keeps them for this visit only, with the same notice. */
const profileReady = createProfile(indexedDB, storageNotice);
const tuningHash = hashTuning(JSON.stringify(tuningJson));
/** The loaded autosave, held until its chapter starts. */
let resuming: SaveV2 | null = null;
/** The last snapshot of the run so far: a carried chapter starts from it, a skip included. */
let lastLite: WorldLite | null = null;
/** The last chapter's runner: a carried chapter keeps its diaries. */
let lastRunner: ChapterRunner | null = null;
/** What the last chapter started from and its dial overrides, which the carry puts back. */
let lastStart: ChapterStart | null = null;
host.onMessage((m) => {
  if (m.t === 'snapshot') lastLite = m.lite;
});
/** The scenario the current chapter was built from, variants included; peek reads its rules. */
let scenarioNow: Scenario | null = null;
/** Every chapter's log this year, in play order (spec 10.4); the myth reads it, and a Continue restores it. */
const yearLog: YearLog = [];
/** The year's page once kept: the sixth verse joins it, told by the same narrator. */
let keptPage: BookPage | null = null;
/** Kith at the bridge's start, the end of Part 1: the journey keeps it (ADR 0013 item 10). */
let kithStart: Carry | null = null;
/** The journey from the bridge's end (ADR 0013 item 9), or null before it. */
let journeyNow: Journey | null = null;
/** Kith while the player is away: a second worker, made at the bridge's start (ADR 0013 item 10). */
let kith: SimHost | null = null;
/** Kith after the last leg sent so far, or at its start before the first; null before the bridge. */
let kithNow: Promise<WorldLite> | null = null;
/** Counts chapter starts and stops, so a start that waits on Kith knows when it was dropped. */
let starts = 0;
/** The runner of the newest start, until a newer start or a stop drops it. */
let playing: ChapterRunner | null = null;
/**
 * Drops the chapter now playing: a start still waiting for Kith gives up, and the runner stops
 * taking snapshots. Its `done` handlers see the new count and change nothing.
 */
function dropStart(): void {
  starts += 1;
  playing?.skip();
  playing = null;
}
/** Keeps Kith's newest world. A valley's start reports a failure, so none goes unhandled here. */
function kithAt(answer: Promise<{ lite: WorldLite }>): void {
  kithNow = answer.then((r) => r.lite);
  kithNow.catch(() => undefined);
}

const game: GameService = {
  chapters,
  defaultFlags: DEFAULT_FLAGS,
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
    let scene = firstScene;
    const view = createMeadowView(app, scene, rigs, palette, {
      lensRadius: tuning.light.lensRadius,
      cast,
      gate: { x: tuning.scene.gateX, y: tuning.scene.gateY },
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
      setScene(id) {
        scene = sceneOf(id);
        view.setScene(scene);
      },
      setPalette(id) {
        const p = paletteOf(id);
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
      visitor: () => view.visitor(),
      endVisit: () => {
        view.endVisit();
      },
      get benchSpots() {
        return scene.benchSpots;
      },
      get sceneSize() {
        return { width: scene.width, height: scene.height };
      },
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
  async startChapter(chapter, given) {
    dropStart();
    const start = starts;
    // A valley waits for Kith's leg from the valley before (ADR 0013 item 10).
    const kithLite = chapter.valley ? await kithNow : null;
    if (start !== starts) throw new Error(`A newer chapter start replaced ${chapter.id}`);
    if (import.meta.env.DEV) dev.snapshots = 0;
    const resumed = resuming?.chapterId === chapter.id ? resuming : null;
    resuming = null;
    // Continue: the carry and the year so far come from the save (spec 15.1).
    if (resumed) yearLog.splice(0, yearLog.length, ...resumed.year);
    const base = baseOf(chapter);
    let flags = given;
    if (chapter.valley && chapter.carry) {
      // The homecoming starts from Kith (ADR 0013 item 12), and its variant reads whether Kith held.
      if (!kithLite) throw new Error(`${chapter.id} needs Kith from the bridge`);
      flags = { ...given, kithHeld: kithLite.metrics.averageWarmth >= tuning.wisp.minKithWarmth };
      lastStart = { carry: kithCarry(kithLite, kithStart), overrides: chosenOverrides(chapter, flags) };
    } else {
      lastStart = chapterStart(
        chapter,
        flags,
        base,
        resumed
          ? { saved: resumed.carry }
          : { lite: lastLite, diaries: lastRunner?.diaries ?? new Map(), last: lastStart },
      );
    }
    const { carry } = lastStart;
    let journey: JourneyStart | undefined;
    if (chapter.valley) {
      if (!journeyNow || !kithLite) throw new Error(`${chapter.id} needs the journey from the bridge`);
      journey = journeyStart(journeyNow, kithLite.metrics.averageWarmth);
    }
    const scenario = buildScenario(chapter, flags, base, carry, journey);
    if (chapter.activity === 'hero') {
      // Kith from the end of Part 1 runs silently on its own worker while the player is away.
      kithStart = carry ?? null;
      journeyNow = null;
      kith ??= createSimHost(spawnWorker);
      kith.post({
        t: 'init',
        seed: SEED,
        tuning: tuningJson,
        scenario: kithScenario(chapter, homecoming, base, kithStart),
      });
      kithAt(kith.rewind(0));
    }
    season = scenario.season;
    // A year that starts again at this chapter (Begin after an earlier year this visit) forgets
    // what the earlier year logged from here on, so the myth tells only the year it ends.
    const at = chapters.indexOf(chapter);
    for (let i = yearLog.length - 1; i >= 0; i--) {
      if (chapters.findIndex((c) => c.id === yearLog[i]?.chapterId) >= at) yearLog.splice(i, 1);
    }
    greeting = at > songFrom ? RHYTHMS[flags.greetingSong] : undefined;
    scenarioNow = scenario;
    host.post({
      t: 'init',
      seed: SEED,
      tuning: tuningJson,
      scenario,
      ...(resumed ? { checkpoint: resumed.checkpoint } : {}),
    });
    // A valley's save needs the journey, which save version 3 (M3.15) keeps.
    if (!resumed && !chapter.valley) {
      // The autosave at the chapter start: the world now, Ink before the chapter plays, the year
      // log of the chapters before it, and the carry it started from.
      const inkState = ink.state();
      const year = yearLog.slice();
      host.requestCheckpoint().then(
        async ({ world }) =>
          (await slotsReady).save('auto', {
            version: 2,
            seed: SEED,
            tuningHash,
            ink: inkState,
            flags,
            chapterId: chapter.id,
            year,
            carry: carry ?? null,
            checkpoint: world,
          }),
        () => undefined, // the worker gave up; the chapter plays without this save
      );
    }
    const made = createChapterRunner(
      port,
      ink,
      chapter,
      flags,
      carry && carriedDiaries(carry, base),
      receivedDials(carry, base),
    );
    // A skipped valley adds nothing to the journey but its Kith days (ADR 0013 item 9).
    let skipped = false;
    const runner: ChapterRunner = {
      ...made,
      skip: () => {
        skipped = true;
        return made.skip();
      },
    };
    lastRunner = runner;
    playing = made;
    const keep = (): void => {
      if (start === starts) yearLog.push({ chapterId: chapter.id, log: runner.log });
    };
    runner.done.then(keep, keep);
    /**
     * Runs `update` once this runner is done, unless a newer start or a stop dropped it. A failure
     * makes the next valley's start fail ("This chapter stopped"), so nothing plays out of step.
     */
    const whenDone = (update: () => void): void => {
      runner.done.then(
        () => {
          if (start !== starts) return;
          try {
            update();
          } catch (e) {
            kithAt(Promise.reject(e instanceof Error ? e : new Error(String(e))));
          }
        },
        () => undefined, // a failed chapter ends the game on its own
      );
    };
    if (chapter.activity === 'hero') {
      // The bridge's result makes the journey; a skip gives the first hero (ADR 0013 item 11).
      whenDone(() => {
        const chosen = runner.log.flatMap((e) => (e.kind === 'activity' ? [e.result] : []));
        const hero = parseHero(chosen[0] ?? FIRST_HERO);
        journeyNow = newJourney(hero.kind, hero.name, kithStart, keptPage?.year ?? null);
      });
    }
    const leg = (KITH_VALLEYS as readonly string[]).indexOf(chapter.id);
    if (chapter.valley) {
      whenDone(() => {
        // A sent postcard ends the valley, so a Skip after it still counts the valley as played.
        const sent = runner.log.flatMap((e) => (e.kind === 'postcard' ? [e.type] : []));
        if (leg >= 0 && kith) {
          // Kith's leg first: the postcard's nudge, when one was sent, then the leg's days at once.
          const { commands, ticks } = kithLeg(leg, sent[0] ?? null, homecoming);
          if (commands.length > 0) kith.send(commands);
          kithAt(kith.fastForward(ticks));
        }
        if ((!skipped || sent.length > 0) && journeyNow && lastLite)
          journeyNow = leaveValley(journeyNow, chapter, lastLite, runner.log);
      });
    }
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
    return tellMyth(extractFeatures(yearLog, flags, skyWarmth, brushShare(tuning)), verses, displayName);
  },
  async book() {
    return (await profileReady).pages();
  },
  async keepMyth(page) {
    keptPage = await (await profileReady).keepMyth(page, SEED);
    // The year is over: Continue no longer offers its last chapter, so the fire cannot add a second page.
    await (await slotsReady).keepYear();
  },
  stop: dropStart,
  journey: () => journeyNow,
  setCaption: (valley, text) => {
    if (journeyNow) setCaption(journeyNow, valley, text);
  },
  journalDrawing: (valley) =>
    journalDrawings[`../content/placeholder/PLACEHOLDER-journal-${valley}.svg`] ?? null,
  sixthVerse(flags) {
    if (!journeyNow) throw new Error('The sixth verse needs a journey');
    const { name } = journeyNow.hero;
    // Told by the year's narrator, as it joins the year's page; Pim, the guide home, without a page.
    return tellSixth(sixthFeatures(journeyNow, flags), sixth, name, keptPage?.narrator ?? 'pim', displayName);
  },
  async finishJourney() {
    // M3.15 adds the verse to the year's page here (Profile.addVerse with journey.bookYear).
    await (await slotsReady).keepYear();
  },
  async feathers() {
    return (await profileReady).feathers();
  },
  async addFeather() {
    return (await profileReady).addFeather();
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
    createWait: () => createWait(QUIET_VISIT_MS, realTimer),
    nextView,
  },
};

const app = document.getElementById('app');
if (app) mount(App, { target: app, props: { settings, hasSave: false, game } });
