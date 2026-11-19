// Moss Remembers, chapter 1, "The Sleeping Suspect", page 2. Seven panels and one inset.
// Kite spreads three wrong theories, Nib interviews the tree, and the page ends on a quiet hook:
// Moss wakes for a moment and keeps the spot beside it clear.
import { arc, bubble, COLOR, easeIn, easeInOut, lerp, seg, wobble } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import { mountPage } from '../kit/page.ts';
import {
  bigTree,
  blinkAt,
  breathe,
  ink,
  leaf,
  paint,
  rect,
  shown,
  startle,
  toward,
  zzz,
} from '../kit/props.ts';

type Ctx = CanvasRenderingContext2D;
const { moss, nib, krit, kite, pim, tove, echo, gulp } = CAST;

// ---- Shared props of this chapter ----

function room(ctx: Ctx, w: number, h: number, floor: number, sky: string = COLOR.page): void {
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, floor);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, floor, w, h - floor);
  ctx.beginPath();
  ctx.moveTo(0, floor);
  ctx.lineTo(w, floor);
  ctx.globalAlpha = 0.35;
  ink(ctx, 1.5);
  ctx.globalAlpha = 1;
}

function sleeper(ctx: Ctx, x: number, y: number, size: number, t: number, squash = 0): void {
  moss(ctx, { x, y, size, blink: 1, squash: breathe(t, 2, 0.04) + squash }, t);
  zzz(ctx, x + size * 0.3, y - size * 0.8, t, size / 60);
}

/** A gray rock, drawn small inside a bubble. */
const rock = (ctx: Ctx): void => {
  ctx.beginPath();
  ctx.ellipse(0, 3, 13, 9, 0, 0, Math.PI * 2);
  paint(ctx, '#b9b4ab', 2);
};

/** A chest of treasure, drawn small inside a bubble. */
const chest = (ctx: Ctx): void => {
  ctx.beginPath();
  ctx.rect(-12, -4, 24, 14);
  paint(ctx, COLOR.wood, 2);
  ctx.beginPath();
  ctx.ellipse(0, -4, 12, 6, 0, Math.PI, 0);
  paint(ctx, COLOR.glow, 2);
};

function acorn(ctx: Ctx, x: number, y: number, s = 1): void {
  ctx.beginPath();
  ctx.ellipse(x, y + 3 * s, 5 * s, 6.5 * s, 0, 0, Math.PI * 2);
  paint(ctx, '#c98a4b', 1.4);
  ctx.beginPath();
  ctx.ellipse(x, y - 2 * s, 6 * s, 3.5 * s, 0, 0, Math.PI * 2);
  paint(ctx, '#8a6a46', 1.4);
}

// ---- Panel 1: Kite has theories ----

function theories(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 150;
  room(ctx, w, h, FY);
  const n = Math.floor(t / 2) % 3;
  const local = t % 2;
  const hop = arc(seg(local, 0.1, 0.4));
  kite(ctx, { x: 300, y: FY - 16 * hop, size: 64, squash: -0.1 * hop + wobble(local, 0.4, 0.15) }, t);
  const ideas = [chest, rock, 'storm'] as const;
  const idea = ideas[n] ?? chest;
  bubble(ctx, 336, 44, idea, shown(local, 0.15, 1.85), [318, 70]);
  // The crowd gasps at each one. Echo repeats it, a beat late.
  const listeners = [
    { draw: pim, x: 90 },
    { draw: tove, x: 170 },
    { draw: gulp, x: 440 },
  ];
  listeners.forEach((c, i) => {
    c.draw(
      ctx,
      {
        x: c.x,
        y: FY,
        size: 56,
        squash: startle(local, 0.5 + i * 0.1),
        look: toward(c.x, FY - 30, 300, FY - 50),
        blink: blinkAt(t, 3, i),
      },
      t,
    );
  });
  echo(ctx, { x: 530, y: FY, size: 56, look: [-0.045, 0], squash: wobble(local, 1.0, 0.15) }, t);
  bubble(ctx, 560, 60, idea, shown(local, 1.0, 1.9) * 0.6, [542, 90]);
}

