// What the game screen gets from main.ts (ADR 0011): types only, so ui imports no render or input.
import type { createHelpKey, createKeyboard, keyRows } from '../input/keyboard.ts';
import type { createPointer } from '../input/pointer.ts';
import type { Hints } from '../input/hints.ts';
import type { createHoldStill } from '../input/hold-still.ts';
import type { createWait } from '../input/wait.ts';
import type { BenchSpot } from '../input/verbs.ts';
import type { nextView, ViewName } from '../input/zoom.ts';
import type { MythPage } from '../myth/grammar.ts';
import type { RgbaFrame } from '../persist/gif.ts';
import type { PageBlock } from '../persist/page-image.ts';
import type { Band } from '../render/cosmos-view.ts';
import type { BookPage } from '../persist/profile.ts';
import type { MeadowView } from '../render/meadow-view.ts';
import type { TimelinePoint } from '../render/timeline.ts';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Dials, Structure } from '../sim/types.ts';
import type { ChapterRunner } from '../story/chapter-runner.ts';
import type { Flags } from '../story/flags.ts';
import type { Journey } from '../story/journey.ts';
import type { peekRule } from '../story/peek.ts';
import type { SandboxRunner, SandboxSetup, SandboxValley } from '../story/sandbox.ts';
import type { Chapter } from '../story/schema.ts';
import type { StillPage } from '../story/stills.ts';
import type { Settings } from './settings.ts';

/**
 * The Meadow, Cosmos, and Soul views in a canvas that fills its element. Screen points are client
 * coordinates.
 */
export interface Stage extends Pick<
  MeadowView,
  'setFocus' | 'setShot' | 'showHeatmap' | 'setCursor' | 'visitor' | 'endVisit' | 'setGateLamp'
> {
  /**
   * Draws the Meadow over the scene `content/scenes/<id>.json` (its ground, trees, bench spots, and
   * camera shots). Throws for an id with no scene.
   */
  setScene(id: string): void;
  /**
   * Draws every view in the palette of a season or a valley (`content/palettes/<id>.json`, spec
   * 11.3 and 7.3). Throws for an id with no palette.
   */
  setPalette(id: string): void;
  /**
   * Shows a view. `soul` is the creature the Soul view is about, and under Cosmos the picked
   * creature, whose friendships are drawn in full ink. Under Cosmos and Soul the camera shows the
   * whole valley.
   */
  setView(view: ViewName, soul: string | null): void;
  /** Feeds a live snapshot to the Cosmos timeline and its break marks. An earlier tick starts a new run. */
  snapshot(tick: number, lite: WorldLite): void;
  /** This run's timeline points and the ticks at which a two-sided friendship ended. */
  timeline(): { points: readonly TimelinePoint[]; breaks: readonly number[] };
  /** Forgets the timeline, for a new run that may start at a later tick (an opened seed link). */
  clearTimeline(): void;
  /** The screen pixels the HTML takes on the right and at the bottom; the Soul view centers in the rest. */
  setInsets(insets: { right: number; bottom: number }): void;
  /**
   * The Cosmos timeline band the HTML lays out at the top, in screen pixels (the strip's box and the
   * band's bottom), or null without one. The Cosmos draws the strip in that box, and the valley
   * fits below the band, so no node sits on the strip.
   */
  setTimelineBand(band: Band | null): void;
  draw(prev: WorldLite, next: WorldLite, alpha: number, settings: Settings): void;
  /**
   * Only the sandbox records (ADR 0014 item 8). While on, each draw offers the scene to a ring of
   * the last 5 seconds, at most 12 frames a second, 480 pixels wide. Off forgets the frames.
   */
  setRecording(on: boolean): void;
  /**
   * The ring's frames, each over a 48-pixel paper band with `caption` in 20-pixel ink: 480 x 318 for
   * a 1600 x 900 scene. None when not recording.
   */
  postcard(caption: string): RgbaFrame[];
  /** The creature under a screen point in the current view, or null. Cosmos snaps within 44 pixels. */
  pick(x: number, y: number): string | null;
  toScene(x: number, y: number): { x: number; y: number };
  /** The current scene's bench spots. */
  readonly benchSpots: readonly BenchSpot[];
  /** The scene's size in scene units; the cursor stays inside it. */
  sceneSize: { width: number; height: number };
  destroy(): void;
}

