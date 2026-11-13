import type { SimEvent } from '../sim/types.ts';

/**
 * A small data cue; the engine plays it. `who` names the voice, `ratio` is a frequency ratio. A
 * harmony with a `rhythm` sounds on each beat of it that is not 0.
 */
export type SoundCue =
  | { kind: 'harmony'; who: string; ratio: number; rhythm?: readonly number[] }
  | { kind: 'fade'; who: string }
  | { kind: 'clash'; who: string; ratio: number };

/**
 * Spec 11.5, the rows with a true M1 sim source: the three bid replies. Broken trust, forgiveness and
 * warm cluster stay null until the sim emits matching events (M2). Fog is `setFog` on the engine.
 * Once the village has its greeting song (interlude 3, spec 6.4), a bid turned toward plays its
 * harmony in that song's rhythm.
 */
export function soundFor(e: SimEvent, greeting?: readonly number[]): SoundCue | null {
  switch (e.t) {
    case 'bid':
      if (e.reply === 'toward')
        return greeting
          ? { kind: 'harmony', who: e.from, ratio: 1.5, rhythm: greeting }
          : { kind: 'harmony', who: e.from, ratio: 1.5 };
      if (e.reply === 'away') return { kind: 'fade', who: e.from };
      return { kind: 'clash', who: e.from, ratio: 16 / 15 };
    default:
      return null;
  }
}
