// The composition root (ADR 0011): the only file that imports every module.
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
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
import foglight from '../content/valleys/foglight.json';
import council from '../content/valleys/council.json';
import shallows from '../content/valleys/shallows.json';
import halcyon from '../content/valleys/halcyon.json';
import home from '../content/valleys/home.json';
import inkStory from '../content/ink/main.ink';
import versesJson from '../content/myth/verses.json';
import sixthJson from '../content/myth/sixth.json';
import bodiesJson from '../content/bodies.json';
import { createAudioEngine, enableOnGesture } from './audio/engine.ts';
import { soundFor } from './audio/event-sounds.ts';
import { VoiceSchema, type Timbre } from './audio/voices.ts';
import { createHints, realTimer } from './input/hints.ts';
import { createHoldStill } from './input/hold-still.ts';
import { createHelpKey, createKeyboard, keyRows } from './input/keyboard.ts';
import { createOverPoke } from './input/over-poke.ts';
import { createPointer } from './input/pointer.ts';
import { createWait } from './input/wait.ts';
import { nextView, type ViewName } from './input/zoom.ts';
import { brushShare, extractFeatures } from './myth/features.ts';
import { tellMyth, VersesSchema } from './myth/grammar.ts';
import { SixthSchema, sixthFeatures, tellSixth } from './myth/sixth.ts';
import { CastSchema, type Cast } from './render/cast.ts';
import { createFrameRing } from './render/frame-ring.ts';
import { RigSchema, type Rig } from './render/line/rig.ts';
import { createCosmosView, valleyTop, type Band } from './render/cosmos-view.ts';
import { CREATURE_HEIGHT, createMeadowView } from './render/meadow-view.ts';
import { PaletteSchema, type Palette } from './render/palette.ts';
import { SceneSchema, type SceneData } from './render/scene.ts';
import { createSoulView } from './render/soul-view.ts';
import { tieKind } from './render/ties.ts';
import { friendshipBreaks, sampleTimeline, type TimelinePoint } from './render/timeline.ts';
import { hashTuning } from './persist/format.ts';
import { encodeGif } from './persist/gif.ts';
import { ATKINSON, layoutPage, PAGE_WIDTH } from './persist/page-image.ts';
import type { PageBlock } from './persist/page-image.ts';
import type { SaveV3 } from './persist/format.ts';
import { createProfile } from './persist/profile.ts';
import {
  LINK_CHARS,
  MAX_LINK_TEXT,
  MAX_LINK_TICKS,
  VALLEY_FILE,
  decodeLink,
  encodeLink,
  fitsInLink,
  lineageOf,
  linkId,
} from './persist/seed-link.ts';
import type { BookPage } from './persist/profile.ts';
import { decodeTraveler, encodeTraveler } from './persist/traveler.ts';
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
import { stillPages } from './story/stills.ts';
import { loadImageWithRetry } from './ui/retry-image.ts';
import {
  createSandboxRunner,
  cutNote,
  DEFAULT_SWITCHES,
  SANDBOX_TICKS_PER_DAY,
  SANDBOX_VALLEYS,
  sandboxScenario,
  sandboxTuning,
} from './story/sandbox.ts';
import type { SandboxRunner, SandboxSetup, SandboxValley } from './story/sandbox.ts';
import { travelerOf } from './story/traveler.ts';
import { buildScenario, chapterStart, chosenOverrides } from './story/scenario.ts';
import type { ChapterStart, JourneyStart } from './story/scenario.ts';
import { ChapterSchema } from './story/schema.ts';
import type { Chapter } from './story/schema.ts';
import App from './ui/App.svelte';
import type { GameService, Stage } from './ui/game-service.ts';
import { RHYTHMS } from './ui/interludes/activities.ts';
import { betCounts, createAnalytics, createVisibleTimer, fetchPost } from './persist/analytics.ts';
import { createSettingsStore, type SettingsStorage } from './ui/settings.ts';
import { oneAtATime } from './ui/one-at-a-time.ts';
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
let analyticsOn = false;
settings.subscribe((s) => {
  analyticsOn = s.analytics;
});
const analytics = createAnalytics(import.meta.env.VITE_ANALYTICS_URL || null, () => analyticsOn, fetchPost);