/** The sandbox (ADR 0014 items 1 to 5) on the game's worker. */
export interface SandboxService {
  /**
   * Whether the title's Sandbox button opens (the Book of Skies has a page), whether the profile
   * keeps a Kith, the finished valleys in first-played order, and whether a sandbox save exists.
   */
  status(): Promise<{ unlocked: boolean; kith: boolean; valleys: SandboxValley[]; saved: boolean }>;
  /** Dev only: ?sandbox=new opens the sandbox on a new Kith valley instead of the title. */
  readonly devOpen: boolean;
  /**
   * The name a valley file saves under (ADR 0014 item 7), and the most bytes of one that the game
   * reads: a link's longest text and a line end.
   */
  readonly valleyFile: { name: string; maxBytes: number };
  /** The scene a valley's sandbox shows, whose bench spots `start` uses. */
  scene(valley: SandboxValley): string;
  /**
   * A new setup of `valley`: a new seed, the default knobs and switches, and nothing placed;
   * with `fromKith`, Kith with the carry the profile keeps.
   */
  newSetup(valley: SandboxValley, fromKith: boolean): Promise<SandboxSetup>;
  /**
   * Starts a new run of `setup` at day 0 and 1x, and resolves with its runner at the run's first
   * snapshot; the run before it stops. Rejects, and the run before goes on, when the setup cannot
   * be built. Rejects, and no run goes on (`workerFailed` is true), when the worker posts an error
   * or the host gives up before that snapshot. Rejects also when a newer start or a stop replaces it.
   */
  start(setup: SandboxSetup): Promise<SandboxRunner>;
  /** Whether the last start failed in the worker, so no run goes on until the title starts the worker again. */
  workerFailed(): boolean;
  /** The run's newest snapshot and its tick, or null without a run or before its first. */
  snapshot(): { tick: number; lite: WorldLite } | null;
  /** The structures in the run now that the player placed: neither the base scenario nor bench density made them. */
  placedStructures(): Structure[];
  /** The bushes in the run now that the player placed. */
  placedBushes(): SandboxSetup['bushes'];
  /**
   * The notes pinned on the run now, in tick order (ADR 0014 item 5). Each start drops them, a rule
   * change too, since they mark moments of the run before.
   */
  notes(): readonly { tick: number; text: string }[];
  /**
   * Pins a note on `tick` of the run now, cut to 80 characters. Notes are the player's own words: they
   * stay on the device and never go in a seed link. Does nothing without a run, or for a blank note.
   */
  pin(tick: number, text: string): void;
  /**
   * Shares the run now (ADR 0014 item 7). It pauses the run, steps it one tick when a command list
   * waits at the paused tick, and the link holds the setup, every command list, and the tick, so it
   * opens to the same world. A link whose whole URL is too long comes as the text of a valley file.
   * Past 100 days the run cannot be shared (`tooOld`), nor past a link's other limits (`tooBig`).
   * Notes never go in a link. Rejects without a run.
   */
  share(): Promise<
    { kind: 'link'; url: string } | { kind: 'file'; text: string } | { kind: 'tooOld' } | { kind: 'tooBig' }
  >;
  /**
   * Opens a link's or a valley file's `v1.<data>` text as a new run, paused at the link's tick, as
   * `start` does (it resolves at the run's first snapshot). Null, and the run before goes on, for an
   * old or broken link. A link at tick 0 opens at tick 1, since the first snapshot comes after a step.
   */
  open(text: string): Promise<SandboxRunner | null>;
  /**
   * Opens the sandbox save's link with its notes, as `open` does; null without a save. A save that
   * no longer opens is dropped, so it is not offered again.
   */
  openSaved(): Promise<SandboxRunner | null>;
  /**
   * Keeps the run now as the sandbox save (its link and notes) when the player acted (a command or
   * a start from the run, such as a rule change) since the start choice or an open, then stops the
   * run. A run that cannot be a link keeps the save as it was. A tab that goes hidden keeps the
   * save in the same way.
   */
  leave(): Promise<void>;
  /**
   * The postcard GIF (ADR 0014 item 8) of the recording stage's frames with `caption`, which the
   * player wrote at the moment of export. The sim pauses while it encodes, and then goes on at the
   * speed from before. One postcard at a time. Rejects without frames, or when it cannot be made.
   */
  postcard(caption: string): Promise<Blob>;
  /**
   * Starts counting the visible time in the sandbox screen (opt-in analytics only); the returned
   * function ends the visit, once, when the screen closes.
   */
  visit(): () => void;
  /** Stops the run. */
  stop(): void;
}

