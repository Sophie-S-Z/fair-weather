import type { Season } from '../sim/types.ts';
import type { SoundCue } from './event-sounds.ts';
import { pitchFor, scaleTones } from './scale.ts';
import { DEFAULT_TIMBRE, playNote, type Timbre } from './voices.ts';

export interface EngineOptions {
  /** A creature's voice and line length, if it is known. */
  voice(who: string): { timbre: Timbre; lineLength: number } | undefined;
  season(): Season;
}

export interface AudioEngine {
  /** Sound is off until the first `setEnabled(true)`, which creates the context and plays the welcome chord once. */
  setEnabled(on: boolean): void;
  play(cue: SoundCue): void;
  /** Fog 0..1 muffles everything with a low-pass. */
  setFog(amount: number): void;
}

const WELCOME: Timbre = { wave: 'sine', attack: 0.15, decay: 1.6 };

export function createAudioEngine(ctxFactory: () => AudioContext, opts: EngineOptions): AudioEngine {
  let ctx: AudioContext | null = null;
  let bus: BiquadFilterNode | null = null;
  let on = false;
  let welcomed = false;
  let fog = 0;

  const applyFog = (): void => {
    if (bus && ctx) bus.frequency.value = 12000 - fog * 11200;
  };

  function play(cue: SoundCue): void {
    if (!on || !ctx || !bus) return;
    const t = ctx.currentTime;
    const v = 'who' in cue ? opts.voice(cue.who) : undefined;
    const timbre = v?.timbre ?? DEFAULT_TIMBRE;
    const f = pitchFor(v?.lineLength ?? 3.5, opts.season());
    switch (cue.kind) {
      case 'harmony':
        playNote(ctx, bus, f, timbre, t);
        playNote(ctx, bus, f * cue.ratio, timbre, t);
        break;
      case 'fade':
        playNote(ctx, bus, f, { ...timbre, decay: timbre.decay * 2 }, t);
        break;
      case 'clash':
        playNote(ctx, bus, f, timbre, t, 0.08);
        playNote(ctx, bus, f * cue.ratio, timbre, t, 0.08);
        break;
    }
  }

  return {
    setEnabled(next) {
      on = next;
      if (next) {
        if (!ctx) {
          ctx = ctxFactory();
          bus = ctx.createBiquadFilter();
          bus.type = 'lowpass';
          bus.connect(ctx.destination);
          applyFog();
        }
        void ctx.resume();
        if (!welcomed) {
          welcomed = true;
          const tones = scaleTones(opts.season());
          const t = ctx.currentTime;
          for (const i of [0, 2, 3]) playNote(ctx, bus as BiquadFilterNode, tones[i] as number, WELCOME, t);
        }
      } else if (ctx) {
        void ctx.suspend();
      }
    },
    play,
    setFog(amount) {
      fog = Math.min(1, Math.max(0, amount));
      applyFog();
    },
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
