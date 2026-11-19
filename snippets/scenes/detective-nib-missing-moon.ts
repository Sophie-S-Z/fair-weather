// Detective Nib, case 2: "The Missing Moon". A comic page in five panels and one inset.
// The clue trail leads past the true answer, which is asleep. The adult layer: a confident expert
// who eats the evidence, and a line-up picked by shape alone.
import { arc, bubble, COLOR, easeBack, easeIn, easeInOut, hops, lerp, seg, wobble } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import { mountPage } from '../kit/page.ts';
import {
  blinkAt,
  breathe,
  cookie,
  ink,
  mirror,
  moon,
  paint,
  rect,
  shown,
  startle,
  toward,
  twinkle,
  zzz,
} from '../kit/props.ts';

type Ctx = CanvasRenderingContext2D;
const { nib, pim, tove, kite, moss, krit, gulp, bell, drift } = CAST;

// ---- Night ----

const NIGHT = '#34405a';
const NIGHT_FLOOR = '#bdb6a2';
const SILVER = '#e9eef6';

/** A night meadow: dark sky, a dark far hill, a dim floor, and stars. `light` brightens the sky (0 to 1). */
function night(ctx: Ctx, w: number, h: number, horizon: number, t: number, light = 0): void {
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, w, horizon);
  if (light > 0) {
    ctx.globalAlpha = 0.35 * light;
    ctx.fillStyle = '#8fa3c4';
    ctx.fillRect(0, 0, w, horizon);
    ctx.globalAlpha = 1;
  }
  for (let k = 0; k < 14; k++)
    twinkle(ctx, ((k * 0.317 + 0.05) % 1) * w, 12 + ((k * 53) % (horizon - 50)), t, k);
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.bezierCurveTo(w * 0.3, horizon - 30, w * 0.6, horizon - 4, w, horizon - 20);
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fillStyle = '#46546d';
  ctx.fill();
  ctx.fillStyle = NIGHT_FLOOR;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ink(ctx, 1.5);
}

/** A silver crumb with a soft glow. */
function silver(ctx: Ctx, x: number, y: number, r: number, t: number): void {
  ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4 + x);
  ctx.fillStyle = SILVER;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  paint(ctx, SILVER, 1.2);
}

/** Nib's magnifying lens, held out in front at (x, y); `dir` is 1 for right, -1 for left. */
function lens(ctx: Ctx, x: number, y: number, dir: 1 | -1 = 1, r = 10): void {
  ctx.beginPath();
  ctx.moveTo(x - dir * r * 0.7, y + r * 0.7);
  ctx.lineTo(x - dir * r * 1.6, y + r * 1.9);
  ink(ctx, 3);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.glass;
  ctx.globalAlpha = 0.75;
  ctx.fill();
  ctx.globalAlpha = 1;
  ink(ctx, 2.5);
}

