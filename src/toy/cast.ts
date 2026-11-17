import type { Timbre } from '../audio/voices.ts';
import type { Shell } from '../render/line/shell.ts';
import type { CastId, Icon } from './types.ts';

export interface Temper {
  name: string;
  /** One line on who they are, for screen readers and the creature's button. */
  about: string;
  /** Chance to share a cookie. Echo and Snail use their own rules (see `cookieMove`). */
  share: number;
  /** What they think about when bored. */
  idle: Icon;
  /** The mood they rest in. */
  rest: Shell;
  /** Table units per second. */
  speed: number;
  /** Size over a plain creature. */
  scale: number;
  /** Body tint: each creature has its own. */
  tint: number;
  timbre: Timbre;
  /** Index of the creature's own note in the scale. */
  note: number;
}

const calm: Shell = { tightness: 0, bristle: 0, color: 0.2, softness: 0.3 };

export const CAST: Record<CastId, Temper> = {
  pim: {
    name: 'Pim',
    about: 'kind, and shares first',
    share: 0.95,
    idle: 'heart',
    rest: { ...calm, softness: 0.6 },
    speed: 120,
    scale: 1,
    tint: 0xf3b6a8,
    timbre: { wave: 'triangle', attack: 0.005, decay: 0.35 },
    note: 5,
  },
  krit: {
    name: 'Krit',
    about: 'grabby and bold',
    share: 0.1,
    idle: 'crown',
    rest: { ...calm, bristle: 0.25 },
    speed: 150,
    scale: 1,
    tint: 0xf5c66b,
    timbre: { wave: 'square', attack: 0.002, decay: 0.15 },
    note: 3,
  },
  echo: {
    name: 'Echo',
    about: 'a copycat: does what you last did to it',
    share: 1,
    idle: 'question',
    rest: calm,
    speed: 120,
    scale: 0.95,
    tint: 0xa9d3e8,
    timbre: { wave: 'sine', attack: 0.01, decay: 0.5 },
    note: 6,
  },
  moss: {
    name: 'Moss',
    about: 'sleepy, and watches more than it acts',
    share: 0.7,
    idle: 'zzz',
    rest: { ...calm, softness: 0.8 },
    speed: 60,
    scale: 1,
    tint: 0xb9d79e,
    timbre: { wave: 'sine', attack: 0.06, decay: 0.9 },
    note: 0,
  },
  bell: {
    name: 'Bell',
    about: 'vain about its looks',
    share: 0.5,
    idle: 'star',
    rest: calm,
    speed: 110,
    scale: 1,
    tint: 0xe9b8e0,
    timbre: { wave: 'triangle', attack: 0.002, decay: 0.8 },
    note: 7,
  },
  quill: {
    name: 'Quill',
    about: 'thinks too hard and asks questions',
    share: 0.6,
    idle: 'question',
    rest: calm,
    speed: 100,
    scale: 1.05,
    tint: 0xc9c0ef,
    timbre: { wave: 'sine', attack: 0.02, decay: 0.4 },
    note: 4,
  },
  tove: {
    name: 'Tove',
    about: 'nervous, and joins any crowd',
    share: 0.6,
    idle: 'eye',
    rest: { ...calm, tightness: 0.2 },
    speed: 140,
    scale: 0.9,
    tint: 0xf7d9a6,
    timbre: { wave: 'triangle', attack: 0.004, decay: 0.2 },
    note: 8,
  },
  frog: {
    name: 'Gulp',
    about: 'a frog who is always hungry',
    share: 0.2,
    idle: 'berry',
    rest: calm,
    speed: 130,
    scale: 1.05,
    tint: 0x9fd8b6,
    timbre: { wave: 'square', attack: 0.004, decay: 0.25 },
    note: 1,
  },
  snail: {
    name: 'Inch',
    about: 'a slow snail who never forgets a wrong',
    share: 0.9,
    idle: 'zzz',
    rest: calm,
    speed: 45,
    scale: 1,
    tint: 0xe2c9a8,
    timbre: { wave: 'sine', attack: 0.08, decay: 1.1 },
    note: 2,
  },
  toadstool: {
    name: 'Cap',
    about: 'a loud toadstool, friends with everyone',
    share: 0.5,
    idle: 'star',
    rest: { ...calm, softness: 0.5 },
    speed: 80,
    scale: 1.15,
    tint: 0xf2a3a3,
    timbre: { wave: 'sawtooth', attack: 0.01, decay: 0.3 },
    note: 1,
  },
  kite: {
    name: 'Kite',
    about: 'a gossip who passes on every whisper',
    share: 0.5,
    idle: 'bang',
    rest: calm,
    speed: 140,
    scale: 1,
    tint: 0xb3e0dc,
    timbre: { wave: 'triangle', attack: 0.003, decay: 0.25 },
    note: 9,
  },
  glassling: {
    name: 'Glim',
    about: 'honest and a little fragile',
    share: 0.9,
    idle: 'heart',
    rest: { ...calm, tightness: 0.1 },
    speed: 100,
    scale: 0.95,
    tint: 0xdbe6f2,
    timbre: { wave: 'sine', attack: 0.003, decay: 1.4 },
    note: 7,
  },
};