// ---- Panel 2: theory one, a treasure ----

function treasure(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 170;
  room(ctx, w, h, FY);
  const snore = arc(seg(t, 2.0, 2.4));
  sleeper(ctx, 64, FY, 70, t, -0.12 * snore);
  // A glint at Moss's edge.
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6);
  ctx.beginPath();
  ctx.arc(112, FY - 5, 6, 0, Math.PI * 2);
  paint(ctx, COLOR.glow, 1.4);
  ctx.globalAlpha = 1;
  // Krit tiptoes in, then flees at the snore.
  const x =
    t < 2.1 ? lerp(w + 30, 156, easeInOut(seg(t, 0, 1.8))) : lerp(156, w + 30, easeIn(seg(t, 2.2, 3.4)));
  krit(
    ctx,
    {
      x,
      y: FY,
      size: 58,
      flip: t >= 2.1,
      lean: t < 2.1 ? -0.12 : 0.15,
      look: [-0.04, 0.02],
      squash: startle(t, 2.1),
      shell: { tightness: t >= 2.1 ? 0.7 : 0.2 },
    },
    t,
  );
  bubble(ctx, 160, 60, 'bang', shown(t, 2.1, 3.0) * 0.6, [148, 86]);
}

// ---- Panel 3: theory two, a rock ----

function rockTheory(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 176;
  room(ctx, w, h, FY);
  const sneeze = 2.0;
  sleeper(ctx, 96, FY, 84, t, startle(t, sneeze) * 1.4);
  // Tove sits on top, as calm as on any rock, until the sneeze.
  const pop = arc(seg(t, sneeze, sneeze + 0.6));
  tove(
    ctx,
    {
      x: 96,
      y: FY - 60 - 60 * pop,
      size: 46,
      look: [0.02, 0],
      blink: t < sneeze ? 0.6 : 0,
      squash: wobble(t, sneeze + 0.6, 0.25),
      shell: { tightness: t > sneeze ? 0.8 * (1 - seg(t, 3.0, 3.8)) : 0 },
    },
    t,
  );
  bubble(ctx, 150, 50, 'bang', shown(t, sneeze, 3.4) * 0.6, [124, 74]);
}

// ---- Panel 4: theory three, a fight with the tree ----

function feud(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 180;
  room(ctx, w, h, FY);
  bigTree(ctx, 150, FY, 0.62, COLOR.leaf, Math.sin(t * 2) * (t > 0.4 && t < 2.4 ? 3 : 0.5));
  sleeper(ctx, 60, FY, 54, t);
  bubble(ctx, 150, 48, 'storm', shown(t, 0.5, 2.4) * 0.6, [150, 70]);
  // The tree drops one leaf on Moss. Moss frowns in its sleep.
  const u = seg(t, 2.4, 3.6);
  if (u > 0 && t < 5.6) leaf(ctx, lerp(120, 64, u) + 8 * Math.sin(u * 10), lerp(60, FY - 46, u), 12, 0.6);
  bubble(ctx, 40, 76, 'storm', shown(t, 3.8, 5.6) * 0.55, [52, 104]);
}

// ---- Panel 5: Nib interviews the tree ----

function interview(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 200;
  room(ctx, w, h, FY);
  bigTree(ctx, 200, FY, 0.95, COLOR.leaf, t > 2.0 && t < 2.6 ? Math.sin(t * 30) * 2 : 0);
  const fall = seg(t, 2.4, 2.8);
  const bonk = 2.8;
  if (fall > 0 && t < bonk) acorn(ctx, 92, lerp(110, FY - 62, easeIn(fall)), 1.2);
  nib(
    ctx,
    {
      x: 92,
      y: FY,
      size: 64,
      look: toward(92, FY - 40, 200, 40),
      squash: startle(t, bonk) - 0.06 * arc(seg(t, 0.4, 1.0)),
      blink: t > bonk && t < bonk + 0.3 ? 1 : 0,
    },
    t,
  );
  if (t >= bonk && t < 5.6) acorn(ctx, 96, FY - 70, 1.1);
  bubble(ctx, 130, 70, 'question', shown(t, 0.5, 2.3) * 0.6, [112, 98]);
  bubble(ctx, 130, 70, 'bang', shown(t, bonk, 4.6) * 0.6, [112, 98]);
}

