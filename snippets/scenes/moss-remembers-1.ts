// Moss Remembers, chapter 1, "The Sleeping Suspect", page 1. Six panels and one inset.
// Moss has slept under the same tree for years. Nib is the first to ask why, and opens a case.
// The adult layer: a friend whose habit everyone stopped seeing.
import { arc, bubble, COLOR, easeIn, easeInOut, easeOut, hops, lerp, seg, wobble } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import { mountPage } from '../kit/page.ts';
import {
  bigTree,
  blinkAt,
  breathe,
  cookie,
  ink,
  leaf,
  paint,
  rect,
  shown,
  startle,
  sun,
  toward,
  zzz,
} from '../kit/props.ts';

type Ctx = CanvasRenderingContext2D;
const { moss, nib, krit, kite } = CAST;

// ---- The big tree ----

/** A leaf that falls from (x, y) to the floor once each `period` seconds, rocking side to side. */
function falling(
  ctx: Ctx,
  x: number,
  y: number,
  floor: number,
  t: number,
  period: number,
  color: string,
): void {
  const u = (t % period) / period;
  const fx = x + 14 * Math.sin(u * Math.PI * 4);
  leaf(ctx, fx, lerp(y, floor - 3, u), 11, 0.6 * Math.cos(u * Math.PI * 4), color);
}

/** Moss, asleep, with a slow breath and floating z letters. */
function sleeper(ctx: Ctx, x: number, y: number, size: number, t: number): void {
  moss(ctx, { x, y, size, blink: 1, squash: breathe(t, 2, 0.04) }, t);
  zzz(ctx, x + size * 0.3, y - size * 0.8, t, size / 60);
}

// ---- Panel 1: the same tree, in every season ----

const SEASONS = [
  { sky: '#e9eef4', crown: '#f7c9d4', fall: '#f7c9d4' },
  { sky: '#e4edf0', crown: COLOR.leaf, fall: COLOR.leaf },
  { sky: '#f3e7d7', crown: '#f0b26a', fall: '#e8894a' },
  { sky: '#dfe5ec', crown: '#f4f6f8', fall: '' },
] as const;

function seasons(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 212;
  const q = w / 4;
  SEASONS.forEach((season, i) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * q, 0, q, h);
    ctx.clip();
    ctx.fillStyle = season.sky;
    ctx.fillRect(i * q, 0, q, FY);
    ctx.fillStyle = i === 3 ? '#f7f8fa' : COLOR.floor;
    ctx.fillRect(i * q, FY, q, h - FY);
    const cx = i * q + q / 2;
    if (i === 1) sun(ctx, i * q + 28, 54, 12, t);
    bigTree(ctx, cx + 12, FY, 0.66, season.crown, Math.sin(t * 1.2 + i) * 1.5);
    sleeper(ctx, cx - 24, FY, 40, t);
    if (season.fall) {
      falling(ctx, cx - 20, 90, FY, t, 4, season.fall);
      falling(ctx, cx + 36, 70, FY, t + 2, 4, season.fall);
    } else {
      // Snow.
      ctx.fillStyle = COLOR.paper;
      for (let k = 0; k < 10; k++) {
        const u = (((t / 6 + k / 10) % 1) + 1) % 1;
        const sx = i * q + ((k * 41) % q) + 4 * Math.sin(u * 8 + k);
        ctx.beginPath();
        ctx.arc(sx, u * FY, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ink(ctx, 0.8);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(i * q, 0);
      ctx.lineTo(i * q, h);
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.globalAlpha = 0.4;
      ink(ctx, 1.5);
      ctx.restore();
    }
  });
}

// ---- Panel 2: nobody asked why ----

