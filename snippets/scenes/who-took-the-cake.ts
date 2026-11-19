// A comic page: Pim's cake goes missing, and the whole meadow looks for it.
// Seven panels and one inset, each with its own short loop.
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
import toveRig from '../../content/rigs/tove.rig.json';
import {
  arc,
  bubble,
  COLOR,
  creature,
  easeBack,
  easeIn,
  easeInOut,
  easeOut,
  hops,
  icon,
  lerp,
  seg,
  wobble,
  type Icon,
  type Pose,
} from '../kit/draw.ts';
import { drawDollop, drawDrift, drawHush, drawNib, drawSprig, drawTuck } from '../kit/friends.ts';
import { mountPage, type Point } from '../kit/page.ts';

type Ctx = CanvasRenderingContext2D;
type Draw = (ctx: Ctx, pose: Pose, t: number) => void;

const pim = creature(pimRig);
const krit = creature(kritRig);
const echo = creature(echoRig);
const moss = creature(mossRig);
const bell = creature(bellRig);
const quill = creature(quillRig);
const tove = creature(toveRig);
const gulp = creature(frogRig);
const inch = creature(snailRig);
const kite = creature(kiteRig);
const glim = creature(glassRig);

const rect = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

// ---- Props ----

/** Sky over floor, with the floor line at `horizon`. */
function ground(ctx: Ctx, w: number, h: number, horizon: number): void {
  ctx.fillStyle = COLOR.page;
  ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.strokeStyle = COLOR.ink;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

const ink = (ctx: Ctx, width = 2): void => {
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
};

/** A checked picnic blanket. */
function blanket(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLOR.berry;
  ctx.globalAlpha = 0.45;
  const cell = 10;
  for (let i = 0; i * cell < w; i++)
    for (let j = 0; j * cell < h; j++)
      if ((i + j) % 2 === 0)
        ctx.fillRect(x + i * cell, y + j * cell, Math.min(cell, w - i * cell), Math.min(cell, h - j * cell));
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ink(ctx);
}

/** A round cake with pink icing and a berry on top. (x, y) is the middle of its base. */
function cake(ctx: Ctx, x: number, y: number, s: number): void {
  const [rx, ry, tall] = [30 * s, 8 * s, 26 * s];
  ctx.beginPath();
  ctx.moveTo(x + rx, y - tall);
  ctx.lineTo(x + rx, y);
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(x - rx, y - tall);
  ctx.closePath();
  ctx.fillStyle = COLOR.cookie;
  ctx.fill();
  ink(ctx);
  // The icing: the top, and drips down the front.
  ctx.beginPath();
  ctx.ellipse(x, y - tall, rx, ry, 0, 0, Math.PI * 2);
  for (const [dx, len] of [
    [-0.7, 0.35],
    [-0.25, 0.55],
    [0.2, 0.3],
    [0.62, 0.5],
  ] as const) {
    const px = x + dx * rx;
    const top = y - tall + ry * Math.sqrt(1 - dx * dx);
    ctx.moveTo(px - 4 * s, top - 1);
    ctx.lineTo(px - 4 * s, top + len * tall * 0.5);
    ctx.arc(px, top + len * tall * 0.5, 4 * s, Math.PI, 0, true);
    ctx.lineTo(px + 4 * s, top - 1);
  }
  ctx.fillStyle = '#f9c9d6';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y - tall, rx, ry, 0, 0, Math.PI * 2);
  ink(ctx);
  ctx.beginPath();
  ctx.arc(x, y - tall - 4 * s, 5 * s, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.berry;
  ctx.fill();
  ink(ctx);
}

/** One slice of the cake, pointing left. (x, y) is the middle of its base. */
function slice(ctx: Ctx, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 20, y);
  ctx.lineTo(x + 18, y - 6);
  ctx.lineTo(x + 18, y - 26);
  ctx.lineTo(x - 20, y - 20);
  ctx.closePath();
  ctx.fillStyle = COLOR.cookie;
  ctx.fill();
  ink(ctx);
  ctx.beginPath();
  ctx.moveTo(x - 20, y - 20);
  ctx.lineTo(x + 18, y - 26);
  ctx.lineTo(x + 26, y - 30);
  ctx.lineTo(x - 14, y - 24);
  ctx.closePath();
  ctx.fillStyle = '#f9c9d6';
  ctx.fill();
  ink(ctx);
}