/** A dashed circle: the place where the moon should be. */
function gap(ctx: Ctx, x: number, y: number, r: number, t: number): void {
  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.lineDashOffset = -t * 6;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = SILVER;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// ---- Panel 1: the moon did not come up ----

function noMoon(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 168;
  night(ctx, w, h, FY, t);
  gap(ctx, 470, 52, 28, t);
  const up: [number, number] = [0, -0.045];
  pim(ctx, { x: 110, y: FY, size: 66, look: toward(110, FY - 40, 470, 52), blink: blinkAt(t, 3, 0.4) }, t);
  tove(ctx, { x: 190, y: FY, size: 58, look: up, squash: breathe(t, 1, 0.04), shell: { tightness: 0.3 } }, t);
  kite(ctx, { x: 270, y: FY, size: 62, look: up, squash: wobble(t, 2.2, 0.15) }, t);
  nib(ctx, { x: 370, y: FY, size: 58, look: toward(370, FY - 30, 470, 52), lean: -0.08 }, t);
  lens(ctx, 396, FY - 66, 1, 11);
  moss(ctx, { x: 540, y: FY, size: 56, blink: 1, squash: breathe(t, 2, 0.03) }, t);
  zzz(ctx, 556, FY - 50, t, 0.8);
  bubble(ctx, 136, 62, 'question', shown(t, 0.6, 5.6) * 0.6, [118, 96]);
  bubble(ctx, 296, 66, 'monster', shown(t, 2.2, 5.6) * 0.6, [278, 100]);
}

// ---- Panel 2: a trail of silver crumbs ----

function trail(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 166;
  night(ctx, w, h, FY, t);
  for (let k = 0; k < 9; k++) silver(ctx, 30 + k * 32, 190 + (k % 2) * 6, 2.2, t);
  // Nib creeps along, nose down behind the lens, then hops back to the start.
  const walk = t < 4.6 ? hops(t, 0.3, 4.2, 50, 220, 6) : hops(t, 4.6, 5.8, 220, 50, 3);
  const back = t >= 4.6 && t < 5.8;
  const y = FY + 26 - walk.lift * 0.4;
  nib(
    ctx,
    { x: walk.x, y, size: 56, squash: walk.squash, lean: back ? 0 : 0.16, flip: back, look: [0.04, -0.045] },
    t,
  );
  if (!back) lens(ctx, walk.x + 36, y - 22, 1, 11);
}

// ---- Panel 3: Nib tests the brightest crumb ----

const LICK = 2.0;

function brightest(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 166;
  night(ctx, w, h, FY, t);
  const back = seg(t, 3.4, 3.9);
  if (t < LICK + 0.15 || back > 0)
    silver(ctx, 170, t < LICK + 0.15 ? 196 : lerp(-10, 196, easeIn(back)), 5, t);
  const lean = arc(seg(t, 0.4, LICK + 0.4));
  nib(
    ctx,
    {
      x: 112,
      y: 206,
      size: 74,
      lean: 0.25 * lean,
      squash: 0.1 * lean + wobble(t, LICK + 0.1, 0.2),
      look: [0.045, -0.05],
      blink: t > LICK && t < LICK + 0.5 ? 1 : 0,
      shell: { color: t > LICK ? 0.9 : 0.3 },
    },
    t,
  );
  // The tongue: one quick, scientific lick.
  const lick = arc(seg(t, LICK - 0.2, LICK + 0.2));
  if (lick > 0) {
    ctx.beginPath();
    ctx.moveTo(140, 178);
    ctx.lineTo(lerp(140, 168, lick), lerp(178, 194, lick));
    ctx.strokeStyle = COLOR.berry;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  bubble(ctx, 186, 92, 'heart', shown(t, LICK + 0.3, 3.4) * 0.75, [152, 126]);
  bubble(ctx, 186, 92, 'question', shown(t, 0.5, LICK - 0.3) * 0.6, [152, 126]);
}

// ---- Panel 4: the suspects ----

function suspects(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 154;
  night(ctx, w, h, FY, t);
  // Height lines on the wall, as in a police line-up.
  ctx.globalAlpha = 0.25;
  for (let y = 40; y < FY; y += 16) {
    ctx.beginPath();
    ctx.moveTo(140, y);
    ctx.lineTo(w, y);
    ctx.strokeStyle = SILVER;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // The lens visits each suspect in turn: 1.5 s each.
  const who = Math.floor(t / 2) % 3;
  const SPOTS = [220, 370, 520] as const;
  const at = SPOTS[who] ?? 220;
  const prev = SPOTS[(who + 2) % 3] ?? 220;
  const lx = lerp(prev, at, easeInOut(seg(t % 2, 0, 0.5)));

  // Krit holds up a round thing. It is a cookie.
  const caught = who === 0 ? seg(t % 2, 0.5, 0.8) : 0;
  krit(ctx, { x: SPOTS[0], y: FY, size: 76, look: [0, 0.03], lean: -0.1 * caught }, t);
  cookie(ctx, SPOTS[0] + 46 - 30 * caught, FY - 46, 13);
  // Gulp has round cheeks. It is a fly.
  gulp(
    ctx,
    { x: SPOTS[1], y: FY, size: 66, squash: 0.08 + (who === 1 ? wobble(t % 2, 0.6, 0.15) : 0), blink: 0.5 },
    t,
  );
  // Bell has a round mirror. Bell is busy.
  bell(ctx, { x: SPOTS[2] - 20, y: FY, size: 76, look: [0.045, 0], blink: blinkAt(t, 2.2) }, t);
  mirror(ctx, SPOTS[2] + 34, FY - 62, 16, (t % 2) / 2);

  nib(ctx, { x: 70, y: FY, size: 64, look: [0.045, 0], lean: 0.08 }, t);
  lens(ctx, lx, 70, 1, 22);
  bubble(ctx, lx + 30, 30, 'question', shown(t % 2, 0.5, 1.8) * 0.55, [lx + 18, 50]);
}

// ---- Panel 5: Drift was sitting on it ----

const WAKE = 4.0;
const SETTLE = 9.4;

function reveal(ctx: Ctx, t: number, w: number, h: number): void {
  const FY = 230;
  const rise = easeBack(seg(t, WAKE + 0.4, WAKE + 1.2)) * (1 - easeInOut(seg(t, SETTLE, SETTLE + 1.8)));
  night(ctx, w, h, FY, t, rise);
  // The moon rests on the far hill until Drift lets it go.
  const mx = lerp(404, 470, rise);
  const my = lerp(FY - 30, 70, rise);
  moon(ctx, mx, my, 36);

  // Drift naps on top of the moon, wakes with a start, and floats off. At the end it comes back.
  const off = easeInOut(seg(t, WAKE + 0.2, WAKE + 1.6)) * (1 - easeInOut(seg(t, SETTLE - 0.4, SETTLE + 1.8)));
  const dx = lerp(mx, 320, off);
  const dy = lerp(my - 22, 90, off) + 4 * Math.sin(t * 1.5) * off;
  const asleep = t < WAKE || t > SETTLE + 1.6;
  drift(
    ctx,
    { x: dx, y: dy, size: 60, blink: asleep ? 1 : 0, squash: startle(t, WAKE), look: [0.03, -0.02] },
    t,
  );
  if (asleep) zzz(ctx, dx + 20, dy - 48, t, 0.8);
  bubble(ctx, 340, 30, 'question', shown(t, WAKE + 1.8, SETTLE - 0.6) * 0.6, [326, 52]);

  // The meadow looks up all at once. Nib writes it down.
  const look = seg(t, WAKE + 0.8, WAKE + 1.2) * (1 - seg(t, SETTLE + 1, SETTLE + 1.6));
  const crowd = [
    { draw: pim, x: 52, size: 66 },
    { draw: krit, x: 120, size: 66 },
    { draw: gulp, x: 192, size: 58 },
    { draw: bell, x: 262, size: 66 },
  ];
  crowd.forEach((c, i) => {
    const eye = toward(c.x, FY - 40, mx, my);
    c.draw(
      ctx,
      {
        x: c.x,
        y: FY,
        size: c.size,
        squash: startle(t, WAKE + 0.8 + i * 0.08),
        look: [lerp(0.03, eye[0], look), lerp(-0.01, eye[1], look)],
        blink: blinkAt(t, 3, i * 0.7),
      },
      t,
    );
  });
  bubble(ctx, 88, 124, 'heart', shown(t, WAKE + 1.4, SETTLE) * 0.7, [70, 152]);
  nib(ctx, { x: 334, y: FY, size: 62, look: toward(334, FY - 30, mx, my), squash: startle(t, WAKE + 1) }, t);
  bubble(ctx, 362, 140, 'bang', shown(t, WAKE + 1.0, WAKE + 3) * 0.6, [348, 164]);
}

// ---- Inset: one crumb for the file ----

function file(ctx: Ctx, t: number, w: number, h: number): void {
  ctx.fillStyle = COLOR.glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, 92, w, h - 92);
  // A paper folder, labeled with a crumb.
  ctx.beginPath();
  ctx.rect(72, 72, 34, 26);
  ctx.moveTo(72, 72);
  ctx.lineTo(80, 66);
  ctx.lineTo(90, 66);
  ctx.lineTo(92, 72);
  paint(ctx, COLOR.wood);
  silver(ctx, 89, 85, 2.5, t);
  const chew = Math.sin(t * Math.PI * 4);
  nib(
    ctx,
    { x: 48, y: 108, size: 62, squash: 0.06 * chew, look: [0.03, 0.01], blink: 0.6, shell: { color: 0.9 } },
    t,
  );
  bubble(ctx, 80, 30, 'heart', shown(t, 1, 3.6) * 0.55, [62, 52]);
}

mountPage({
  id: 'detective-nib-missing-moon',
  title: 'The Missing Moon',
  folio: 'DETECTIVE NIB · CASE 2',
  label:
    'A comic page in five panels and one inset, at night. The moon did not come up. Pim, Tove, Kite, and Nib stare at the empty sky, and Moss sleeps. ' +
    'Nib finds a trail of silver crumbs and follows it with a magnifying lens. ' +
    'Nib tests the brightest crumb by licking it, and loves it. ' +
    'The suspects line up because each one has something round: Krit with a cookie, Gulp with round cheeks, and Bell with a round mirror. ' +
    'Then the truth: Drift the cloud was asleep on the moon, on top of the far hill. Drift wakes with a start and floats off, and the moon pops up into the sky. ' +
    'Everyone looks up. In the inset, Nib chews happily next to a case file that holds one silver crumb.',
  width: 640,
  height: 1000,
  seconds: 12,
  still: 7,
  gifFps: 12.5,
  panels: [
    {
      shape: rect(20, 72, 600, 200),
      seconds: 6,
      caption: { text: 'The moon did not come up.', x: 20, y: 72, width: 212 },
      draw: noMoon,
    },
    {
      shape: [
        [20, 284],
        [330, 284],
        [310, 500],
        [20, 500],
      ],
      seconds: 6,
      caption: { text: 'Nib found a trail of silver crumbs.', x: 20, y: 284, width: 170 },
      draw: trail,
    },
    {
      shape: [
        [342, 284],
        [620, 284],
        [620, 500],
        [322, 500],
      ],
      seconds: 4,
      caption: { text: 'Nib tested the brightest crumb.', x: 350, y: 284, width: 160 },
      draw: brightest,
    },
    {
      shape: rect(20, 512, 600, 170),
      seconds: 6,
      caption: { text: 'The suspects. Each one had something round.', x: 20, y: 512, width: 180 },
      draw: suspects,
    },
    {
      shape: rect(20, 694, 600, 286),
      seconds: 12,
      caption: { text: 'Drift was sitting on it.', x: 20, y: 694, width: 190 },
      draw: reveal,
    },
    {
      shape: { circle: [552, 910, 60] },
      seconds: 4,
      caption: { text: 'Nib kept one crumb for the file.', x: 478, y: 808, width: 142 },
      draw: file,
    },
  ],
});