function passersby(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 196;
  ctx.fillStyle = COLOR.page;
  ctx.fillRect(0, 0, w, FY);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, FY, w, h - FY);
  bigTree(ctx, 200, FY - 6, 0.7, COLOR.leaf);
  sleeper(ctx, 176, FY - 6, 46, t);
  // The meadow walks past, busy with its own day.
  const krW = hops(t, 0.2, 2.6, -40, w + 40, 7);
  krit(ctx, { x: krW.x, y: FY + 22 - krW.lift, size: 46, squash: krW.squash, look: [0.04, 0] }, t);
  cookie(ctx, krW.x, FY + 22 - krW.lift - 54, 8);
  const ki = seg(t, 2.6, 5.4);
  kite(ctx, { x: lerp(w + 30, -30, ki), y: 124 + 10 * Math.sin(ki * 12), size: 40, flip: true }, t);
  bubble(ctx, lerp(w + 30, -30, ki) + 20, 96, 'star', ki > 0 && ki < 1 ? 0.5 : 0, [
    lerp(w + 30, -30, ki) + 8,
    112,
  ]);
  // Nib stops, and stares.
  nib(
    ctx,
    {
      x: 60,
      y: FY + 26,
      size: 50,
      look: toward(60, FY, 176, FY - 30),
      blink: blinkAt(t, 3, 1),
      squash: startle(t, 3.2),
    },
    t,
  );
  bubble(ctx, 76, 136, 'question', shown(t, 3.4, 5.8) * 0.6, [66, 160]);
}

// ---- Panel 3: a case file is opened ----

function caseOpen(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 200;
  ctx.fillStyle = COLOR.page;
  ctx.fillRect(0, 0, w, FY);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, FY, w, h - FY);
  // The trunk, close up, and a poster that Nib pins on it.
  ctx.beginPath();
  ctx.moveTo(150, h + 2);
  ctx.lineTo(160, 0);
  ctx.lineTo(260, 0);
  ctx.lineTo(270, h + 2);
  paint(ctx, COLOR.wood, 2.4);
  const pin = easeOut(seg(t, 1.0, 1.4));
  const py = lerp(150, 78, pin);
  ctx.save();
  ctx.translate(210, py);
  ctx.rotate(0.05 + 0.04 * wobble(t, 1.4, 1));
  ctx.beginPath();
  ctx.rect(-36, -34, 72, 78);
  paint(ctx, COLOR.paper, 2);
  moss(ctx, { x: 0, y: 18, size: 30, blink: 1 }, t);
  ctx.fillStyle = COLOR.ink;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('?', 0, -6);
  ctx.beginPath();
  ctx.arc(0, -30, 3, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.berry;
  ctx.fill();
  ctx.restore();
  // Nib reaches up on tiptoe, pins it, then steps back, very proud.
  const back = easeInOut(seg(t, 2.0, 2.8));
  const reach = arc(seg(t, 0.4, 1.6));
  nib(
    ctx,
    {
      x: lerp(130, 70, back),
      y: FY + 20,
      size: 70,
      squash: -0.18 * reach + wobble(t, 2.8, 0.15),
      lean: 0.15 * reach,
      look: [0.04, -0.03],
      shell: { color: 0.3 + 0.5 * back },
    },
    t,
  );
  bubble(ctx, 104, 86, 'star', shown(t, 3.0, 5.6) * 0.6, [86, 110]);
}

// ---- Panel 4: clue one ----

function clueMoss(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 170;
  ctx.fillStyle = COLOR.page;
  ctx.fillRect(0, 0, w, FY);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, FY, w, h - FY);
  sleeper(ctx, 170, FY, 86, t);
  // Tufts of moss on Moss: one more grows while Nib looks.
  const grow = easeOut(seg(t, 1.0, 2.2));
  for (const [dx, dy, r] of [
    [-26, -62, 11],
    [10, -70, 13],
    [34, -54, 10 * grow],
  ] as const) {
    if (r <= 0) continue;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(170 + dx + (k - 1) * r * 0.8, FY + dy - Math.abs(k - 1) * -r * 0.3, r * 0.6, Math.PI, 0);
      paint(ctx, '#6f9e5b', 1.2);
    }
  }
  nib(ctx, { x: 60, y: FY + 10, size: 58, lean: 0.2, look: [0.045, -0.02], squash: startle(t, 2.3) }, t);
  bubble(ctx, 86, 54, 'bang', shown(t, 2.3, 3.8) * 0.6, [74, 80]);
}

