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
import type { SaveV3 } from './persist/format.ts';
import { createProfile } from './persist/profile.ts';
import type { BookPage } from './persist/profile.ts';
import { createSlots } from './persist/slots.ts';
import { createSimHost } from './sim-host/host.ts';
import type { SimHost } from './sim-host/host.ts';
import type { SimPort, WorldLite } from './sim-host/protocol.ts';
import { parseTuning } from './sim/tuning.ts';
import type { Scenario, Season } from './sim/types.ts';
import type { YearLog } from './story/action-log.ts';
import { carriedDiaries, carryFrom, quantizeCarry, receivedDials } from './story/carry.ts';
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
  kithLegsBefore,
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
import {
  createSandboxRunner,
  DEFAULT_SWITCHES,
  SANDBOX_VALLEYS,
  sandboxScenario,
  sandboxTuning,
} from './story/sandbox.ts';
import type { SandboxRunner, SandboxValley } from './story/sandbox.ts';
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
/** The bridge: Kith's silent run starts from its scenario (ADR 0013 item 10). */
const bridgeChapter = ChapterSchema.parse(bridge);
const scenarioFiles = import.meta.glob<Scenario>('../content/scenarios/*.json', {
  eager: true,
  import: 'default',
});
/** The base scenario content/scenarios/<id>.json. */
function scenarioNamed(id: string): Scenario {
  const s = scenarioFiles[`../content/scenarios/${id}.json`];
  if (!s) throw new Error(`No scenario ${id}`);
  return s;
}
/** The base scenario a chapter names: content/scenarios/<chapter.scenario>.json. */
function baseOf(chapter: Chapter): Scenario {
  return scenarioNamed(chapter.scenario);
}
/** Each sandbox valley's base scenario (Kith's is m0) and scene (ADR 0014 item 1). */
const SANDBOX_BASES: Record<SandboxValley, Scenario> = {
  kith: scenarioNamed('m0'),
  fen: scenarioNamed('fen'),
  hollow: scenarioNamed('hollow'),
  halcyon: scenarioNamed('halcyon'),
};
const SANDBOX_SCENES: Record<SandboxValley, string> = {
  kith: firstScene.id,
  fen: 'fen',
  hollow: 'hollow',
  halcyon: 'halcyon',
};
/** The creatures of m0, the only ones the Kith the profile keeps holds (ADR 0014 item 1). */
const KITH_IDS: ReadonlySet<string> = new Set(SANDBOX_BASES.kith.creatures.map((c) => c.id));
/** Asked once at load: a `webgl2` or `webgl` context on a scratch canvas (ADR 0014 item 10). */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    // Gives the context back at once, so it does not count against the browser's limit.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
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
  /** The sandbox run's newest snapshot and its tick, or null outside a run or before its first. */
  sandbox: () => (sandboxRun?.lite ? { tick: sandboxRun.tick, lite: sandboxRun.lite } : null),
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
/** Dev only: ?seed=N is the seed of Begin and of a new sandbox valley; without it, 1 (ADR 0014 item 18). */
const devSeed = params.has('seed') ? Number(params.get('seed')) : 1;
/** A new year's or a new sandbox valley's seed: one random uint32, or the dev seed in a dev build. */
function newSeed(): number {
  if (import.meta.env.DEV)
    return Number.isInteger(devSeed) && devSeed >= 0 && devSeed < 2 ** 32 ? devSeed : 1;
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
/** The year's seed (ADR 0014 item 18): Begin draws it, and Continue reads it from the save. */
let yearSeed = newSeed();
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
let resuming: SaveV3 | null = null;
/** The last snapshot of the run so far: a carried chapter starts from it, a skip included. */
let lastLite: WorldLite | null = null;
/** The last chapter's runner: a carried chapter keeps its diaries. */
let lastRunner: ChapterRunner | null = null;
/** What the last chapter started from and its dial overrides, which the carry puts back. */
let lastStart: ChapterStart | null = null;
/**
 * The sandbox run now: its runner, the ids of the structures and bushes that the player did not
 * place (the base scenario's and the bench density's), and its newest snapshot and tick.
 */
let sandboxRun: {
  runner: SandboxRunner;
  made: ReadonlySet<string>;
  lite: WorldLite | null;
  tick: number;
} | null = null;
/** Rejects the sandbox start that waits for its first snapshot, with why; null when none waits. */
let startWaiting: ((why: string) => void) | null = null;
/** Whether the last sandbox start failed in the worker (an error or a give-up before its first snapshot). */
let workerFailed = false;
const sandboxWorkerFailed = (): boolean => workerFailed;
host.onMessage((m) => {
  if (m.t !== 'snapshot') return;
  // A sandbox run is no chapter: the story's carry stays the last chapter's.
  if (sandboxRun) {
    sandboxRun.lite = m.lite;
    sandboxRun.tick = m.tick;
  } else lastLite = m.lite;
});
/** Keeps Kith from the last snapshot for the sandbox (ADR 0014 item 1). */
async function keepKith(): Promise<void> {
  if (lastLite) await (await profileReady).setKith(quantizeCarry(carryFrom(lastLite, new Map()), KITH_IDS));
}
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
/** Starts Kith's silent run on its own worker from `from`, Kith at the end of Part 1 (ADR 0013 item 10). */
function startKith(from: Carry | null): SimHost {
  kithStart = from;
  kith ??= createSimHost(spawnWorker);
  kith.post({
    t: 'init',
    seed: yearSeed,
    tuning: tuningJson,
    scenario: kithScenario(bridgeChapter, homecoming, baseOf(bridgeChapter), kithStart),
  });
  kithAt(kith.rewind(0));
  return kith;
}
/** Runs one of Kith's legs at once: the postcard's nudge, when one was sent, then the leg's days. */
function runKithLeg(host: SimHost, leg: ReturnType<typeof kithLeg>): void {
  if (leg.commands.length > 0) host.send(leg.commands);
  kithAt(host.fastForward(leg.ticks));
}
/**
 * Continue in a valley: the journey from the save, the year's page its verse joins, and Kith
 * rebuilt by running its legs again from the journey's kithStart (ADR 0013 item 10).
 */
async function continueJourney(journey: Journey, chapterId: string): Promise<void> {
  journeyNow = journey;
  keptPage = (await (await profileReady).pages()).find((p) => p.year === journey.bookYear) ?? null;
  const host = startKith(journey.kithStart);
  for (const leg of kithLegsBefore(journey, chapterId, homecoming)) runKithLeg(host, leg);
}

const game: GameService = {
  chapters,
  webgl: hasWebGL(),
  sandbox: {
    async status() {
      const p = await profileReady;
      const [pages, kith, valleys] = await Promise.all([p.pages(), p.kith(), p.valleys()]);
      // The profile's order, which is the order the valleys were first played in.
      const finished = valleys.filter(
        (v): v is SandboxValley => v !== 'kith' && (SANDBOX_VALLEYS as readonly string[]).includes(v),
      );
      return { unlocked: pages.length > 0, kith: kith !== null, valleys: finished };
    },
    devOpen: import.meta.env.DEV && params.get('sandbox') === 'new',
    scene: (valley) => SANDBOX_SCENES[valley],
    async newSetup(valley, fromKith) {
      const kith = fromKith && valley === 'kith' ? await (await profileReady).kith() : null;
      return {
        seed: newSeed(),
        valley,
        kith,
        challenge: null,
        knobs: {},
        switches: { ...DEFAULT_SWITCHES },
        structures: [],
        bushes: [],
      };
    },
    start: (setup) =>
      new Promise((resolve, reject) => {
        // First, so a setup that does not build is never taken for the last visit's failed worker.
        workerFailed = false;
        // Built first, so a setup that throws (and rejects) leaves the run before going on.
        const scenario = sandboxScenario(
          setup,
          SANDBOX_BASES,
          sceneOf(SANDBOX_SCENES[setup.valley]).benchSpots,
        );
        const kept = new Set([...setup.structures, ...setup.bushes].map((x) => x.id));
        const made = new Set(
          [...scenario.structures, ...scenario.bushes].map((x) => x.id).filter((id) => !kept.has(id)),
        );
        startWaiting?.('a newer start replaced this one');
        sandboxRun?.runner.dispose();
        // Before the init, so the runner sees the run's first snapshot.
        const runner = createSandboxRunner(port, setup);
        const run = { runner, made, lite: null, tick: 0 };
        sandboxRun = run;
        const offs: (() => void)[] = [];
        const settle = (): void => {
          for (const off of offs) off();
          if (startWaiting === drop) startWaiting = null;
        };
        const drop = (why: string): void => {
          settle();
          reject(new Error(`The sandbox run did not start: ${why}`));
        };
        // The worker refused the run, or the host gave up: no run goes on (`workerFailed` is true).
        const fail = (why: string): void => {
          workerFailed = true;
          if (sandboxRun === run) {
            runner.dispose();
            sandboxRun = null;
            speedControl.runner(0);
          }
          drop(why);
        };
        startWaiting = drop;
        // After the listener that keeps the run's snapshot, so the run has it when `start` resolves.
        offs.push(
          host.onMessage((m) => {
            if (m.t === 'snapshot') {
              settle();
              resolve(runner);
            } else if (m.t === 'error') fail(m.message);
          }),
          host.onGiveUp(fail),
        );
        season = scenario.season;
        greeting = undefined;
        host.post({ t: 'init', seed: setup.seed, tuning: sandboxTuning(setup, tuningJson), scenario });
        // A worker that cannot spawn gives up inside the post: that start failed, and gets no speed.
        if (sandboxWorkerFailed()) return;
        // A run starts at 1x (ADR 0014 item 1); the sandbox runner sets no speed of its own.
        speedControl.runner(1);
        speedControl.player(1);
      }),
    workerFailed: sandboxWorkerFailed,
    placedStructures() {
      const run = sandboxRun;
      if (!run) return [];
      // Before the run's first snapshot, its world holds what its setup placed.
      const now = run.lite?.structures ?? run.runner.setup.structures;
      return now.filter((x) => !run.made.has(x.id)).map((x) => ({ ...x }));
    },
    placedBushes() {
      const run = sandboxRun;
      if (!run) return [];
      const now = run.lite?.bushes ?? run.runner.setup.bushes;
      return now.filter((b) => !run.made.has(b.id)).map(({ id, x, y }) => ({ id, x, y }));
    },
    stop() {
      startWaiting?.('the sandbox stopped');
      sandboxRun?.runner.dispose();
      sandboxRun = null;
      speedControl.runner(0);
    },
  },
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
      setGateLamp: (on) => {
        view.setGateLamp(on);
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
    // A valley continues only with its journey.
    const valley = chapters[index]?.valley !== undefined;
    if (valley && !save.journey) return null;
    try {
      ink.load(save.ink);
    } catch {
      return null;
    }
    resuming = save; // a different tuning hash still loads: tuning changes between versions are expected
    yearSeed = save.seed;
    if (valley && save.journey) await continueJourney(save.journey, save.chapterId);
    // The bridge comes right after the fire's page is kept, so that year's page is the newest.
    else if (save.chapterId === bridgeChapter.id)
      keptPage = (await (await profileReady).pages()).at(-1) ?? null;
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
    // A Part 1 chapter belongs to a new year, which keeps no journey from the last (the bridge clears its own below).
    if (!chapter.valley && chapter.activity !== 'hero') journeyNow = null;
    if (import.meta.env.DEV) dev.snapshots = 0;
    const resumed = resuming?.chapterId === chapter.id ? resuming : null;
    resuming = null;
    const at = chapters.indexOf(chapter);
    // Begin starts a new year at the first chapter, with a new seed; play only moves on from there.
    if (!resumed && at === firstChapter) yearSeed = newSeed();
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
      journeyNow = null;
      startKith(carry ?? null);
    }
    season = scenario.season;
    // A year that starts again at this chapter (Begin after an earlier year this visit) forgets
    // what the earlier year logged from here on, so the myth tells only the year it ends.
    for (let i = yearLog.length - 1; i >= 0; i--) {
      if (chapters.findIndex((c) => c.id === yearLog[i]?.chapterId) >= at) yearLog.splice(i, 1);
    }
    greeting = at > songFrom ? RHYTHMS[flags.greetingSong] : undefined;
    scenarioNow = scenario;
    host.post({
      t: 'init',
      seed: yearSeed,
      tuning: tuningJson,
      scenario,
      ...(resumed ? { checkpoint: resumed.checkpoint } : {}),
    });
    if (!resumed) {
      // The autosave at the chapter start: the world now, Ink before the chapter plays, the year
      // log of the chapters before it, the carry it started from, and in a valley the journey so
      // far, captions and the hero's name included, which stay on the device.
      const inkState = ink.state();
      const year = yearLog.slice();
      const savedJourney = chapter.valley && journeyNow ? structuredClone(journeyNow) : null;
      host.requestCheckpoint().then(
        async ({ world }) =>
          (await slotsReady).save('auto', {
            version: 3,
            seed: yearSeed,
            tuningHash,
            ink: inkState,
            flags,
            chapterId: chapter.id,
            year,
            carry: carry ?? null,
            checkpoint: world,
            journey: savedJourney,
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
        // Kith's leg first, with the postcard sent here; Continue replays it from the journal page.
        if (leg >= 0 && kith) runKithLeg(kith, kithLeg(leg, sent.at(-1) ?? null, homecoming));
        if ((!skipped || sent.length > 0) && journeyNow && lastLite) {
          journeyNow = leaveValley(journeyNow, chapter, lastLite, runner.log);
          // A valley with a journal page is a finished valley, which the sandbox offers (ADR 0014 item 1).
          if (journeyNow.pages.some((p) => p.valley === chapter.id))
            void profileReady.then((p) => p.addValley(chapter.id));
        }
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
    keptPage = await (await profileReady).keepMyth(page, yearSeed);
    // The year is over: Continue no longer offers its last chapter, so the fire cannot add a second page.
    // First, so a Kith that the profile refuses cannot make it offer the fire again.
    await (await slotsReady).keepYear();
    await keepKith();
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
  async finishJourney(verse) {
    // The verse joins the year's page, when this journey's year kept one.
    const year = journeyNow?.bookYear ?? null;
    if (year !== null) await (await profileReady).addVerse(year, verse);
    await (await slotsReady).keepYear();
    await keepKith();
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
