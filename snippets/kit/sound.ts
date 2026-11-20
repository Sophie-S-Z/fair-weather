// Sound cues for comic clips: each creature chirps in its own voice, plus a few soft effects.
// The sounds are synth notes in the toybox key, so every clip sounds like the toybox.
import { RUNS, tone, type Mood } from '../../src/audio/engine.ts';
import { playNote } from '../../src/audio/voices.ts';
import { VOICE, type Who } from './cast.ts';

/** One sound at loop time `at`: a creature's chirp, or an effect. */
export type Cue =
  | { at: number; who: Who; mood: Mood }
  | { at: number; fx: 'pop' | 'thud' | 'swish' | 'drip' | 'ding' | 'hold' };

/** One step of a chirp run, in seconds. */
const STEP = 0.09;

function play(ac: AudioContext, out: AudioNode, cue: Cue, when: number): void {
  if ('who' in cue) {
    const { timbre, note } = VOICE[cue.who];
    RUNS[cue.mood].forEach((step, i) => {
      playNote(ac, out, tone(note + step), timbre, when + i * STEP, 0.08);
    });
    return;
  }
  const fx = {
    pop: () => {
      playNote(ac, out, tone(7), { wave: 'sine', attack: 0.005, decay: 0.12 }, when, 0.06);
    },
    thud: () => {
      playNote(ac, out, 98, { wave: 'sine', attack: 0.002, decay: 0.25 }, when, 0.16);
    },
    swish: () => {
      playNote(ac, out, tone(9), { wave: 'triangle', attack: 0.04, decay: 0.15 }, when, 0.03);
      playNote(ac, out, tone(6), { wave: 'triangle', attack: 0.04, decay: 0.15 }, when + 0.05, 0.03);
    },
    drip: () => {
      playNote(ac, out, tone(8), { wave: 'sine', attack: 0.002, decay: 0.08 }, when, 0.05);
    },
    ding: () => {
      playNote(ac, out, tone(5), { wave: 'sine', attack: 0.003, decay: 1.2 }, when, 0.07);
      playNote(ac, out, tone(7), { wave: 'sine', attack: 0.003, decay: 1.2 }, when + 0.12, 0.05);
    },
    // A low soft note under a long hold, before the turn.
    hold: () => {
      playNote(ac, out, tone(0) / 2, { wave: 'sine', attack: 0.4, decay: 1.6 }, when, 0.05);
    },
  };
  fx[cue.fx]();
}

/** The `sound` function of a loop: plays each cue in the window [from, to) of loop time. */
export function cues(list: readonly Cue[]) {
  return (ac: AudioContext, out: AudioNode, from: number, to: number): void => {
    // The window is the frame that just passed, so each cue in it plays now.
    for (const cue of list) if (cue.at >= from && cue.at < to) play(ac, out, cue, ac.currentTime);
  };
}
