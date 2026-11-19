// The whole cast by name: the twelve toybox creatures and the six new friends.
// Comic scenes import their creatures from here, so each scene stays short.
import bellRig from '../../content/rigs/bell.rig.json';
import echoRig from '../../content/rigs/echo.rig.json';
import frogRig from '../../content/rigs/frog.rig.json';
import glassRig from '../../content/rigs/glassling.rig.json';
import kiteRig from '../../content/rigs/kite.rig.json';
import kritRig from '../../content/rigs/krit.rig.json';
import mossRig from '../../content/rigs/moss.rig.json';
import pimRig from '../../content/rigs/pim.rig.json';
import quillRig from '../../content/rigs/quill.rig.json';
import snailRig from '../../content/rigs/snail.rig.json';
import toadstoolRig from '../../content/rigs/toadstool.rig.json';
import toveRig from '../../content/rigs/tove.rig.json';
import type { Timbre } from '../../src/audio/voices.ts';
import { CAST as TOYBOX } from '../../src/toy/cast.ts';
import { creature, type Pose } from './draw.ts';
import { drawDollop, drawDrift, drawHush, drawNib, drawSprig, drawTuck } from './friends.ts';

type Draw = (ctx: CanvasRenderingContext2D, pose: Pose, t: number) => void;

export const CAST = {
  pim: creature(pimRig),
  krit: creature(kritRig),
  echo: creature(echoRig),
  moss: creature(mossRig),
  bell: creature(bellRig),
  quill: creature(quillRig),
  tove: creature(toveRig),
  gulp: creature(frogRig),
  inch: creature(snailRig),
  cap: creature(toadstoolRig),
  kite: creature(kiteRig),
  glim: creature(glassRig),
  drift: drawDrift,
  dollop: drawDollop,
  nib: drawNib,
  hush: drawHush,
  sprig: drawSprig,
  tuck: drawTuck,
} satisfies Record<string, Draw>;

export type Who = keyof typeof CAST;

/** Each creature's voice: a timbre and its own note. The new friends borrow a toybox voice. */
export const VOICE: Record<Who, { timbre: Timbre; note: number }> = {
  pim: TOYBOX.pim,
  krit: TOYBOX.krit,
  echo: TOYBOX.echo,
  moss: TOYBOX.moss,
  bell: TOYBOX.bell,
  quill: TOYBOX.quill,
  tove: TOYBOX.tove,
  gulp: TOYBOX.frog,
  inch: TOYBOX.snail,
  cap: TOYBOX.toadstool,
  kite: TOYBOX.kite,
  glim: TOYBOX.glassling,
  drift: { timbre: { wave: 'sine', attack: 0.08, decay: 1 }, note: 6 },
  dollop: { timbre: { wave: 'triangle', attack: 0.004, decay: 0.3 }, note: 7 },
  nib: { timbre: { wave: 'square', attack: 0.002, decay: 0.12 }, note: 8 },
  hush: { timbre: { wave: 'sine', attack: 0.05, decay: 0.7 }, note: 5 },
  sprig: { timbre: { wave: 'triangle', attack: 0.003, decay: 0.2 }, note: 9 },
  tuck: { timbre: { wave: 'sawtooth', attack: 0.005, decay: 0.18 }, note: 0 },
};