// ---- Panel 5: clue two ----

function clueBed(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 150;
  ctx.fillStyle = COLOR.page;
  ctx.fillRect(0, 0, w, FY);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, FY, w, h - FY);
  // A pile of leaves with a dent in the middle, and a leaf pillow at one end.
  ctx.beginPath();
  ctx.ellipse(160, FY + 18, 90, 22, 0, 0, Math.PI * 2);
  paint(ctx, '#e8b979', 2);
  for (let k = 0; k < 12; k++)
    leaf(ctx, 82 + k * 14, FY + 12 + (k % 3) * 6, 14, k * 0.9, k % 2 ? '#e8894a' : '#f0b26a');
  ctx.beginPath();
  ctx.ellipse(160, FY + 18, 52, 10, 0, 0, Math.PI * 2);
  paint(ctx, '#c9935a', 1.6);
  ctx.beginPath();
  ctx.ellipse(234, FY + 8, 18, 10, -0.2, 0, Math.PI * 2);
  paint(ctx, '#f0b26a', 1.6);
  // Nib tests the bed. Nib is asleep at once, then wakes with a start.
  const lie = easeIn(seg(t, 1.0, 1.4));
  const up = seg(t, 4.2, 4.5);
  const asleep = t > 1.4 && t < 4.2;
  const x = lerp(40, 160, easeInOut(seg(t, 0.2, 1.1)));
  nib(
    ctx,
    {
      x: lerp(x, 40, easeInOut(seg(t, 4.6, 5.6))),
      y: FY + 18 - 30 * arc(seg(t, 4.2, 4.6)),
      size: 58,
      squash: 0.25 * lie * (1 - up) + startle(t, 4.2),
      blink: asleep ? 1 : 0,
      look: [0.03, 0],
    },
    t,
  );
  if (asleep) zzz(ctx, 180, FY - 30, t);
  bubble(ctx, 220, 86, 'bang', shown(t, 4.3, 5.6) * 0.6, [196, 110]);
}

// ---- Panel 6: Nib watched all day ----

function watch(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 152;
  // The day passes once a loop: the sky goes from noon to dusk to night, then back.
  const day = Math.sin((t / 12) * Math.PI);
  ctx.fillStyle = COLOR.page;
  ctx.fillRect(0, 0, w, FY);
  ctx.globalAlpha = 0.85 * day;
  ctx.fillStyle = '#34405a';
  ctx.fillRect(0, 0, w, FY);
  ctx.globalAlpha = 1;
  const sa = (t / 12) * Math.PI;
  ctx.globalAlpha = 1 - day;
  sun(ctx, 300 - Math.cos(sa) * 220, 130 - Math.sin(sa) * 100, 14, t);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, FY, w, h - FY);
  ctx.beginPath();
  ctx.moveTo(0, FY);
  ctx.lineTo(w, FY);
  ink(ctx, 1.5);
  bigTree(ctx, 420, FY, 0.72, COLOR.leaf, Math.sin(t) * 1.5);
  sleeper(ctx, 396, FY, 52, t);
  // Nib, in a bush disguise, watches. Its eyes droop as the day goes on.
  ctx.beginPath();
  ctx.arc(240, FY - 18, 30, Math.PI, 0);
  ctx.lineTo(270, FY);
  ctx.lineTo(210, FY);
  ctx.closePath();
  paint(ctx, COLOR.leaf, 3);
  nib(ctx, { x: 240, y: FY - 20, size: 44, blink: 0.75 * day, look: [0.045, 0], squash: breathe(t, 3) }, t);
  for (const [lx, a] of [
    [222, -0.6],
    [258, 0.6],
  ] as const)
    leaf(ctx, lx, FY - 42, 16, a);
  const notes = Math.floor(seg(t, 0.5, 9) * 4);
  for (let k = 0; k < 4; k++) {
    if (k >= notes) break;
    const bx = 286 + k * 30;
    const by = 40 + (k % 2) * 12;
    bubble(ctx, bx, by, 'question', 0.45, [bx - 8, by + 18]);
  }
}

