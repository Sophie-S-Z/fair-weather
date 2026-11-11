import type { SimEvent } from '../sim/types.ts';

/** A small data cue; the engine plays it. `who` names the voice, `ratio` is a frequency ratio. */
export type SoundCue =
  | { kind: 'harmony'; who: string; ratio: number }
  | { kind: 'fade'; who: string }
  | { kind: 'clash'; who: string; ratio: number }
  | { kind: 'clink' }
  | { kind: 'bowl' };

/** An opinion at or below this reads as broken trust. */
export const BROKEN_TRUST = -0.5;

/**
 * Spec 11.5. No M1 sim event is a warm cluster (that and fog are not events; fog is `setFog` on the engine).
 * Forgiveness is a creature returning after it left.
 */
export function soundFor(e: SimEvent): SoundCue | null {
  switch (e.t) {
    case 'bid':
      if (e.reply === 'toward') return { kind: 'harmony', who: e.from, ratio: 1.5 };
      if (e.reply === 'away') return { kind: 'fade', who: e.from };
      return { kind: 'clash', who: e.from, ratio: 16 / 15 };
    case 'opinion':
      return e.value <= BROKEN_TRUST ? { kind: 'clink' } : null;
    case 'return':
      return { kind: 'bowl' };
    default:
      return null;
  }
}