// ---- Panel 6: no comment ----

function notes(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 200;
  room(ctx, w, h, FY);
  // A notebook, and lines that Nib writes one by one.
  ctx.beginPath();
  ctx.rect(150, 112, 90, 70);
  paint(ctx, COLOR.paper, 2);
  const lines = Math.floor(seg(t, 0.3, 3.6) * 4);
  for (let k = 0; k < lines; k++) {
    ctx.beginPath();
    ctx.moveTo(160, 128 + k * 14);
    for (let j = 0; j <= 10; j++) ctx.lineTo(160 + j * 6.5, 128 + k * 14 + Math.sin(j * 2 + k) * 2);
    ink(ctx, 1.5);
  }
  if (lines >= 4) {
    ctx.beginPath();
    ctx.ellipse(196, 170, 30, 10, 0, 0, Math.PI * 2);
    ctx.strokeStyle = COLOR.berry;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const nod = arc(seg(t % 2, 0.2, 0.5));
  nib(ctx, { x: 96, y: FY, size: 70, look: [0.045, 0.03], squash: 0.08 * nod, lean: 0.06 }, t);
  acorn(ctx, 100, FY - 76, 1.1);
  bubble(ctx, 64, 80, 'star', shown(t, 4.0, 5.8) * 0.55, [80, 106]);
}

// ---- Panel 7: the quiet hook ----

const OPEN = 2.0;
const LAND = 4.4;
const PUFF = 6.0;
const CLOSE = 9.4;

function evening(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 200;
  const sky = ctx.createLinearGradient(0, 0, 0, FY);
  sky.addColorStop(0, '#c9b3d6');
  sky.addColorStop(1, '#f4cfae');
  room(ctx, w, h, FY);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, FY - 1);
  bigTree(ctx, 440, FY, 0.92, '#9cc184', Math.sin(t * 0.8) * 1.2);
  // Two spots between the roots. Moss sleeps in one. The other is empty.
  const SPOT = 340;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.ellipse(SPOT, FY + 4, 34, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.ink;
  ctx.fill();
  ctx.globalAlpha = 1;
  const open = seg(t, OPEN, OPEN + 0.8) * (1 - seg(t, CLOSE, CLOSE + 1));
  const puff = arc(seg(t, PUFF, PUFF + 0.4));
  moss(
    ctx,
    {
      x: 250,
      y: FY,
      size: 70,
      blink: 1 - 0.55 * open,
      look: [0.05 * open, -0.01],
      squash: breathe(t, 2.4, 0.03) - 0.1 * puff,
    },
    t,
  );
  if (open < 0.05) zzz(ctx, 272, FY - 56, t, 1.1);
  // A breath that pushes the leaf off the empty spot.
  if (puff > 0) {
    ctx.globalAlpha = puff * 0.7;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(292 + k * 4, FY - 30 + k * 7);
      ctx.lineTo(310 + k * 8, FY - 32 + k * 7);
      ink(ctx, 1.6);
    }
    ctx.globalAlpha = 1;
  }
  // One leaf falls onto the empty spot, rests, and slides away.
  const fall = seg(t, LAND - 1.6, LAND);
  const away = easeInOut(seg(t, PUFF + 0.2, PUFF + 1.0));
  if (fall > 0 && away < 1)
    leaf(
      ctx,
      lerp(lerp(310, SPOT, fall) + 10 * Math.sin(fall * 9), SPOT + 150, away),
      lerp(70, FY - 2, easeIn(fall)) - arc(away) * 10,
      14,
      0.3 + away,
      '#e8894a',
    );
}

// ---- Inset: the other spot ----