const rigFiles = import.meta.glob<unknown>('../content/rigs/*.rig.json', { eager: true, import: 'default' });
const rigs = new Map<string, Rig>(
  Object.values(rigFiles).map((json) => {
    const rig = RigSchema.parse(json);
    return [rig.id, rig];
  }),
);
// A villager wears one of the shared bodies (spec 5.4): its id names that body's rig.
for (const [id, body] of Object.entries(bodiesJson)) {
  const rig = rigs.get(body);
  if (rig) rigs.set(id, rig);
}
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
  foglight,
  council,
  shallows,
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
  foglight: scenarioNamed('foglight'),
  council: scenarioNamed('council'),
  shallows: scenarioNamed('shallows'),
  halcyon: scenarioNamed('halcyon'),
};
const SANDBOX_SCENES: Record<SandboxValley, string> = {
  kith: firstScene.id,
  fen: 'fen',
  hollow: 'hollow',
  foglight: 'foglight',
  council: 'council',
  shallows: 'shallows',
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
/** The still images by path (ADR 0010: placeholders; a chapter's own `still` joins them later). */
const stillImages = import.meta.glob<string>(
  ['../content/placeholder/PLACEHOLDER-still-*.svg', '../content/stills/*.svg'],
  { eager: true, query: '?url', import: 'default' },
);
/**
 * The waits before each new try of an asset that fails after the page loads: the sim worker's
 * script, the journal drawings and stills, and the PNG export's images (ADR 0014 item 11).
 */
const ASSET_WAITS_MS = [1000, 2000] as const;
const ink = createInk(inkStory);
const verses = VersesSchema.parse(versesJson);
const sixth = SixthSchema.parse(sixthJson);
/** The interlude whose rhythm becomes the village greeting song (spec 6.4). */
const songFrom = chapters.findIndex((c) => c.activity === 'rhythm');

const spawnWorker = (): Worker =>
  new Worker(new URL('./sim-host/worker.ts', import.meta.url), { type: 'module' });
/** Called when a story host stops restarting its worker (GameService.onSimLost). */
const simLostListeners = new Set<() => void>();
const simLost = (): void => {
  for (const cb of [...simLostListeners]) cb();
};
const host = createSimHost(spawnWorker, { loadWaitsMs: ASSET_WAITS_MS });
host.onGiveUp(simLost);
/**
 * Dev only: every speed sent to the sim, frames drawn, command lists the runner sent, and snapshots
 * since the chapter started, so e2e can see the tab-hidden pause, that a rewind sends nothing, and
 * when a new chapter's runner takes verbs (after its first snapshot).
 */
const dev = {
  speeds: [] as number[],
  frames: 0,
  /** Scene captures for the postcard ring, so e2e can see that only the sandbox records. */
  captures: 0,
  sent: 0,
  snapshots: 0,
  /** The journey now (undefined outside Part 2), so e2e can write pages without playing whole valleys. */
  journey: (): Journey | null => journeyNow,
  /** The sandbox run's newest snapshot and its tick, or null outside a run or before its first. */
  sandbox: () => game.sandbox.snapshot(),
  /** The world's hash now and its tick, so e2e can see that an opened link gives the same world. */
  hash: () => host.requestHash(),
  /** The postcard's encoder, so e2e can check that the browser decodes its output to the same pixels. */
  encodeGif,
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
    // Only the sandbox runner sends while a sandbox run goes on: the player acted.
    if (sandboxRun) sandboxActed = true;
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
 * place (the base scenario's and the bench density's), its newest snapshot and tick, and its notes
 * in tick order.
 */
let sandboxRun: {
  runner: SandboxRunner;
  made: ReadonlySet<string>;
  lite: WorldLite | null;
  tick: number;
  notes: { tick: number; text: string }[];
  /** Its lineage, which its links hold as `from` (ADR 0015 item 10). */
  from: string[];
} | null = null;
/** Rejects the sandbox start that waits for its first snapshot, with why; null when none waits. */
let startWaiting: ((why: string) => void) | null = null;
/** Ends the give-up listener of the sandbox run now, which lives as long as the run does. */
let endRunGiveUp: (() => void) | null = null;
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
  if (!kith) {
    kith = createSimHost(spawnWorker, { loadWaitsMs: ASSET_WAITS_MS });
    // Kith's silent run is part of the story: when its worker is lost, so is the chapter.
    // A sandbox run has its own give-up path; Kith's loss does not stop it.
    kith.onGiveUp(() => {
      if (!sandboxRun) simLost();
    });
  }
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

/** The scenario a sandbox setup starts from; throws when it cannot be built. */
const sandboxStart = (setup: SandboxSetup): Scenario =>
  sandboxScenario(setup, SANDBOX_BASES, sceneOf(SANDBOX_SCENES[setup.valley]).benchSpots);
/**
 * Whether the player acted (sent a command, or started a run from a run, such as a rule change)
 * since the start choice or an open. Only then does leaving keep the run as the sandbox save, so
 * an opened link replaces the player's own save only once the player acts (ADR 0014 item 7).
 */
let sandboxActed = false;
/** How many times the sandbox stopped: an open that waited across a stop gives up. */
let sandboxStops = 0;
/**
 * Starts a sandbox run of `setup` from `scenario`, and resolves with its runner at the run's first
 * snapshot. `acted` is whether the player acted by starting it (sandboxActed). `go` sets the run going once the worker has the run's init; `fail` ends the start as a
 * failure in the worker.
 */
function beginSandbox(
  setup: SandboxSetup,
  scenario: Scenario,
  from: string[],
  acted: boolean,
  go: (runner: SandboxRunner, fail: (why: string) => void) => void,
): Promise<SandboxRunner> {
  return new Promise((resolve, reject) => {
    workerFailed = false;
    sandboxActed = acted;
    // A new run starts a new postcard: no frame of the run before it (ADR 0014 item 8).
    recording?.setRecording(true);
    const kept = new Set([...setup.structures, ...setup.bushes].map((x) => x.id));
    const made = new Set(
      [...scenario.structures, ...scenario.bushes].map((x) => x.id).filter((id) => !kept.has(id)),
    );
    startWaiting?.('a newer start replaced this one');
    sandboxRun?.runner.dispose();
    endRunGiveUp?.();
    // Before the init, so the runner sees the run's first snapshot.
    const runner = createSandboxRunner(port, setup);
    const run = { runner, made, lite: null, tick: 0, notes: [], from };
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
    // The worker refused the run, or the host gave up, before or after its first snapshot: no run
    // goes on (`workerFailed` is true).
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
    );
    endRunGiveUp = host.onGiveUp(fail);
    season = scenario.season;
    greeting = undefined;
    host.post({ t: 'init', seed: setup.seed, tuning: sandboxTuning(setup, tuningJson), scenario });
    // A worker that cannot spawn gives up inside the post: that start failed, and gets no speed.
    if (sandboxWorkerFailed()) return;
    go(runner, fail);
  });
}
/**
 * The longest whole URL that Share offers as a link: LINK_CHARS, or less in a dev build with
 * ?linkChars=N, so e2e reaches the valley file.
 */
const devLinkChars = Number(params.get('linkChars'));
const linkChars = import.meta.env.DEV && devLinkChars > 0 ? Math.min(devLinkChars, LINK_CHARS) : LINK_CHARS;
/**
 * Pauses the sandbox run (unless `pause` is false: the hidden tab has paused it) and gives its link
 * now (ADR 0014 item 7): its text, or `tooOld` past 100 days, or `tooBig` past a link's other
 * limits. The tick is the worker's, after the pause. A list accepted at that tick has not run yet,
 * so the run first steps one tick, and the link keeps everything the player did. One link is made
 * at a time (Share and each keep take turns), so the run steps once for those lists, not once a
 * link.
 */
const sandboxLink = oneAtATime(async function (
  pause: boolean = true,
): Promise<{ kind: 'link'; text: string; tick: number } | { kind: 'tooOld' } | { kind: 'tooBig' }> {
  const run = sandboxRun;
  if (!run) throw new Error('No sandbox run to share');
  if (pause) speedControl.player(0);
  const now = async (): Promise<number> => {
    const { tick } = await host.requestHash();
    if (sandboxRun !== run) throw new Error('The sandbox run changed while it was shared');
    return tick;
  };
  let tick = await now();
  if (host.log().some((e) => e.tick >= tick)) {
    host.post({ t: 'advance', ticks: 1 });
    tick = await now();
  }
  if (tick > MAX_LINK_TICKS) return { kind: 'tooOld' };
  const script = host.log().filter((e) => e.tick < tick);
  try {
    const from = run.from.length > 0 ? { from: run.from } : {};
    const text = await encodeLink({
      v: 1,
      tuning: tuningHash,
      setup: run.runner.setup,
      script,
      tick,
      ...from,
    });
    return { kind: 'link', text, tick };
  } catch {
    return { kind: 'tooBig' }; // past MAX_LINK_LISTS lists or MAX_LINK_BYTES of JSON
  }
});
/** The stage that records the sandbox for the postcard (ADR 0014 item 8), or null. */
let recording: Stage | null = null;
/** The postcard paper and ink (ADR 0014 item 8), whatever the contrast setting. */
const PAPER = '#f6f1e7';
const INK = '#1f2a33';
/** The caption band under the scene, in pixels. */
const BAND = 48;
/** The caption's room in the band: the postcard's 480 pixels less 12 at each side. */
const CAPTION_WIDTH = 456;

/**
 * Loads the face (ADR 0014 item 14) in each of `fonts` (CSS font shorthands) if the page has it;
 * with no such face it resolves at once. A face that fails to load leaves the fallback font, and
 * the export goes on.
 */
async function loadFaces(...fonts: string[]): Promise<void> {
  try {
    await Promise.all(fonts.map((f) => document.fonts.load(f)));
  } catch (e) {
    console.warn(e);
  }
}

/** The URL of a still image by id (`PLACEHOLDER-still-<scene>` or a chapter's own `still`). */
function stillUrl(id: string): string {
  const url = stillImages[`../content/placeholder/${id}.svg`] ?? stillImages[`../content/stills/${id}.svg`];
  if (!url) throw new Error(`No still image ${id}`);
  return url;
}

/**
 * Draws `blocks` as a PAGE_WIDTH page (ADR 0014 item 8) in ink on the paper, whatever the contrast
 * setting, and gives it as a PNG with no metadata. An image block whose source fails to load is
 * tried again, then replaced by the block's fallback (its scene's still image) once, then left out;
 * the page is still made.
 */
async function drawPage(blocks: readonly PageBlock[]): Promise<Blob> {
  await loadFaces(`28px ${ATKINSON}`, `bold 28px ${ATKINSON}`);
  const srcs = [...new Set(blocks.flatMap((b) => (b.kind === 'image' ? [b.src] : [])))];
  const fallbacks = new Map(
    blocks.flatMap((b) => (b.kind === 'image' && b.fallback ? [[b.src, b.fallback] as const] : [])),
  );
  const images = new Map(
    await Promise.all(
      srcs.map(
        async (src) =>
          [src, await loadImageWithRetry(src, ASSET_WAITS_MS, fallbacks.get(src) ?? null)] as const,
      ),
    ),
  );
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context for the page');
  const { height, ops } = layoutPage(blocks, (font, text) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  });
  // A new size clears the canvas and its state, so the fill and the text settings come after.
  [canvas.width, canvas.height] = [PAGE_WIDTH, Math.ceil(height)];
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  for (const op of ops) {
    if (op.op === 'text') {
      ctx.font = op.font;
      ctx.fillText(op.text, op.x, op.y);
    } else {
      const img = images.get(op.src);
      if (img) ctx.drawImage(img, op.x, op.y, op.w, op.h);
    }
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The page did not encode as a PNG'));
    }, 'image/png');
  });
}

