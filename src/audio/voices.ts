import { z } from 'zod';

/** A species voice (`content/cast/<id>.json`, field `timbre`); the same files render reads for `scale`. */
export const VoiceSchema = z.object({
  id: z.string().min(1),
  timbre: z.object({
    wave: z.enum(['sine', 'triangle', 'square', 'sawtooth']),
    /** Seconds to full volume. */
    attack: z.number().positive(),
    /** Seconds to fade out. */
    decay: z.number().positive(),
  }),
});

export type Timbre = z.infer<typeof VoiceSchema>['timbre'];

export const DEFAULT_TIMBRE: Timbre = { wave: 'sine', attack: 0.01, decay: 0.8 };

/** One enveloped oscillator. */
export function playNote(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  timbre: Timbre,
  at: number,
  gain = 0.12,
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = timbre.wave;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + timbre.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + timbre.attack + timbre.decay);
  osc.connect(g);
  g.connect(dest);
  osc.start(at);
  osc.stop(at + timbre.attack + timbre.decay + 0.05);
}
