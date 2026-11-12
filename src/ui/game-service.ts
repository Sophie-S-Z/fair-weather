// What the game screen gets from main.ts (ADR 0011): types only, so ui imports no render or input.
import type { createKeyboard } from '../input/keyboard.ts';
import type { createPointer } from '../input/pointer.ts';
import type { Hints } from '../input/hints.ts';
import type { BenchSpot } from '../input/verbs.ts';
import type { MeadowView } from '../render/meadow-view.ts';
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Season } from '../sim/types.ts';
import type { ChapterRunner } from '../story/chapter-runner.ts';
import type { Flags } from '../story/flags.ts';
import type { Chapter } from '../story/schema.ts';
import type { Settings } from './settings.ts';

/** The Meadow view in a canvas that fills its element. Screen points are client coordinates. */
export interface Stage extends Pick<MeadowView, 'setFocus' | 'setShot' | 'showHeatmap'> {
  /** Draws the Meadow in the season's palette (spec 11.3). */
  setSeason(season: Season): void;
  draw(prev: WorldLite, next: WorldLite, alpha: number, settings: Settings): void;
  pick(x: number, y: number): string | null;
  toScene(x: number, y: number): { x: number; y: number };
  benchSpots: readonly BenchSpot[];
  destroy(): void;
}

export interface GameService {
  chapters: readonly Chapter[];
  defaultFlags: Flags;
  /** The chapter Begin starts at: 0, or ?chapter=N in a dev build. */
  firstChapter: number;
  createStage(el: HTMLElement): Promise<Stage>;
  /** The autosave's chapter and flags, or null. The next `startChapter` of that chapter resumes from its checkpoint. */
  resume(): Promise<{ index: number; flags: Flags } | null>;
  /** True when an autosave can be loaded. */
  hasSave(): Promise<boolean>;
  /**
   * Builds the chapter's scenario, starts a new sim run, and returns its runner. A `carry: true`
   * chapter starts from the year carry of the last snapshot (ADR 0012 item 1).
   */
  startChapter(chapter: Chapter, flags: Flags): ChapterRunner;
  onSnapshot(cb: (lite: WorldLite) => void): () => void;
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
  };
}