function crumb(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.cookie;
  ctx.fill();
  ink(ctx, 1.2);
}

/** A fork at (x, y), turned by `a` radians; the tines point up when a is 0. */
function fork(ctx: Ctx, x: number, y: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.scale(1.4, 1.4);
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, -4);
  ctx.moveTo(-4, -4);
  ctx.lineTo(4, -4);
  for (const tx of [-4, 0, 4]) {
    ctx.moveTo(tx, -4);
    ctx.lineTo(tx, -12);
  }
  ink(ctx, 2);
  ctx.restore();
}

function fly(ctx: Ctx, x: number, y: number, t: number): void {
  const flap = Math.sin(t * 60) * 0.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 4, y - 5, 5, 3, side * (0.8 + flap), 0, Math.PI * 2);
    ctx.fillStyle = COLOR.glass;
    ctx.fill();
    ink(ctx, 1.2);
  }
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.ink;
  ctx.fill();
}

/** A drop of sweat that slides down from (x, y) once each `period` seconds. */
function sweat(ctx: Ctx, x: number, y: number, t: number, period: number): void {
  const u = (t % period) / period;
  if (u > 0.5) return;
  const v = u * 2;
  ctx.beginPath();
  const dy = y + v * 14;
  ctx.moveTo(x, dy - 6);
  ctx.quadraticCurveTo(x + 4, dy, x, dy + 2);
  ctx.quadraticCurveTo(x - 4, dy, x, dy - 6);
  ctx.globalAlpha = 1 - v * 0.6;
  ctx.fillStyle = COLOR.water;
  ctx.fill();
  ink(ctx, 1.2);
  ctx.globalAlpha = 1;
}

/** Little z letters float up from (x, y) while someone sleeps. */
function zzz(ctx: Ctx, x: number, y: number, t: number, big = 1): void {
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let k = 0; k < 3; k++) {
    const u = (t / 3 + k / 3) % 1;
    ctx.globalAlpha = Math.sin(Math.PI * u) * 0.7;
    ctx.font = `bold ${String((9 + 9 * u) * big)}px system-ui, sans-serif`;
    ctx.fillText('z', x + 26 * u * big, y - 40 * u * big);
  }
  ctx.globalAlpha = 1;
}

/** The pose for a quick look of surprise that starts at `t0`: a stretch, then a wobble. */
const startle = (t: number, t0: number): number =>
  -0.18 * arc(seg(t, t0, t0 + 0.25)) + wobble(t, t0 + 0.25, 0.14);

/** A look in rig units from an eye at (x, y) toward (tx, ty), in pixels. */
function toward(x: number, y: number, tx: number, ty: number, amount = 0.045): [number, number] {
  const d = Math.hypot(tx - x, ty - y) || 1;
  return [((tx - x) / d) * amount, (-(ty - y) / d) * amount];
}

/** A small creature drawn inside a bubble. */
const mini =
  (draw: Draw, t: number, flip = false) =>
  (ctx: Ctx): void => {
    draw(ctx, { x: 0, y: 12, size: 24, flip }, t);
  };

/** Bubble scale for a bubble that shows over [a, b]: a pop in, and a quick shrink out. */
const shown = (t: number, a: number, b: number): number =>
  easeBack(seg(t, a, a + 0.25)) * (1 - seg(t, b, b + 0.15));

// ---- Panel 1: the cake, and Gulp's tongue ----

