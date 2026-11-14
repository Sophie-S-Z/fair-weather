// What the game screen gets from main.ts (ADR 0011): types only, so ui imports no render or input.
import type { createKeyboard } from '../input/keyboard.ts';
import type { createPointer } from '../input/pointer.ts';
import type { Hints } from '../input/hints.ts';
import type { createHoldStill } from '../input/hold-still.ts';
import type { createWait } from '../input/wait.ts';
import type { BenchSpot } from '../input/verbs.ts';
import type { nextView, ViewName } from '../input/zoom.ts';
import type { MythPage } from '../myth/grammar.ts';
import type { Band } from '../render/cosmos-view.ts';
import type { BookPage } from '../persist/profile.ts';
import type { MeadowView } from '../render/meadow-view.ts';
import type { TimelinePoint } from '../render/timeline.ts';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Dials } from '../sim/types.ts';
import type { ChapterRunner } from '../story/chapter-runner.ts';
import type { Flags } from '../story/flags.ts';
import type { Journey } from '../story/journey.ts';
import type { peekRule } from '../story/peek.ts';
import type { Chapter } from '../story/schema.ts';
import type { Settings } from './settings.ts';

/**
 * The Meadow, Cosmos, and Soul views in a canvas that fills its element. Screen points are client
 * coordinates.
 */
export interface Stage extends Pick<
  MeadowView,
  'setFocus' | 'setShot' | 'showHeatmap' | 'setCursor' | 'visitor' | 'endVisit'
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
  /** The screen pixels the HTML takes on the right and at the bottom; the Soul view centers in the rest. */
  setInsets(insets: { right: number; bottom: number }): void;
  /**
   * The Cosmos timeline band the HTML lays out at the top, in screen pixels (the strip's box and the
   * band's bottom), or null without one. The Cosmos draws the strip in that box, and the valley
   * fits below the band, so no node sits on the strip.
   */
  setTimelineBand(band: Band | null): void;
  draw(prev: WorldLite, next: WorldLite, alpha: number, settings: Settings): void;
  /** The creature under a screen point in the current view, or null. Cosmos snaps within 44 pixels. */
  pick(x: number, y: number): string | null;
  toScene(x: number, y: number): { x: number; y: number };
  /** The current scene's bench spots. */
  readonly benchSpots: readonly BenchSpot[];
  /** The scene's size in scene units; the cursor stays inside it. */
  sceneSize: { width: number; height: number };
  destroy(): void;
}

export interface GameService {
  chapters: readonly Chapter[];
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
   * The world at an earlier tick of this chapter, clamped to what the worker kept; the live run
   * does not change (ADR 0012 item 10).
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