// ---- Inset: Moss did not move ----

function still(ctx: Ctx, t: number, w: number, h: number): void {
  ctx.fillStyle = COLOR.glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, 84, w, h - 84);
  moss(ctx, { x: 56, y: 96, size: 62, blink: 1, squash: breathe(t, 2, 0.03) }, t);
  // A ladybug walks over Moss and off again.
  const u = seg(t, 0.3, 3.7);
  const bx = lerp(4, 108, u);
  const by = 96 - 46 * Math.sin(Math.PI * u) - 4;
  ctx.beginPath();
  ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
  paint(ctx, COLOR.berry, 1.2);
  ctx.beginPath();
  ctx.moveTo(bx, by - 4.5);
  ctx.lineTo(bx, by + 4.5);
  ink(ctx, 1);
}

mountPage({
  id: 'moss-remembers-1',
  title: 'Moss Remembers',
  folio: 'MOSS REMEMBERS · CHAPTER 1 · PAGE 1',
  label:
    'Page 1 of chapter 1, "The Sleeping Suspect", in six panels and one inset. ' +
    'One wide panel shows the same big tree in spring, summer, autumn, and winter. Moss sleeps at its roots in every season. ' +
    'The meadow walks past: Krit with a cookie, Kite with news. Nobody asks why Moss is always there. Nib stops and stares. ' +
    'Nib pins a poster of Moss with a question mark on the trunk, and opens a case on the sleeping suspect. ' +
    'Clue one: moss grows on Moss, and one more tuft grows while Nib watches. ' +
    'Clue two: a leaf pile shaped like a bed. Nib lies down to test it, falls asleep at once, and wakes with a start. ' +
    'Nib hides in a bush and watches Moss all day, from noon to night, with more and more questions. In the inset, a ladybug walks over Moss, and Moss does not move.',
  width: 640,
  height: 1000,
  seconds: 12,
  still: 4.4,
  gifFps: 12.5,
  panels: [
    {
      shape: rect(20, 72, 600, 250),
      seconds: 12,
      caption: { text: 'Chapter 1. The Sleeping Suspect', x: 20, y: 72, width: 250 },
      draw: seasons,
    },
    {
      shape: rect(20, 334, 300, 236),
      seconds: 6,
      caption: {
        text: 'Moss has slept under the same tree for years. Nobody asked why.',
        x: 20,
        y: 334,
        width: 230,
      },
      draw: passersby,
    },
    {
      shape: [
        [332, 334],
        [620, 334],
        [620, 570],
        [312, 570],
      ],
      seconds: 6,
      caption: { text: 'Then Nib opened a case.', x: 440, y: 334, width: 180 },
      draw: caseOpen,
    },
    {
      shape: rect(20, 582, 290, 196),
      seconds: 4,
      caption: { text: 'Clue one: moss grows on Moss.', x: 20, y: 582, width: 150 },
      draw: clueMoss,
    },
    {
      shape: rect(322, 582, 298, 196),
      seconds: 6,
      caption: { text: 'Clue two: a leaf pile shaped like a bed.', x: 322, y: 582, width: 170 },
      draw: clueBed,
    },
    {
      shape: rect(20, 790, 600, 190),
      seconds: 12,
      caption: { text: 'Nib watched all day.', x: 20, y: 790, width: 170 },
      draw: watch,
    },
    {
      shape: { circle: [80, 874, 50] },
      seconds: 4,
      caption: { text: 'Moss did not move. Not once.', x: 30, y: 930, width: 150 },
      draw: still,
    },
  ],
});
