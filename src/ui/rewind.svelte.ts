// The rewind the game and sandbox screens share (spec 8, ADR 0012 item 10): the tick the strip
// asks for and the rewound world, the sim paused while rewound, and each frame, which draws the
// rewound world, or the live tween with the snapshot drawn, its tick, and the timeline then.
import type { WorldLite } from '../sim-host/protocol.ts';
import type { Stage } from './game-service.ts';
import type { Settings } from './settings.ts';

export function createRewind(deps: {
  currentSpeed: () => number;
  setSpeed: (multiplier: number) => void;
  /** The world at an earlier tick of the run (GameService.rewind). */
  rewind: (tick: number) => Promise<WorldLite>;
}) {
  let at: number | null = $state(null);
  let world: WorldLite | null = $state.raw(null);
  /**
   * The live snapshot the last frame drew, its tick, and the run's timeline then. The screens' text
   * reads these, so it changes as often as the scene is drawn, not at every step: at a bet's reveal
   * speed the sim steps hundreds of times a second, and rewriting the text for each step costs the
   * page more than the steps come in, so it falls behind the sim.
   */
  let drawn: WorldLite | null = $state.raw(null);
  let drawnTick = $state(0);
  let timeline: ReturnType<Stage['timeline']> = $state.raw({ points: [], breaks: [] });
  let liveTick = 0;
  /** Only the newest rewind request is drawn. */
  let request = 0;
  let speedBefore = 1;

  return {
    /** The tick the strip asks for, or null for now. While rewound the sim is paused. */
    get at() {
      return at;
    },
    /** The rewound world once it arrives, or null. */
    get world() {
      return world;
    },
    get drawn() {
      return drawn;
    },
    get drawnTick() {
      return drawnTick;
    },
    get timeline() {
      return timeline;
    },
    /** The tick of the newest live snapshot. */
    live(tick: number): void {
      liveTick = tick;
    },
    /** Pauses the sim on the first move of the strip, and asks for the world at `t`. */
    to: (t: number): void => {
      if (at === null) {
        speedBefore = deps.currentSpeed();
        deps.setSpeed(0);
      }
      at = t;
      const asked = (request += 1);
      deps.rewind(t).then(
        (lite) => {
          if (asked === request) world = lite;
        },
        () => undefined, // the worker restarted; the strip asks again on its next move
      );
    },
    /** Back to now, at the speed from before the rewind. */
    backToNow: (): void => {
      if (at === null) return;
      at = null;
      world = null;
      request += 1;
      deps.setSpeed(speedBefore);
    },
    /** A new run: back to now, at the speed the start set, with no snapshot drawn yet. */
    reset(): void {
      at = null;
      world = null;
      request += 1;
      drawn = null;
    },
    /** Draws one frame: the rewound world while there is one, else the live tween. */
    frame(stage: Stage, from: WorldLite, to: WorldLite, alpha: number, settings: Settings): void {
      if (world) {
        stage.draw(world, world, 1, settings);
        return;
      }
      if (drawn !== to) {
        drawn = to;
        drawnTick = liveTick;
        timeline = stage.timeline();
      }
      stage.draw(from, to, alpha, settings);
    },
  };
}
