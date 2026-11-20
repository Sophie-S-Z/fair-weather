// Inch Made Great Progress Today, "Deadline": a vertical clip.
// Inch has one leaf to move today. Krit stacks forty leaves in a blur, and the tower falls.
// The sun crosses the sky while Inch moves its leaf a little. Then it rains, and Inch's big leaf
// is the only umbrella in the meadow. The adult layer: hustle culture, and the slow plan that works.
import { arc, bubble, easeBack, easeIn, easeInOut, easeOut, hops, lerp, seg, wobble } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import { mountClip } from '../kit/clip.ts';
import { blinkAt, breathe, leaf, meadow, rain, speed, startle, sun, sweat, zzz } from '../kit/props.ts';

type Ctx = CanvasRenderingContext2D;
const { inch, krit, pim, tove, gulp } = CAST;

const SECONDS = 36;
/** The floor line. The caption box sits on the floor, under the creatures. */
const FY = 620;
const TOWER = 176;
const LEAVES = 40;
/** Inch faces left, toward its leaf. Both move a little over the day. */
const INCH_X = 384;
const LEAF_X = 250;
const NUDGE = 56;
/** The day: the sun rises at DAWN and sets at DUSK. */
const DAWN = 10;
const DUSK = 19.5;
/** The longest hold: Inch looks up before the rain. */
const HOLD = 19.5;
const RAIN = 21.6;
const LIFT = 22.6;
/** The end fades to paper, and the first frame fades back in, so the loop joins. */
const FADE_OUT = 33;
const FADE_IN = 34.5;

/** The sky color through the day: blue, then warm at dusk, then gray with rain. */
function sky(t: number): string {
  const warm = seg(t, DUSK - 3, DUSK) * (1 - seg(t, RAIN - 1.5, RAIN));
  const gray = seg(t, RAIN - 1.5, RAIN);
  const mix = (a: number, b: number, c: number) => Math.round(a * (1 - warm - gray) + b * warm + c * gray);
  return `rgb(${String(mix(228, 250, 205))}, ${String(mix(237, 222, 212))}, ${String(mix(240, 196, 220))})`;
}

/** Where leaf k of Krit's tower lands when the tower falls: fixed spots along the floor. */
function fallen(k: number): { x: number; y: number; a: number } {
  return { x: 120 + ((k * 61) % 300), y: FY + 4 + ((k * 23) % 14), a: ((k * 1.7) % 3) - 1.5 };
}

/** Krit's tower: it grows one leaf per trip, sways, and then falls flat. */
function tower(ctx: Ctx, t: number): void {
  const n = Math.floor(seg(t, 3.6, 8.4) * LEAVES);
  const sway = seg(t, 8.4, 9.6) * Math.sin(t * 14) * 6;
  const fall = easeIn(seg(t, 9.6, 10.2));
  for (let k = 0; k < n; k++) {
    const u = k / LEAVES;
    const up = {
      x: TOWER + sway * u * u * 4 + Math.sin(k * 2.1) * 3,
      y: FY - 4 - k * 6,
      a: Math.sin(k * 1.3) * 0.2,
    };
    const down = fallen(k);
    leaf(ctx, lerp(up.x, down.x, fall), lerp(up.y, down.y, fall), 30, lerp(up.a, down.a, fall));
  }
}

/** Krit races to the tower and back, one leaf at a time, then falls asleep in the mess. */
function drawKrit(ctx: Ctx, t: number): void {
  if (t < 3.4) return;
  if (t < 8.6) {
    // One trip each 0.26 s: from off the left edge to the tower, with ghosts for the blur.
    const trip = ((t - 3.4) / 0.26) % 1;
    const x = lerp(-50, TOWER - 30, arc(trip));
    for (let g = 2; g >= 0; g--) {
      const back = arc(Math.max(0, trip - g * 0.06));
      ctx.globalAlpha = g === 0 ? 1 : 0.18;
      krit(
        ctx,
        { x: lerp(-50, TOWER - 30, back), y: FY - 10 * arc((trip * 2) % 1), size: 120, lean: 0.25 },
        t,
      );
    }
    ctx.globalAlpha = 1;
    speed(ctx, x - 20, FY - 60, 1, 50);
    leaf(ctx, x + 4, FY - 130, 26, 0.3);
    return;
  }
  const look = t < 9.6 ? [0.02, 0.05] : [0.05, 0];
  if (t < 23.6) {
    // Krit admires the tower, then flinches as it falls, then sleeps among the leaves.
    const sleep = seg(t, 12, 13) * (1 - seg(t, RAIN + 0.4, RAIN + 0.6));
    krit(
      ctx,
      {
        x: TOWER - 18,
        y: FY,
        size: 120,
        look: t > RAIN ? [0.05, 0.03] : (look as [number, number]),
        squash: startle(t, 9.7) + startle(t, RAIN + 0.5) + 0.12 * sleep + breathe(t, 2.5, 0.03 * sleep),
        blink: sleep,
        shell: { tightness: 0.6 * seg(t, 9.7, 10) * (1 - sleep) },
      },
      t,
    );
    if (t > 9.8 && t < 12) sweat(ctx, TOWER + 12, FY - 100, t, 1.2);
    if (sleep > 0.5) zzz(ctx, TOWER + 2, FY - 120, t);
    return;
  }
}

