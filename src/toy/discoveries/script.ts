import type { Action, Beat, PropKind, Scene, StickerId } from '../types.ts';

/** Writes a scene beat by beat on a moving clock. */
export class Script {
  readonly beats: Beat[] = [];
  at = 0;

  /** Moves the clock on by `seconds`. */
  wait(seconds: number): this {
    this.at += seconds;
    return this;
  }

  /** Adds actions at the current time. */
  do(...actions: Action[]): this {
    for (const a of actions) this.beats.push({ ...a, at: this.at });
    return this;
  }

  scene(id: StickerId, actors: string[], unlock: StickerId[], needs: PropKind | null, tail = 1): Scene {
    return { id, actors, beats: this.beats, length: this.at + tail, unlock, needs };
  }
}