function spot(ctx: Ctx, t: number, w: number, h: number): void {
  ctx.fillStyle = '#f4cfae';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, 66, w, h - 66);
  // A root, and the clear place on it.
  ctx.beginPath();
  ctx.moveTo(-4, 70);
  ctx.quadraticCurveTo(w / 2, 46, w + 4, 74);
  ctx.lineTo(w + 4, 84);
  ctx.quadraticCurveTo(w / 2, 60, -4, 82);
  ctx.closePath();
  paint(ctx, COLOR.wood, 2);
  const glow = 0.5 + 0.15 * Math.sin((t / 6) * Math.PI * 2);
  ctx.globalAlpha = glow;
  ctx.fillStyle = COLOR.glow;
  ctx.beginPath();
  ctx.ellipse(w / 2 + 10, 58, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Leaves land all around the spot, but not on it. Moss's edge shows at the left.
  for (const [lx, ly, a] of [
    [70, 86, 0.4],
    [w - 14, 70, -0.5],
    [90, 96, 2.2],
  ] as const)
    leaf(ctx, lx, ly, 16, a, '#e8894a');
  moss(ctx, { x: -6, y: 74, size: 56, blink: 1, squash: breathe(t, 2, 0.03) }, t);
}

mountPage({
  id: 'moss-remembers-2',
  title: 'Moss Remembers',
  folio: 'MOSS REMEMBERS · CHAPTER 1 · PAGE 2',
  label:
    'Page 2 of chapter 1, "The Sleeping Suspect", in seven panels and one inset. ' +
    'Kite has theories, and the crowd gasps at each one, while Echo repeats them a beat late. ' +
    'Theory one: Moss guards a treasure. Something glints under Moss. Krit tiptoes in and flees when Moss snores. ' +
    'Theory two: Moss is a rock. Tove sits on Moss, calm, until Moss sneezes and Tove pops into the air. ' +
    'Theory three: Moss and the tree are not speaking. The tree drops a leaf on Moss, and Moss frowns in its sleep. ' +
    'Nib interviews the tree. The tree drops an acorn on Nib. Nib writes down that the tree had no comment, with the acorn still on its head. ' +
    'That evening, Moss wakes up for a moment and looks at the empty spot beside it on the root. A leaf falls onto the spot. Moss blows it away, and goes back to sleep. ' +
    'In the inset, leaves lie all around the other spot, but the spot stays clear.',
  width: 640,
  height: 1000,
  seconds: 12,
  still: 5.2,
  gifFps: 12.5,
  panels: [
    {
      shape: rect(20, 72, 600, 176),
      seconds: 6,
      caption: { text: 'Kite had theories.', x: 20, y: 72, width: 150 },
      draw: theories,
    },
    {
      shape: rect(20, 260, 190, 210),
      seconds: 4,
      caption: { text: 'One: Moss guards a treasure.', x: 20, y: 260, width: 150 },
      draw: treasure,
    },
    {
      shape: rect(222, 260, 196, 210),
      seconds: 4,
      caption: { text: 'Two: Moss is a rock.', x: 222, y: 260, width: 150 },
      draw: rockTheory,
    },
    {
      shape: rect(430, 260, 190, 210),
      seconds: 6,
      caption: { text: 'Three: Moss and the tree are not speaking.', x: 430, y: 260, width: 170 },
      draw: feud,
    },
    {
      shape: [
        [20, 482],
        [330, 482],
        [310, 716],
        [20, 716],
      ],
      seconds: 6,
      caption: { text: 'Nib interviewed the tree.', x: 20, y: 482, width: 190 },
      draw: interview,
    },
    {
      shape: [
        [342, 482],
        [620, 482],
        [620, 716],
        [322, 716],
      ],
      seconds: 6,
      caption: { text: 'The tree had no comment. Nib wrote that down.', x: 400, y: 482, width: 220 },
      draw: notes,
    },
    {
      shape: rect(20, 728, 600, 252),
      seconds: 12,
      caption: { text: 'That evening, Moss woke up. Just for a moment.', x: 20, y: 728, width: 220 },
      draw: evening,
    },
    {
      shape: { circle: [552, 912, 52] },
      seconds: 6,
      caption: { text: 'The other spot stayed clear.', x: 482, y: 818, width: 138 },
      draw: spot,
    },
  ],
});