/** Everyone under the leaf: each one runs in, then squeezes. */
const CROWD = [
  { draw: krit, from: TOWER - 18, to: INCH_X - NUDGE - 118, at: 23.6, size: 112, front: false },
  { draw: pim, from: 560, to: INCH_X - NUDGE + 112, at: 24.6, size: 104, front: false },
  { draw: tove, from: 40, to: INCH_X - NUDGE - 62, at: 25.4, size: 92, front: true },
  { draw: gulp, from: 580, to: INCH_X - NUDGE + 36, at: 26.2, size: 84, front: true },
] as const;

function art(ctx: Ctx, t: number, w: number, h: number): void {
  meadow(ctx, w, h, FY, t, sky(t));

  // The sun crosses the sky. Its arc ends behind the hill.
  const day = seg(t, DAWN, DUSK);
  if (day > 0 && day < 1) sun(ctx, lerp(110, 490, day), 520 - 230 * Math.sin(Math.PI * day), 26, t);

  const wet = seg(t, RAIN, RAIN + 0.6);
  if (wet > 0) {
    ctx.globalAlpha = wet;
    rain(ctx, w, FY + 40, t, 1.4);
    ctx.globalAlpha = 1;
  }

  tower(ctx, t);
  drawKrit(ctx, t);

  // Inch's leaf: it moves one small step over the whole day, then goes up as an umbrella.
  const step = easeInOut(seg(t, DAWN + 1, DUSK - 0.5));
  const inchX = INCH_X - NUDGE * step;
  const leafX = LEAF_X - NUDGE * step;
  const lift = easeBack(seg(t, LIFT, LIFT + 0.8));
  const big = 220;
  const leafY = lerp(FY - 8, FY - 186, lift);

  // The crowd comes in under the leaf: two behind Inch, and two in front.
  const crowd = (front: boolean): void => {
    for (const c of CROWD) {
      if (t < c.at || c.front !== front) continue;
      const run = hops(t, c.at, c.at + 0.7, c.from, c.to, 3);
      const squeeze = seg(t, c.at + 0.7, c.at + 1.6);
      c.draw(
        ctx,
        {
          x: run.x,
          y: FY + (c.front ? 8 : 0) - run.lift,
          size: c.size,
          flip: c.from > c.to,
          squash: run.squash + 0.14 * squeeze + wobble(t, c.at + 0.7, 0.18),
          look: [0, 0.04],
          shell: { tightness: 0.5 * (1 - squeeze), softness: 0.5 * squeeze },
          blink: blinkAt(t, 3.3, c.at),
        },
        t,
      );
    }
  };
  crowd(false);
  const sleepy = seg(t, 13, 14) * (1 - seg(t, HOLD, HOLD + 0.4));
  inch(
    ctx,
    {
      x: inchX,
      y: FY,
      size: 132,
      look: t > HOLD ? [0.01, 0.06] : [-0.05, 0],
      // A heave each two seconds while it pushes; a slow breath at other times.
      squash: t > DAWN + 1 && t < DUSK ? -0.05 * Math.sin((t / 2) * Math.PI * 2) : breathe(t, 2.6),
      lean: t > DAWN + 1 && t < DUSK ? -0.06 : 0,
      blink: Math.max(blinkAt(t, 3.7, 1), sleepy * 0.6),
      shell: { color: 0.3 + 0.4 * seg(t, LIFT + 1, LIFT + 2) },
    },
    t,
  );
  crowd(true);
  // On the floor the leaf lies flat; as an umbrella it shows its full face.
  ctx.save();
  ctx.translate(lerp(leafX, inchX - 18, lift), leafY);
  ctx.scale(1, lerp(0.4, 1, Math.min(1, lift)));
  leaf(ctx, 0, 0, big, lerp(0, -0.08, lift));
  ctx.restore();
  if (lift > 0.5) {
    // The stem, which Inch holds up from its shell.
    ctx.beginPath();
    ctx.moveTo(inchX - 18 + big / 2 - 8, leafY + 2);
    ctx.quadraticCurveTo(inchX + 60, leafY + 50, inchX + 30, FY - 104);
    ctx.strokeStyle = '#2b2a28';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (t > DAWN + 1 && t < DUSK) sweat(ctx, inchX - 52, FY - 112, t, 2.2);

  // Inch's want, in its bubble: this one leaf. Later, a heart, under the full umbrella.
  const want = easeBack(seg(t, 0.15, 0.45)) * (1 - seg(t, 3.3, 3.5));
  bubble(
    ctx,
    INCH_X - 30,
    FY - 214,
    (c: Ctx) => {
      leaf(c, 0, 0, 26, -0.3);
    },
    want * 1.4,
    [INCH_X - 44, FY - 150],
  );
  const proud = easeBack(seg(t, 27.6, 27.9));
  if (t < FADE_IN) bubble(ctx, inchX + 40, FY - 250, 'heart', proud * 0.9, [inchX + 10, FY - 200]);
}

/** The camera turns about this point, near Inch. */
const PIVOT = [300, FY - 40] as const;
/** Where the pivot shows on screen: high enough that the caption box stays on the floor. */
const TARGET = [270, 500] as const;

/** A close frame, a slow push in on Inch during the hold, and back out for the crowd. */
function camera(t: number): number {
  return 1.4 * (1 + 0.14 * easeInOut(seg(t, HOLD, RAIN)) - 0.14 * easeOut(seg(t, 23.4, 25)));
}

mountClip({
  id: 'inch-deadline',
  series: 'Inch Made Great Progress Today',
  title: 'Deadline',
  label:
    'A short vertical clip. Inch, a slow snail, has one goal today, shown in its bubble: move one big leaf. ' +
    'Krit races back and forth in a blur and stacks forty small leaves into a tall tower. The tower sways and falls flat, and Krit falls asleep in the mess. ' +
    'The sun crosses the sky while Inch pushes its leaf a tiny step, sweating. ' +
    'At dusk Inch looks up. Then it rains. Inch lifts its big leaf over its shell like an umbrella. ' +
    'Krit, Pim, Tove, and Gulp run in and squeeze under the leaf, the only dry place in the meadow. Inch shows a heart. ' +
    'Captions: Inch has one goal today. Krit has forty. By sunset, Inch made progress. Then it rained. Inch planned ahead. Sort of.',
  seconds: SECONDS,
  still: 30,
  draw(ctx, t, w, h) {
    // The loop: the end fades to paper, and the first frame fades back in.
    const time = t >= FADE_IN ? 0 : t;
    const zoom = camera(time);
    ctx.save();
    ctx.translate(TARGET[0], TARGET[1]);
    ctx.scale(zoom, zoom);
    ctx.translate(-PIVOT[0], -PIVOT[1]);
    art(ctx, time, w, h);
    ctx.restore();
    const veil = seg(t, FADE_OUT, FADE_IN) * (1 - seg(t, FADE_IN, SECONDS));
    if (veil > 0) {
      ctx.globalAlpha = veil;
      ctx.fillStyle = '#fffdf8';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  },
  lines: [
    { from: 0.3, to: 3.4, text: 'Inch has one goal today.' },
    { from: 4.2, to: 8.2, text: 'Krit has forty.' },
    { from: 12, to: 17.5, text: 'By sunset, Inch made progress.' },
    { from: RAIN, to: 24.4, text: 'Then it rained.' },
    { from: 27, to: FADE_OUT + 0.4, text: 'Inch planned ahead. Sort of.' },
  ],
  sounds: [
    { at: 0.3, who: 'inch', mood: 'happy' },
    { at: 3.5, fx: 'swish' },
    { at: 4.0, who: 'krit', mood: 'happy' },
    ...Array.from({ length: 9 }, (_, k) => ({ at: 4.4 + k * 0.45, fx: 'pop' as const })),
    { at: 6.6, who: 'krit', mood: 'happy' },
    { at: 8.8, who: 'krit', mood: 'surprised' },
    { at: 9.7, fx: 'thud' },
    { at: 12.8, who: 'krit', mood: 'sleepy' },
    { at: 14, who: 'inch', mood: 'sleepy' },
    { at: HOLD, fx: 'hold' },
    { at: RAIN, fx: 'drip' },
    { at: RAIN + 0.3, fx: 'drip' },
    { at: RAIN + 0.55, fx: 'drip' },
    { at: LIFT + 0.2, fx: 'swish' },
    { at: 23.6, who: 'krit', mood: 'surprised' },
    { at: 24.6, who: 'pim', mood: 'happy' },
    { at: 25.4, who: 'tove', mood: 'surprised' },
    { at: 26.2, who: 'gulp', mood: 'happy' },
    { at: 27.6, fx: 'ding' },
    { at: 27.8, who: 'inch', mood: 'happy' },
  ],
});