/** Keeps the run now as the sandbox save: its link and its notes, which stay on the device. */
async function keepSandboxRun(pause = true): Promise<void> {
  const notes = sandboxRun?.notes ?? [];
  const link = await sandboxLink(pause);
  if (link.kind === 'link')
    await (await profileReady).keepSandbox({ link: link.text, notes: notes.map((n) => ({ ...n })) });
}
// A tab that goes hidden may never come back (the player closes it): keep the run the player
// acted in. The hidden tab has already paused the sim.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && sandboxRun && sandboxActed)
    keepSandboxRun(false).catch((e: unknown) => {
      console.error(e); // the save stays as it was
    });
});
/**
 * Keeps a link the player made or opened for the remix tree (ADR 0015 item 10), when it fits in a
 * link; a failed keep leaves the tree as it was.
 */
async function keepLink(text: string, from: string[], valley: SandboxValley, tick: number): Promise<void> {
  if (text.length > LINK_CHARS) return;
  const day = Math.floor(tick / SANDBOX_TICKS_PER_DAY);
  try {
    await (await profileReady).keepLink({ id: linkId(text), from, valley, day, text });
  } catch (e) {
    console.error(e);
  }
}
/**
 * Opens a link's `v1.<data>` text with `notes` as a new run (ADR 0014 item 7), or null for an old
 * or broken link, a setup that cannot be built included. The worker runs the script in one
 * forward to the tick before the link's, and the lists of that tick and the last step live, so
 * the run's first snapshot is at the link's tick; the run waits there, paused. An opened link (not
 * the player's own save, `own`) joins the remix tree, and the run's lineage ends with its id.
 */
