import type { SimEvent } from '../sim/types.ts';

/** A small data cue; the engine plays it. `who` names the voice, `ratio` is a frequency ratio. */
export type SoundCue =
  | { kind: 'harmony'; who: string; ratio: number }
  | { kind: 'fade'; who: string }
  | { kind: 'clash'; who: string; ratio: number };

/**
 * Spec 11.5, the rows with a true M1 sim source: the three bid replies. Broken trust, forgiveness and
 * warm cluster stay null until the sim emits matching events (M2). Fog is `setFog` on the engine.
 */
export function soundFor(e: SimEvent): SoundCue | null {
  switch (e.t) {
    case 'bid':
      if (e.reply === 'toward') return { kind: 'harmony', who: e.from, ratio: 1.5 };
      if (e.reply === 'away') return { kind: 'fade', who: e.from };
      return { kind: 'clash', who: e.from, ratio: 16 / 15 };
    default:
      return null;
  }
}
