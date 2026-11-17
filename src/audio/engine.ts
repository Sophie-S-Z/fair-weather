import { DEFAULT_TIMBRE, playNote, type Timbre } from './voices.ts';

/** The table's key: C major pentatonic over two octaves, in Hz. */
export const SCALE: readonly number[] = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21].map(
  (step) => 261.63 * 2 ** (step / 12),
);

/** A creature's chirp shape: each mood is a short run of scale steps from the creature's own note. */
export type Mood = 'happy' | 'sad' | 'angry' | 'surprised' | 'sleepy';
const RUNS: Record<Mood, readonly number[]> = {
  happy: [0, 2, 4],
  sad: [2, 1, 0],
  angry: [0, 0, 0],
  surprised: [0, 4],
  sleepy: [1, 0],
};

/** A small data cue; the engine plays it. */
export type SoundCue = { kind: 'chirp'; who: string; mood: Mood } | { kind: 'pop' } | { kind: 'sticker' };

export interface Voice {
  timbre: Timbre;
  /** Index into `SCALE` of the creature's own note. */
  note: number;
}

export interface AudioEngine {
  /** Sound is off until the first `setEnabled(true)`, which creates the context. */
  setEnabled(on: boolean): void;
  play(cue: SoundCue): void;
}

/** One step of a run, in seconds. */
const STEP = 0.09;

const tone = (i: number): number => SCALE[Math.max(0, Math.min(SCALE.length - 1, i))] ?? 261.63;

export function createAudioEngine(
  ctxFactory: () => AudioContext,
  voice: (who: string) => Voice | undefined,
): AudioEngine {
  let ctx: AudioContext | null = null;
  let on = false;

  function play(cue: SoundCue): void {
    if (!on || !ctx) return;
    const t = ctx.currentTime;
    const out = ctx.destination;
    switch (cue.kind) {
      case 'chirp': {
        const v = voice(cue.who);
        const base = v?.note ?? 4;
        const timbre = v?.timbre ?? DEFAULT_TIMBRE;
        RUNS[cue.mood].forEach((step, i) => {
          playNote(ctx as AudioContext, out, tone(base + step), timbre, t + i * STEP, 0.08);
        });
        break;
      }
      case 'pop':
        playNote(ctx, out, tone(7), { wave: 'sine', attack: 0.005, decay: 0.12 }, t, 0.06);
        break;
      case 'sticker':
        [0, 2, 4, 5].forEach((i, k) => {
          playNote(
            ctx as AudioContext,
            out,
            tone(i + 3),
            { wave: 'triangle', attack: 0.01, decay: 0.6 },
            t + k * STEP,
          );
        });
        break;
    }
  }

  return {
    setEnabled(next) {
      on = next;
      if (next) {
        ctx ??= ctxFactory();
        void ctx.resume();
      } else if (ctx) {
        void ctx.suspend();
      }
    },
    play,
  };
}

/**
 * A saved "sound on" must not create the context at page load: this enables the engine on the first
 * user gesture (pointerdown or keydown) if sound is still on then.
 */
export function enableOnGesture(engine: AudioEngine, target: EventTarget, isOn: () => boolean): void {
  const go = (): void => {
    target.removeEventListener('pointerdown', go);
    target.removeEventListener('keydown', go);
    if (isOn()) engine.setEnabled(true);
  };
  target.addEventListener('pointerdown', go);
  target.addEventListener('keydown', go);
}