async function openSandbox(text: string, notes: readonly { tick: number; text: string }[], own = false) {
  const stops = sandboxStops;
  const link = await decodeLink(text, tuningHash);
  if (!link) return null;
  let scenario: Scenario;
  try {
    scenario = sandboxStart(link.setup);
  } catch {
    return null;
  }
  // The player's own run, when they acted in it, is their save before the link replaces it.
  const run = sandboxRun;
  if (run && sandboxActed)
    await keepSandboxRun().catch((e: unknown) => {
      console.error(e); // the save stays as it was, and the link opens
    });
  // Back to title, or another start, while this open waited: no run starts behind them.
  if (sandboxStops !== stops || sandboxRun !== run)
    throw new Error('The sandbox stopped or changed while the valley opened');
  const before = Math.max(link.tick - 1, 0);
  const from = own ? (link.from ?? []) : lineageOf(link, text);
  const runner = await beginSandbox(link.setup, scenario, from, false, (r, fail) => {
    speedControl.runner(0);
    // A challenge's check reads the forward's steps (its events and season turns).
    host.fastForward(before, link.script, link.setup.challenge !== null).then(
      ({ steps }) => {
        if (sandboxRun?.runner !== r) return;
        r.forwarded(steps ?? [], link.script);
        for (const e of link.script) if (e.tick >= before) host.send(e.list);
        host.post({ t: 'advance', ticks: 1 });
      },
      (e: unknown) => {
        // A newer start's init rejects the forward too, and that start is no failure.
        if (sandboxRun?.runner === r) fail(e instanceof Error ? e.message : String(e));
      },
    );
  });
  if (sandboxRun?.runner === runner) sandboxRun.notes = notes.map((n) => ({ ...n }));
  if (!own) void keepLink(text, link.from ?? [], link.setup.valley, link.tick);
  return runner;
}