function picnic(ctx: Ctx, t: number, w: number, h: number): void {
  ground(ctx, w, h, 150);
  blanket(ctx, 170, 158, 260, 28);
  const FEET = 176;

  drawDrift(ctx, { x: 545, y: 66 + 4 * Math.sin((t / 3) * Math.PI * 2), size: 44, look: [-0.03, -0.02] }, t);

  // Krit leans in with its cookie tower; the tower sways.
  krit(ctx, { x: 110, y: FEET, size: 58, lean: 0.08, look: [0.045, -0.01], shell: { bristle: 0.4 } }, t);
  for (let k = 0; k < 2; k++)
    icon(ctx, 'cookie', 112 + Math.sin(t * Math.PI) * 2 * (k + 1), 116 - k * 12, 0.5);

  // Gulp's tongue sneaks to the cake, slowly, and snaps back when Pim looks.
  const mouth: Point = [210, FEET - 56 * 1.05 * 0.62];
  const top: Point = [292, 134];
  const reach = easeInOut(seg(t, 1.9, 2.8)) * (1 - easeIn(seg(t, 3.05, 3.2)));
  if (reach > 0) {
    ctx.beginPath();
    ctx.moveTo(...mouth);
    ctx.lineTo(lerp(mouth[0], top[0], reach), lerp(mouth[1], top[1], reach));
    ctx.strokeStyle = COLOR.berry;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  const caught = seg(t, 3.15, 3.25) * (1 - seg(t, 4.8, 5.2));
  gulp(
    ctx,
    {
      x: 210,
      y: FEET,
      size: 56,
      squash: wobble(t, 3.2, 0.2),
      look: caught > 0 ? [0.01, 0.05] : [0.045, 0],
      blink: 0.5 * caught,
    },
    t,
  );

  cake(ctx, 300, 172, 1.05);

  // Pim watches the cake, then catches Gulp, then remembers the forks.
  const glare = seg(t, 2.85, 2.95) * (1 - seg(t, 3.9, 4.0));
  pim(
    ctx,
    {
      x: 385,
      y: FEET,
      size: 64,
      squash: wobble(t, 2.9, 0.2) + wobble(t, 4.3, 0.12),
      look: glare > 0 ? [-0.05, -0.01] : [-0.03, -0.015],
      shell: { tightness: 0.4 * glare },
    },
    t,
  );
  const tail: Point = [395, 110];
  bubble(ctx, 425, 72, 'heart', shown(t, 0.3, 1.8), tail);
  bubble(ctx, 425, 72, 'bang', shown(t, 2.95, 3.9), tail);
  bubble(
    ctx,
    425,
    72,
    (c) => {
      fork(c, -5, 0, -0.25);
      fork(c, 5, 0, 0.25);
    },
    shown(t, 4.3, 5.6),
    tail,
  );

  // Sprig stands on tiptoe to see; Dollop giggles at Gulp.
  sprigTiptoe(ctx, 468, FEET, t);
  const giggle = seg(t, 3.2, 3.4) * (1 - seg(t, 4.6, 5.0));
  drawDollop(
    ctx,
    {
      x: 538,
      y: FEET,
      size: 54,
      squash: 0.05 * Math.sin(t * 34) * giggle,
      blink: 0.8 * giggle,
      look: [-0.04, 0],
      shell: { color: 0.2 + 0.5 * giggle },
    },
    t,
  );
}

function sprigTiptoe(ctx: Ctx, x: number, y: number, t: number): void {
  const up = 0.5 + 0.5 * Math.sin((t / 1.5) * Math.PI * 2);
  drawSprig(ctx, { x, y: y - 4 * up, size: 50, squash: -0.1 * up, look: [-0.045, 0.01] }, t);
}

// ---- Panel 2: one minute later, something peeks out from behind the cake ----

function minute(ctx: Ctx, t: number, w: number, h: number): void {
  ground(ctx, w, h, 120);
  blanket(ctx, 22, 128, 175, 32);
  moss(ctx, { x: 38, y: 126, size: 40, blink: 1, squash: 0.03 * Math.sin((t / 2) * Math.PI * 2) }, t);
  zzz(ctx, 52, 96, t, 0.8);
  // Only the shell and the eye stalks show over the cake, and only for a moment.
  const peek = easeOut(seg(t, 1.0, 1.3)) * (1 - easeIn(seg(t, 2.7, 3.0)));
  const side = Math.sin(Math.PI * 2 * seg(t, 1.4, 2.6)) * 6;
  inch(ctx, { x: 118 + side, y: lerp(150, 122, peek), size: 52 }, t);
  cake(ctx, 112, 150, 1.7);
}

// ---- Panel 3: Pim comes back, and the cake is gone ----

const SHOCK = 1.45;

function gone(ctx: Ctx, t: number, w: number, h: number): void {
  ground(ctx, w, h, 120);
  blanket(ctx, 150, 128, 180, 32);
  for (const [cx, cy] of [
    [225, 140],
    [236, 146],
    [248, 138],
    [262, 150],
    [270, 143],
  ] as const)
    crumb(ctx, cx, cy, 2);

  // Tove shakes; Echo copies Pim's shock, a beat late.
  const fear = seg(t, SHOCK + 0.2, SHOCK + 0.4) * (1 - seg(t, 5.0, 5.6));
  tove(ctx, { x: 58, y: 150, size: 50, lean: 0.04 * Math.sin(t * 45) * fear, look: [0.04, -0.02] }, t);
  if (fear > 0) sweat(ctx, 76, 104, t, 1.2);
  echo(ctx, { x: 112, y: 150, size: 46, squash: startle(t, SHOCK + 0.5), look: [0.04, 0] }, t);
  bubble(ctx, 132, 66, 'bang', shown(t, SHOCK + 0.6, 3.2) * 0.7, [118, 96]);

  // Pim hops in with the forks, sees, and drops them; later it hops off to look.
  const enter = hops(t, 0.1, 1.1, 450, 290, 3);
  const leave = hops(t, 4.4, 5.4, 290, 470, 3);
  const p = t < 4.4 ? enter : leave;
  const tight = seg(t, SHOCK, SHOCK + 0.1) * (1 - seg(t, 4.0, 4.4));
  pim(
    ctx,
    {
      x: p.x,
      y: 150 - p.lift,
      size: 60,
      squash: p.squash + startle(t, SHOCK),
      flip: t > 4.4,
      look: t > 3.2 && t < 4.4 ? [0.03, 0.02] : [-0.04, -0.02],
      shell: { tightness: 0.7 * tight },
    },
    t,
  );
  bubble(ctx, 320, 52, 'question', shown(t, 3.2, 4.4), [300, 90]);

  // The forks fall, bounce, and lie still.
  const fall = seg(t, SHOCK, SHOCK + 0.35);
  const fade = 1 - seg(t, 5.2, 5.8);
  ctx.globalAlpha = fade;
  for (const [k, dx] of [
    [0, -28],
    [1, -18],
  ] as const) {
    const held = t < SHOCK;
    const x = held ? p.x + dx : 290 + dx - k * 16;
    const y = held
      ? 150 - p.lift - 26
      : lerp(124, 154, easeIn(fall)) - arc(seg(t, SHOCK + 0.35, SHOCK + 0.6)) * 8;
    const a = held ? 0 : lerp(0, k ? 1.6 : -1.5, easeOut(fall));
    fork(ctx, x, y, a);
  }
  ctx.globalAlpha = 1;
}

/** Pim's shout breaks out over the top of panel 3. */
function goneShout(ctx: Ctx, t: number): void {
  bubble(ctx, 586, 290, 'bang', shown(t, SHOCK + 0.1, 3.0) * 1.25, [532, 330]);
}

// ---- Panel 4: Detective Nib follows the crumbs, and eats the best one ----

const CHOMP = 4.0;

function detective(ctx: Ctx, t: number, w: number, h: number): void {
  ground(ctx, w, h, 160);
  for (let k = 0; k < 8; k++) crumb(ctx, 22 + k * 20, 206 + (k % 2) * 3, 1.8);
  // The best crumb: Nib eats it, and a new one drops in before the loop starts again.
  const drop = seg(t, 5.2, 5.7);
  if (t < CHOMP || drop > 0) crumb(ctx, 214, t < CHOMP ? 204 : lerp(-10, 204, easeIn(drop)), 4.5);

  // Quill thinks harder and harder. When Nib eats the clue, each thought turns to alarm.
  quill(ctx, { x: 46, y: 200, size: 58, look: [0.045, -0.02], squash: startle(t, CHOMP + 0.05) }, t);
  const ideas: readonly [number, number, number][] = [
    [26, 110, 0.8],
    [64, 92, 1.8],
    [100, 112, 2.8],
  ];
  for (const [bx, by, at] of ideas) {
    const name: Icon = t < CHOMP + 0.05 ? 'question' : 'bang';
    bubble(ctx, bx, by, name, shown(t, at, 5.0) * 0.7, [46, 150]);
  }

  // Nib creeps along the trail, nose down behind the lens.
  const walk = t < 4.9 ? hops(t, 0.3, 3.6, 100, 180, 5) : hops(t, 4.9, 5.9, 180, 100, 3);
  const sniff = arc(seg(t, 3.7, CHOMP + 0.1));
  const x = walk.x;
  const y = 204 - walk.lift * 0.4;
  drawNib(
    ctx,
    {
      x,
      y,
      size: 50,
      squash: walk.squash + 0.12 * sniff + wobble(t, CHOMP, 0.2),
      lean: 0.12 + 0.12 * sniff,
      flip: t > 4.9,
      look: t > 4.9 ? [0.03, 0] : [0.035, -0.04],
      blink: t > CHOMP && t < CHOMP + 0.6 ? 1 : 0,
    },
    t,
  );
  if (t < CHOMP - 0.2 || t > 4.9) {
    const lx = x + (t > 4.9 ? -30 : 30);
    ctx.beginPath();
    ctx.moveTo(lx - (t > 4.9 ? -7 : 7), y - 18);
    ctx.lineTo(lx - (t > 4.9 ? -16 : 16), y - 6);
    ink(ctx, 3);
    ctx.beginPath();
    ctx.arc(lx, y - 26, 10, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.glass;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
    ink(ctx, 2.5);
  }
  bubble(ctx, 206, 144, 'heart', shown(t, CHOMP + 0.15, 4.9) * 0.8, [190, 176]);
}

// ---- Panel 5: the suspects ----

const FLY_OUT = 1.6;
const FLY_BACK = 3.0;

function lineup(ctx: Ctx, t: number, w: number, h: number): void {
  ground(ctx, w, h, 96);
  // Height lines on the wall, as in a police lineup.
  ctx.globalAlpha = 0.18;
  for (let y = 22; y < 96; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ink(ctx, 1.5);
  }
  ctx.globalAlpha = 1;

  // Tuck bristles at the very idea.
  const huff = arc(seg(t, 1.2, 3.4));
  drawTuck(ctx, { x: 52, y: 96, size: 46, look: [-0.04, 0], shell: { bristle: 0.2 + 0.8 * huff } }, t);

  // Krit has crumbs. But they are cookie crumbs.
  krit(ctx, { x: 128, y: 96, size: 46, look: [0, 0.03] }, t);
  for (let k = 0; k < 3; k++)
    icon(ctx, 'cookie', 129 + Math.sin(t * Math.PI) * 1.5 * (k + 1), 47 - k * 11, 0.46);
  for (let k = 0; k < 3; k++) {
    const u = (t / 2 + k / 3) % 1;
    crumb(ctx, 140 + k * 3, lerp(52, 96, easeIn(u)), 1.3);
  }

  // Gulp's full cheeks: only a fly, and it gets away. Then it comes back.
  const out = seg(t, FLY_OUT, FLY_OUT + 0.9);
  const back = seg(t, FLY_BACK, FLY_BACK + 0.5);
  const full = t < FLY_OUT || t > FLY_BACK + 0.5;
  const mouth: Point = [205, 96 - 46 * 1.05 * 0.62];
  gulp(
    ctx,
    {
      x: 205,
      y: 96,
      size: 46 * (full ? 1.06 : 1),
      squash: (full ? 0.06 : 0) + wobble(t, FLY_OUT, 0.2) + wobble(t, FLY_BACK + 0.5, 0.2),
      look: full ? [0, 0.02] : [0.04, 0.03],
      blink: full ? 0.6 : 0,
    },
    t,
  );
  if (out > 0 && out < 1)
    fly(ctx, lerp(mouth[0], 330, out), lerp(mouth[1], 10, out) + Math.sin(out * 12) * 6, t);
  if (back > 0 && back < 1) fly(ctx, lerp(330, mouth[0], back), lerp(20, mouth[1], back), t);

  // Hush ducks out of sight, then peeks back.
  const duck = easeIn(seg(t, 0.6, 0.8)) * (1 - easeInOut(seg(t, 2.4, 3.4)));
  drawHush(ctx, { x: 288, y: 96 + 44 * duck, size: 46, look: [-0.03, 0] }, t);
}

// ---- Panel 6: everyone has a theory ----

function theories(ctx: Ctx, t: number, w: number, h: number): void {
  ground(ctx, w, h, 96);
  kite(ctx, { x: 40, y: 96, size: 50, flip: true, squash: wobble(t, 0.3, 0.15) + wobble(t, 3.0, 0.15) }, t);
  bubble(ctx, 70, 30, mini(krit, t), shown(t, 0.3, 2.6), [52, 56]);
  bubble(ctx, 70, 30, mini(gulp, t), shown(t, 3.0, 5.4), [52, 56]);

  // Echo says it too, a beat late.
  echo(
    ctx,
    { x: 110, y: 96, size: 46, look: [-0.03, 0], squash: wobble(t, 0.8, 0.15) + wobble(t, 3.5, 0.15) },
    t,
  );
  bubble(ctx, 136, 30, mini(krit, t), shown(t, 0.8, 3.0) * 0.85, [118, 58]);
  bubble(ctx, 136, 30, mini(gulp, t), shown(t, 3.5, 5.6) * 0.85, [118, 58]);

  // Bell has its own theory: Bell looks great today.
  bell(ctx, { x: 176, y: 96, size: 48, look: [0.045, 0], blink: arc(seg(t, 2.4, 2.6)) }, t);
  ctx.beginPath();
  ctx.moveTo(206, 92);
  ctx.lineTo(206, 76);
  ink(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(206, 64, 8, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.glass;
  ctx.fill();
  ink(ctx, 2.5);

  // Glim saw it all, and hops to be heard. Its bubble is very small.
  const hop = arc(seg(t, 1.8, 2.15)) + arc(seg(t, 3.8, 4.15));
  glim(ctx, { x: 292, y: 96 - 12 * hop, size: 46, look: [-0.045, 0.02], squash: -0.08 * hop }, t);
  bubble(ctx, 258, 46, mini(inch, t), shown(t, 1.0, 5.6) * 0.62, [278, 62]);
}

// ---- Panel 7: the cake never left ----

const SPOT = 3.0;
/** The cake rides on Inch's shell. */
const INCH: Point = [300, 262];

interface Watcher {
  draw: Draw;
  x: number;
  y: number;
  size: number;
  /** Seconds after the spot that this one turns to look. */
  late?: number;
}

const BACK: readonly Watcher[] = [
  { draw: bell, x: 120, y: 206, size: 44 },
  { draw: kite, x: 152, y: 206, size: 44 },
  { draw: quill, x: 186, y: 206, size: 42 },
  { draw: echo, x: 222, y: 206, size: 42, late: 0.6 },
  { draw: drawTuck, x: 258, y: 206, size: 40 },
  { draw: drawDollop, x: 298, y: 206, size: 44 },
  { draw: tove, x: 336, y: 206, size: 42 },
  { draw: glim, x: 404, y: 206, size: 42 },
  { draw: drawSprig, x: 438, y: 206, size: 42 },
];
const FRONT: readonly Watcher[] = [
  { draw: krit, x: 134, y: 252, size: 54 },
  { draw: pim, x: 190, y: 252, size: 56 },
  { draw: gulp, x: 386, y: 252, size: 52 },
  { draw: drawNib, x: 438, y: 252, size: 48 },
];

function reveal(ctx: Ctx, t: number, w: number, h: number): void {
  ground(ctx, w, h, 196);

  // The shady tree, where Moss sleeps. That is where Inch is going.
  ctx.beginPath();
  ctx.ellipse(70, 252, 70, 11, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.ink;
  ctx.globalAlpha = 0.12;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLOR.wood;
  ctx.fillRect(26, 120, 16, 132);
  ctx.beginPath();
  ctx.rect(26, 120, 16, 132);
  ink(ctx);
  for (const pass of ['stroke', 'fill'] as const) {
    for (const [cx, cy, r] of [
      [10, 108, 34],
      [52, 92, 40],
      [92, 112, 30],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (pass === 'stroke') ink(ctx, 4.4);
      else {
        ctx.fillStyle = COLOR.leaf;
        ctx.fill();
      }
    }
  }
  moss(ctx, { x: 64, y: 252, size: 50, blink: 1, squash: 0.03 * Math.sin((t / 2) * Math.PI * 2) }, t);
  zzz(ctx, 84, 214, t);

  // Each one looks around, then sees the cake with a start, and stares. Echo is late, as always.
  const cakeAt: Point = [INCH[0] + 20, 190];
  const watch = (c: Watcher, i: number): void => {
    const at = SPOT + 0.25 + (c.late ?? i * 0.04);
    const stare = seg(t, at, at + 0.15) * (1 - seg(t, 10.6, 11.6));
    const around: [number, number] = [0.035 * Math.sin((t / 6) * Math.PI * 2 + i * 1.7), 0.01];
    const eye = toward(c.x, c.y - c.size * 0.5, ...cakeAt);
    const tuck = c.draw === drawTuck;
    const hush = c.draw === drawHush;
    c.draw(
      ctx,
      {
        x: c.x,
        y: c.y + (hush ? 30 * stare : 0),
        size: c.size,
        squash: startle(t, at),
        look: [lerp(around[0], eye[0], stare), lerp(around[1], eye[1], stare)],
        shell: tuck ? { bristle: 0.15 + 0.8 * stare * (1 - seg(t, 6.5, 7.5)) } : {},
      },
      t,
    );
  };
  BACK.forEach(watch);
  drawDrift(ctx, { x: 410, y: 92 + 4 * Math.sin((t / 4) * Math.PI * 2), size: 46, look: [-0.04, -0.03] }, t);
  // Hush, who hides at the start, then comes back up.
  watch({ draw: drawHush, x: 370, y: 206, size: 42 }, 9);
  FRONT.forEach((c, i) => {
    watch(c, i + 10);
  });

  // Gulp tries one quick lick.
  const lick = arc(seg(t, 7.0, 7.4));
  if (lick > 0) {
    const mouth: Point = [386, 252 - 52 * 1.05 * 0.62];
    ctx.beginPath();
    ctx.moveTo(...mouth);
    ctx.lineTo(lerp(mouth[0], cakeAt[0] + 18, lick), lerp(mouth[1], cakeAt[1] - 6, lick));
    ctx.strokeStyle = COLOR.berry;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Inch heaves, very slowly, and the cake rocks on its shell. Crumbs mark the long road behind.
  for (let k = 0; k < 6; k++) crumb(ctx, 362 + k * 16, 258 + (k % 2) * 4, 1.8);
  const heave = Math.sin((t / 2) * Math.PI * 2);
  inch(
    ctx,
    { x: INCH[0], y: INCH[1], size: 66, lean: -0.05 * heave, squash: -0.04 * heave, look: [-0.04, 0] },
    t,
  );
  cake(ctx, INCH[0] + 20 - 2 * heave, INCH[1] - 58 + 1.5 * heave, 0.9);
  sweat(ctx, INCH[0] - 30, INCH[1] - 52, t, 4);

  bubble(ctx, 412, 150, 'bang', shown(t, SPOT - 0.6, SPOT + 0.4) * 0.6, [406, 172]);
  bubble(ctx, 216, 160, 'heart', shown(t, 5.0, 9.0) * 0.8, [198, 194]);
  bubble(ctx, 140, 128, mini(inch, t), shown(t, 6.0, 10.0) * 0.8, [150, 166]);
}

// ---- Inset: Inch gets the first slice ----

function firstSlice(ctx: Ctx, t: number, w: number, h: number): void {
  ctx.fillStyle = COLOR.glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, 88, w, h - 88);
  slice(ctx, 34, 104);
  // Gulp's tongue comes in from the edge, one more time, and leaves when Inch looks.
  const reach = easeInOut(seg(t, 2.6, 3.4)) * (1 - easeIn(seg(t, 3.75, 3.9)));
  if (reach > 0) {
    ctx.beginPath();
    ctx.moveTo(w + 4, 66);
    ctx.lineTo(lerp(w + 4, 54, reach), lerp(66, 80, reach));
    ctx.strokeStyle = COLOR.berry;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  const turn = seg(t, 3.55, 3.7) * (1 - seg(t, 4.8, 5.1));
  inch(
    ctx,
    {
      x: 84,
      y: 112,
      size: 72,
      look: [lerp(-0.04, 0.05, turn), 0],
      squash: wobble(t, 3.6, 0.12),
      shell: { color: 0.6, softness: 0.8 },
    },
    t,
  );
  bubble(ctx, 64, 32, 'heart', shown(t, 0.6, 2.4) * 0.7, [58, 56]);
}

mountPage({
  id: 'who-took-the-cake',
  title: 'Who Took the Cake?',
  label:
    'A comic page in seven panels and one inset. Pim bakes a cake for the whole meadow and goes to get forks, after it catches Gulp trying to lick it. ' +
    'While Pim is away, a shell peeks out from behind the cake. When Pim comes back, the cake is gone. ' +
    'Detective Nib follows the trail of crumbs, and eats the best clue. ' +
    'The suspects line up: Tuck, Krit with a tower of cookies, Gulp with full cheeks, and Hush, who hides. ' +
    'Kite blames Krit, then Gulp, and Echo says it too, a beat late. Little Glim knows the truth, but its bubble is too small. ' +
    'Then everyone sees it: the cake never left. Inch carries it on its shell, very slowly, to the shade where Moss sleeps. ' +
    'In the inset, Inch gets the first slice, and Gulp tries one more lick.',
  width: 640,
  height: 1000,
  seconds: 12,
  still: 3.6,
  gifFps: 12.5,
  panels: [
    {
      shape: rect(20, 72, 600, 196),
      seconds: 6,
      caption: { text: 'Pim baked a cake for the whole meadow.', x: 20, y: 72, width: 270 },
      draw: picnic,
    },
    {
      shape: [
        [20, 280],
        [232, 280],
        [212, 460],
        [20, 460],
      ],
      seconds: 4,
      caption: { text: 'Pim went to get forks. It took one minute.', x: 20, y: 280, width: 150 },
      draw: minute,
    },
    {
      shape: [
        [244, 280],
        [620, 280],
        [620, 460],
        [224, 460],
      ],
      seconds: 6,
      caption: { text: 'Then the cake was gone.', x: 252, y: 280, width: 172 },
      draw: gone,
      over: goneShout,
    },
    {
      shape: rect(20, 472, 242, 226),
      seconds: 6,
      caption: { text: 'Detective Nib took the case.', x: 20, y: 472, width: 150 },
      draw: detective,
    },
    {
      shape: rect(274, 472, 346, 107),
      seconds: 4,
      caption: { text: 'The suspects:', x: 274, y: 472, width: 108 },
      draw: lineup,
    },
    {
      shape: rect(274, 591, 346, 107),
      seconds: 6,
      caption: { text: 'Everyone had a theory.', x: 450, y: 591, width: 170 },
      draw: theories,
    },
    {
      shape: rect(20, 710, 600, 270),
      seconds: 12,
      caption: { text: 'The cake never left. Inch was taking it to the shade.', x: 20, y: 710, width: 280 },
      draw: reveal,
    },
    {
      shape: { circle: [548, 908, 62] },
      seconds: 6,
      caption: { text: 'Inch got the first slice.', x: 492, y: 814, width: 120 },
      draw: firstSlice,
    },
  ],
});