export interface GameService {
  chapters: readonly Chapter[];
  /** Whether this browser gave a WebGL context at load (ADR 0014 item 10). */
  webgl: boolean;
  sandbox: SandboxService;
  defaultFlags: Flags;
  /** The named cast (spec 5.3), in id order. */
  castIds: readonly string[];
  /** Both warmths of the tie above the friend threshold: a friendship the Cosmos draws (spec 9.1). */
  isFriend(lite: WorldLite, a: string, b: string): boolean;
  /**
   * Each creature's friends (both warmths above the friend threshold) and scars (either warmth
   * below 0), in tie order, over every tie, creatures away included. A creature with neither is
   * left out.
   */
  ties(lite: WorldLite): ReadonlyMap<string, { friends: readonly string[]; scars: readonly string[] }>;
  /** The chapter Begin starts at: 0, or ?chapter=N in a dev build. */
  firstChapter: number;
  createStage(el: HTMLElement): Promise<Stage>;
  /** The autosave's chapter and flags, or null. The next `startChapter` of that chapter resumes from its checkpoint. */
  resume(): Promise<{ index: number; flags: Flags } | null>;
  /** True when an autosave can be loaded. */
  hasSave(): Promise<boolean>;
  /**
   * Builds the chapter's scenario, starts a new sim run, and returns its runner. A `carry: true`
   * chapter starts from the year carry of the last snapshot (ADR 0012 item 1). A valley first waits
   * for Kith's leg from the valley before, and starts from the journey; the homecoming starts from
   * Kith, with `kithHeld` from Kith's average warmth (ADR 0013 items 10 and 12). Rejects when the
   * chapter cannot start, or when a newer start replaced this one while it waited.
   */
  startChapter(chapter: Chapter, flags: Flags): Promise<ChapterRunner>;
  /**
   * Stops the chapter now playing (Back to title): its runner stops, a start still waiting for
   * Kith is dropped, and neither changes the journey or Kith.
   */
  stop(): void;
  /** Peek under the hood (spec 8, 9.3) at `dials`, by the rules of the chapter now playing. */
  peek(dials: Dials): ReturnType<typeof peekRule>;
  /**
   * The world at an earlier tick of this chapter or sandbox run, clamped to what the worker kept;
   * the live run does not change (ADR 0012 item 10).
   */
  rewind(tick: number): Promise<WorldLite>;
  /**
   * The fireside myth (spec 10.6) of this visit's year log, `flags`, and the sky warmths of the
   * last snapshot; the narrator is one of the creatures there, not away and not gone.
   */
  myth(flags: Flags): MythPage;
  /** The Book of Skies (spec 10.6 item 7): one page per finished year, from year 1. */
  book(): Promise<BookPage[]>;
  /** Keeps a finished year's myth as the next page of the Book of Skies, with this valley's seed. */
  keepMyth(page: MythPage): Promise<void>;
  /** The journey from the bridge's end (ADR 0013 item 9), or null before it. */
  journey(): Journey | null;
  /**
   * Keeps the player's line on the journal page of `valley`, cut to 80 characters. It is stored on
   * the journey (saved with the next autosave) and stays on the device. Does nothing without a page.
   */
  setCaption: (valley: string, text: string) => void;
  /** The waits before each new try of an asset that fails to load (ADR 0014 item 11): the worker, images. */
  assetWaits: readonly number[];
  /** The still version (ADR 0014 item 10): one page per chapter in play order, read with the default flags. */
  stills(): StillPage[];
  /** The URL of a still image by id (`StillPage.still`). Throws for an id with no file. */
  stillUrl(id: string): string;
  /** The autosave's chapter index, or null without one. It reads no Ink and changes no save. */
  savedChapter(): Promise<number | null>;
  /**
   * Calls `cb` when the sim is lost: the worker failed to load on every try, or failed again with
   * nothing new played (ADR 0014 item 11). Returns an unsubscribe.
   */
  onSimLost(cb: () => void): () => void;
  /** The journal's drawing of a valley (a placeholder, ADR 0010), as a URL, or null without one. */
  journalDrawing: (valley: string) => string | null;
  /** The sixth verse (ADR 0013 item 13) of the journey and the homecoming's `flags`. Throws with no journey. */
  sixthVerse(flags: Flags): { title: string; text: string; note: string | null };
  /** Ends the journey: the verse joins the year's page in the Book of Skies, and the save is kept. */
  finishJourney(verse: { title: string; text: string; note: string | null }): Promise<void>;
  /** The Quiet Visitor's feathers so far (ADR 0012 item 12). */
  feathers(): Promise<number>;
  /** Counts one more feather; returns the new count. */
  addFeather(): Promise<number>;
  /**
   * A journal page or a Book of Skies year page as a 1080-pixel-wide PNG made on the device (ADR
   * 0014 item 8), from the same data as its HTML. An image block that does not load is left out,
   * and the page is still made. One page at a time. Rejects when the page cannot be made.
   */
  exportPage: (blocks: PageBlock[]) => Promise<Blob>;
  /** Every live snapshot with its tick (the next tick to run). */
  onSnapshot(cb: (lite: WorldLite, tick: number) => void): () => void;
  /**
   * The player's sim speed (ADR 0011): 0 pauses, 1 or 2 is the player's multiplier, which the sim
   * applies on top of the runner's speed (src/ui/speed.ts). While the tab is hidden the sim gets 0.
   * `currentSpeed` is the runner's speed times the player's multiplier.
   */
  speed(multiplier: number): void;
  currentSpeed(): number;
  input: {
    createKeyboard: typeof createKeyboard;
    /** ? from anywhere on the screen, and the rows the help sheet lists. */
    createHelpKey: typeof createHelpKey;
    keyRows: typeof keyRows;
    createPointer: typeof createPointer;
    createHints: () => Hints;
    /** An over-poke detector with the tuning's window and count. */
    createOverPoke: () => { poke(): boolean };
    /** A hold-still timer on the page clock, for the Long Night. */
    createHoldStill: () => ReturnType<typeof createHoldStill>;
    /** The Quiet Visitor's wait: three minutes of real time with no input (ADR 0012 item 12). */
    createWait: () => ReturnType<typeof createWait>;
    nextView: typeof nextView;
  };
}