const game: GameService = {
  chapters,
  webgl: hasWebGL(),
  sandbox: {
    async status() {
      const p = await profileReady;
      const [pages, kith, valleys, save] = await Promise.all([p.pages(), p.kith(), p.valleys(), p.sandbox()]);
      // The profile's order, which is the order the valleys were first played in.
      const finished = valleys.filter(
        (v): v is SandboxValley => v !== 'kith' && (SANDBOX_VALLEYS as readonly string[]).includes(v),
      );
      return { unlocked: pages.length > 0, kith: kith !== null, valleys: finished, saved: save !== null };
    },
    devOpen: import.meta.env.DEV && params.get('sandbox') === 'new',
    valleyFile: { name: VALLEY_FILE, maxBytes: MAX_LINK_TEXT + 2 },
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
    start(setup) {
      // First, so a setup that does not build is never taken for the last visit's failed worker.
      workerFailed = false;
      let scenario: Scenario;
      try {
        scenario = sandboxStart(setup);
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
      // A start from a run (a rule change, a challenge) is the player's act. A run of the same seed
      // (a rule change) keeps the lineage; a new valley or a challenge has a new seed and none.
      const from = sandboxRun?.runner.setup.seed === setup.seed ? sandboxRun.from : [];
      return beginSandbox(setup, scenario, from, sandboxRun !== null, () => {
        // A run starts at 1x (ADR 0014 item 1); the sandbox runner sets no speed of its own.
        speedControl.runner(1);
        speedControl.player(1);
      });
    },
    workerFailed: sandboxWorkerFailed,
    snapshot: () => (sandboxRun?.lite ? { tick: sandboxRun.tick, lite: sandboxRun.lite } : null),
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
    notes: () => sandboxRun?.notes ?? [],
    pin(tick, text) {
      const cut = cutNote(text);
      if (!sandboxRun || !Number.isInteger(tick) || tick < 0 || cut.trim() === '') return;
      // A new array, so a screen that holds the last one sees the change; after the notes on the same tick.
      const notes = [...sandboxRun.notes];
      notes.splice(notes.filter((n) => n.tick <= tick).length, 0, { tick, text: cut });
      sandboxRun.notes = notes;
    },
    async share() {
      const run = sandboxRun;
      const link = await sandboxLink();
      if (link.kind !== 'link') return link;
      // The page's own address with no query: a dev query is not part of the valley.
      const url = `${location.origin}${location.pathname}#${link.text}`;
      if (!fitsInLink(url, linkChars)) return { kind: 'file', text: link.text };
      if (run) await keepLink(link.text, run.from, run.runner.setup.valley, link.tick);
      return { kind: 'link', url };
    },
    keptLinks: async () => (await profileReady).links(),
    open: (text) => openSandbox(text, []),
    async travelerCode(id) {
      const run = sandboxRun;
      const c = run?.lite?.creatures.find((x) => x.id === id);
      const t = c && run && travelerOf(c, run.runner.memories(id), run.runner.setup.travelers ?? []);
      return t ? encodeTraveler(t) : null;
    },
    readTraveler: decodeTraveler,
    // One at a time, so a second Save does not take the first one's pause for the player's speed.
    postcard: oneAtATime(async (caption: string) => {
      const stage = recording;
      if (!stage) throw new Error('No sandbox stage records');
      const back = speedControl.hold();
      try {
        // The caption's face. The wait also lets the pause go out, and the page show Save off,
        // before the encode holds the thread.
        await loadFaces(`20px ${ATKINSON}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
        // A copy on an ArrayBuffer, as a Blob takes.
        return new Blob([encodeGif(stage.postcard(caption)).slice()], { type: 'image/gif' });
      } finally {
        back();
      }
    }),
    async openSaved() {
      const profile = await profileReady;
      const save = await profile.sandbox();
      if (!save) return null;
      const runner = await openSandbox(save.link, save.notes, true);
      // A save that no longer opens (an older build's) is not offered again.
      if (!runner) await profile.dropSandbox(save.link);
      return runner;
    },
    async leave() {
      try {
        if (sandboxRun && sandboxActed) await keepSandboxRun();
      } catch (e) {
        console.error(e); // the save stays as it was
      }
      game.sandbox.stop();
    },
    visit() {
      // The timer lives from the sandbox screen's opening to its closing, on every exit (analytics only).
      const timer = createVisibleTimer(Date.now, document.visibilityState === 'hidden');
      const onVisibility = (): void => {
        timer.setHidden(document.visibilityState === 'hidden');
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        const minutes = timer.stop();
        if (minutes >= 1) analytics.count({ v: 1, e: 'sandbox', minutes });
      };
    },
    stop() {
      sandboxStops += 1;
      startWaiting?.('the sandbox stopped');
      endRunGiveUp?.();
      endRunGiveUp = null;
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
    // Pixi falls back to a canvas renderer when the browser gives no WebGL context. That cannot draw
    // the valley, so it is a failed start: the still version at once, with no retry (ADR 0014 item 11).
    if (app.renderer.name !== 'webgl') {
      app.destroy(true, true);
      throw new Error('The browser gave no WebGL context');
    }
    app.canvas.setAttribute('aria-hidden', 'true');
    el.appendChild(app.canvas);
    let scene = firstScene;
    const view = createMeadowView(app, scene, rigs, palette, {
      lensRadius: tuning.light.lensRadius,
      sight: { plain: tuning.foglight.sight, kite: tuning.foglight.kiteSight },
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
    /** The 2D canvas a capture draws the scene into. */
    const grab = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    /**
     * The scene as the canvas shows it now, as `w` x `h` pixels: the WebGL canvas's scene box, read
     * in the same task as its render, so the drawing buffer still holds the frame.
     */
    const capture = (w: number, h: number): Uint8ClampedArray => {
      if (!grab) throw new Error('No 2D context for the postcard');
      if (grab.canvas.width !== w || grab.canvas.height !== h)
        [grab.canvas.width, grab.canvas.height] = [w, h];
      const k = app.canvas.width / app.screen.width;
      const [x0, y0] = view.toScreen(0, 0);
      const [x1, y1] = view.toScreen(scene.width, scene.height);
      grab.drawImage(app.canvas, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, 0, 0, w, h);
      if (import.meta.env.DEV) dev.captures += 1;
      return grab.getImageData(0, 0, w, h).data;
    };
    let ring: ReturnType<typeof createFrameRing> | null = null;
    const newRing = () =>
      createFrameRing(capture, { seconds: 5, fps: 12, width: 480, aspect: scene.height / scene.width });
    // Pixi resizes with the window only; the phone layout also changes the element (the scene ends above the bottom bar).
    // Resized in the next frame, as Pixi does, so the observer's own callback changes no layout.
    let resizeFrame = 0;
    const resized = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (el.clientWidth !== app.screen.width || el.clientHeight !== app.screen.height) app.resize();
      });
    });
    resized.observe(el);
    const stage: Stage = {
      draw(prev: WorldLite, next: WorldLite, alpha, s, paused) {
        if (import.meta.env.DEV) dev.frames += 1;
        const cosmosBand = current === 'cosmos' ? band : null;
        view.setTopInset(cosmosBand ? valleyTop(cosmosBand, app.screen.height, scene.height) : 0);
        view.update(prev, next, alpha, s, paused);
        if (current === 'cosmos') cosmos.update(next, s, nodeAt, { points, breaks }, cosmosBand, soulId);
        if (current === 'soul') soul.update(next, s, soulId, insets);
        app.ticker.update(); // advances the view's clock and renders
        ring?.offer(performance.now());
      },
      setRecording(on) {
        ring?.clear();
        ring = on ? newRing() : null;
        if (on) recording = stage;
        else if (recording === stage) recording = null;
      },
      postcard(caption) {
        const out = document.createElement('canvas');
        const ctx = out.getContext('2d');
        if (!ctx) throw new Error('No 2D context for the postcard');
        // Atkinson Hyperlegible once the page has loaded it (ADR 0014 item 14), else the page's own font.
        const atkinson = [...document.fonts].some(
          (f) => f.family.replace(/"/g, '') === 'Atkinson Hyperlegible' && f.status === 'loaded',
        );
        const family = atkinson ? ATKINSON : getComputedStyle(document.body).fontFamily;
        // 20 px, or smaller down to 14 px until the caption fits; only past that does it squeeze.
        let size = 20;
        const fits = (): boolean => {
          ctx.font = `${String(size)}px ${family}`;
          return ctx.measureText(caption).width <= CAPTION_WIDTH;
        };
        while (size > 14 && !fits()) size -= 1;
        const font = `${String(size)}px ${family}`;
        return (ring?.frames() ?? []).map((f) => {
          [out.width, out.height] = [f.width, f.height + BAND];
          ctx.fillStyle = PAPER;
          ctx.fillRect(0, 0, out.width, out.height);
          const px = ctx.createImageData(f.width, f.height);
          px.data.set(f.data);
          ctx.putImageData(px, 0, 0);
          ctx.font = font;
          ctx.fillStyle = INK;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(caption, out.width / 2, f.height + BAND / 2, CAPTION_WIDTH);
          return { ...f, height: out.height, data: ctx.getImageData(0, 0, out.width, out.height).data };
        });
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
      clearTimeline() {
        points.length = 0;
        breaks.length = 0;
        lastSeen = null;
      },
      setInsets(i) {
        insets = i;
      },
      setTimelineBand(b) {
        band = b;
      },
      setScene(id) {
        scene = sceneOf(id);
        view.setScene(scene);
        // The frames keep one size: a new scene's aspect starts a new ring.
        if (ring) ring = newRing();
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
        stage.setRecording(false); // the frames go with the stage
        stopCounting();
        resized.disconnect();
        cancelAnimationFrame(resizeFrame);
        app.destroy(true, true);
      },
    };
    return stage;
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
    // A content id from the fixed chapter list; a chapter that Continue resumes was counted when it began.
    if (!resumed && chapters.some((c) => c.id === chapter.id))
      analytics.count({ v: 1, e: 'chapter', chapter: chapter.id });
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
    runner.done.then(
      () => {
        if (start === starts && chapters.some((c) => c.id === chapter.id))
          for (const c of betCounts(chapter.id, runner.log)) analytics.count(c);
      },
      () => undefined,
    );
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
  assetWaits: ASSET_WAITS_MS,
  stills: () => stillPages(chapters, createInk(inkStory), DEFAULT_FLAGS),
  stillUrl,
  async savedChapter() {
    const save = await (await slotsReady).load('auto');
    const index = save ? chapters.findIndex((c) => c.id === save.chapterId) : -1;
    return index < 0 ? null : index;
  },
  onSimLost: (cb) => {
    simLostListeners.add(cb);
    return () => simLostListeners.delete(cb);
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
  exportPage: oneAtATime(drawPage),
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
    createHelpKey,
    keyRows,
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
/**
 * A seed link in the address (ADR 0014 item 7): a fragment `#v<n>.`, which opens the sandbox on it.
 * Only `v1` decodes; any other version opens the lost-valley page.
 */
const LINK_FRAGMENT = /^#v[0-9]+\./;
const link = LINK_FRAGMENT.test(location.hash) ? location.hash.slice(1) : null;
// A link pasted into this page's address changes only the fragment, which loads nothing: load
// the page again, so it opens the link as a new page would.
window.addEventListener('hashchange', () => {
  if (LINK_FRAGMENT.test(location.hash)) location.reload();
});
if (app) mount(App, { target: app, props: { settings, hasSave: false, game, link } });

// Offline after the first load (ADR 0014 item 12). A build registers the worker; the dev server never does.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Playing offline is a bonus: a refused registration (blocked site data) changes nothing else.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
