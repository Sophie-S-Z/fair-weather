// Tuck Says Go Away: a vertical clip.
// A butterfly lands on Tuck, who only wants to be alone. Tuck bristles. The butterfly brings friends.
// Krit sells tickets to look at them. At night all three butterflies sleep on Tuck, and Tuck's storm
// turns into a small heart, then quickly back into a storm. The adult layer: boundaries, and soft hearts.
import { arc, bubble, easeBack, easeInOut, hops, lerp, seg, wobble } from '../kit/draw.ts';
import { CAST, type Who } from '../kit/cast.ts';
import { mountClip } from '../kit/clip.ts';
import {
  blinkAt,
  breathe,
  butterfly,
  cookie,
  cookieStack,
  ink,
  meadow,
  mini,
  moon,
  paint,
  shown,
  startle,
  sweat,
  twinkle,
  zzz,
} from '../kit/props.ts';

type Ctx = CanvasRenderingContext2D;
const { tuck, krit } = CAST;

const SECONDS = 38;
const FY = 560;
const TUCK_X = 290;
const TUCK_SIZE = 190;
const STAND = 112;
const NIGHT = 21.5;
/** The longest hold: Tuck looks up at its sleeping guests. */
const HOLD = 24.2;
const HEART = 28.6;
const STORM = 29.9;
const FADE_OUT = 34.5;
const FADE_IN = 36.5;

/** Each butterfly: its color, its seat on Tuck, and when it lands. */
const FLIES = [
  { color: '#ffe7a3', seat: [TUCK_X + 4, FY - 178], land: 5.0 },
  { color: '#f6c4d2', seat: [TUCK_X - 54, FY - 150], land: 11.6 },
  { color: '#c9c0ef', seat: [TUCK_X + 60, FY - 146], land: 12.0 },
] as const;

/** Visitors pay Krit one cookie, look at Tuck with a heart, and go. */
const VISITORS: readonly { who: Who; at: number; size: number }[] = [
  { who: 'pim', at: 16.0, size: 112 },
  { who: 'gulp', at: 17.6, size: 96 },
  { who: 'dollop', at: 19.2, size: 100 },
];
const VISIT = 2.2;

/** Rgb strings blend from day to night. */
function blend(day: readonly number[], night: readonly number[], u: number): string {
  const c = day.map((d, i) => Math.round(lerp(d, night[i] ?? d, u)));
  return `rgb(${c.join(', ')})`;
}

/** Krit's ticket stand: a counter, a sign with a cookie and an eye, and the takings on top. */
function stand(ctx: Ctx, x: number, s: number, takings: number): void {
  if (s <= 0) return;
  ctx.save();
  ctx.translate(x, FY);
  ctx.scale(s, s);
  for (const px of [-44, 44]) {
    ctx.beginPath();
    ctx.rect(px - 4, -150, 8, 150);
    paint(ctx, '#d8b48a');
  }
  ctx.beginPath();
  ctx.rect(-56, -66, 112, 66);
  paint(ctx, '#d8b48a', 2.4);
  ctx.beginPath();
  ctx.moveTo(-56, -40);
  ctx.lineTo(56, -40);
  ink(ctx, 1.4);
  // The sign: one cookie buys one look.
  ctx.beginPath();
  ctx.rect(-50, -184, 100, 42);
  paint(ctx, '#fffdf8', 2.4);
  cookie(ctx, -24, -163, 11);
  ctx.beginPath();
  ctx.moveTo(-6, -163);
  ctx.lineTo(4, -163);
  ctx.moveTo(0, -168);
  ctx.lineTo(4, -163);
  ctx.lineTo(0, -158);
  ink(ctx, 2);
  ctx.beginPath();
  ctx.ellipse(26, -163, 14, 8, 0, 0, Math.PI * 2);
  paint(ctx, '#fffdf8', 2);
  ctx.beginPath();
  ctx.arc(26, -163, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#2b2a28';
  ctx.fill();
  ctx.restore();
  cookieStack(ctx, x + 30, FY - 66 * s, takings, 0, 10);
}

/** One butterfly: it flies in, lands, and later sleeps with its wings shut. */
function fly(ctx: Ctx, f: (typeof FLIES)[number], t: number, i: number): void {
  const [sx, sy] = f.seat;
  const start = f.land - 1.8;
  if (t < start) return;
  const come = easeInOut(seg(t, start, f.land));
  const back = i === 0 && t > 10.2 ? easeInOut(seg(t, 10.2, 11.4)) : 1;
  let x = lerp(600, sx, come);
  let y = lerp(sy - 220, sy, come) + Math.sin(t * 5 + i) * 14 * (1 - come);
  // The first one flies off once, and comes back with the others.
  if (i === 0 && t > 8.4) {
    const out = easeInOut(seg(t, 8.4, 9.6));
    x = t < 10.2 ? lerp(sx, 620, out) : lerp(620, sx, back);
    y = (t < 10.2 ? lerp(sy, sy - 260, out) : lerp(sy - 260, sy, back)) + Math.sin(t * 5) * 14 * (1 - back);
  }
  const sleep = seg(t, NIGHT + 1, NIGHT + 2.5);
  const flapTime = lerp(t, 0.01 * Math.sin(t), sleep);
  // While seated, it rides Tuck's breath.
  const seated = seg(t, f.land - 0.1, f.land);
  butterfly(ctx, x, y + seated * 3 * Math.sin((t / 2.4) * Math.PI * 2), flapTime, 1.7, f.color);
  if (sleep > 0.6 && i === 0) zzz(ctx, sx + 16, sy - 12, t, 0.7);
}

function art(ctx: Ctx, t: number, w: number, h: number): void {
  const night = seg(t, NIGHT, NIGHT + 2.5);
  meadow(ctx, w, h, FY, t, blend([228, 237, 240], [52, 62, 96], night));
  if (night > 0) {
    ctx.globalAlpha = night;
    moon(ctx, 440, 150, 26);
    for (let k = 0; k < 7; k++) twinkle(ctx, 40 + ((k * 83) % 460), 130 + ((k * 47) % 250), t, k);
    ctx.globalAlpha = 1;
    // The floor dims too.
    ctx.globalAlpha = 0.25 * night;
    ctx.fillStyle = '#3b4a78';
    ctx.fillRect(0, FY, w, h - FY);
    ctx.globalAlpha = 1;
  }

  // Krit and the stand, from 14.5. Krit naps on its takings at night.
  const open = easeBack(seg(t, 15.0, 15.4));
  const paid = VISITORS.filter((v) => t > v.at + 1.3).length;
  if (t > 14.4) {
    const walk = hops(t, 14.4, 15.0, -60, STAND - 10, 3);
    const nap = seg(t, NIGHT + 0.5, NIGHT + 1.5);
    krit(
      ctx,
      {
        x: walk.x,
        y: FY - 40 - walk.lift,
        size: 110,
        look: [0.05, 0],
        squash: walk.squash + 0.1 * nap + wobble(t, 15.4, 0.15),
        blink: nap,
      },
      t,
    );
    stand(ctx, STAND, open, 1 + paid);
    bubble(ctx, STAND + 40, FY - 270, 'crown', shown(t, 15.6, NIGHT) * 0.85, [STAND + 20, FY - 196]);
    if (nap > 0.5) zzz(ctx, STAND, FY - 190, t, 0.8);
  }

  // The visitors: each one hops in from the right, pays, looks, and goes.
  for (const v of VISITORS) {
    if (t < v.at || t > v.at + VISIT + 0.8) continue;
    const inX = hops(t, v.at, v.at + 0.6, 600, 446, 3);
    const outX = hops(t, v.at + VISIT, v.at + VISIT + 0.7, 446, 640, 3);
    const leaving = t > v.at + VISIT;
    const x = leaving ? outX.x : inX.x;
    CAST[v.who](
      ctx,
      {
        x,
        y: FY - (leaving ? outX.lift : inX.lift),
        size: v.size,
        flip: !leaving,
        look: [-0.05, 0],
        squash: (leaving ? outX.squash : inX.squash) + startle(t, v.at + 1.4),
        shell: { color: 0.5 },
      },
      t,
    );
    // The cookie flies over Tuck to Krit's counter.
    const toss = seg(t, v.at + 0.7, v.at + 1.3);
    if (toss > 0 && toss < 1)
      cookie(ctx, lerp(x - 20, STAND + 30, toss), lerp(FY - v.size, FY - 80, toss) - arc(toss) * 160, 10);
    bubble(ctx, x - 20, FY - v.size - 60, 'heart', shown(t, v.at + 1.4, v.at + VISIT) * 0.85, [
      x - 10,
      FY - v.size - 20,
    ]);
  }

  // Tuck: still as a stone, with spikes that say everything.
  const landed = FLIES.filter((f) => t > f.land).length;
  const angry =
    t < 8.4 ? seg(t, 5.1, 5.4) : t < 11.6 ? 1 - 0.6 * seg(t, 8.6, 9.6) : 0.4 + 0.6 * seg(t, 11.7, 12.1);
  const soften = seg(t, HOLD + 1, HEART);
  const snap = seg(t, STORM, STORM + 0.15);
  const bristle = lerp(0.15, 0.95, angry) * (1 - soften) + 0.1 * soften + 0.5 * snap;
  const lookUp = easeInOut(seg(t, HOLD + 0.4, HOLD + 3));
  tuck(
    ctx,
    {
      x: TUCK_X,
      y: FY,
      size: TUCK_SIZE,
      squash: startle(t, 5.05) + breathe(t, 2.4, 0.02),
      look: [lerp(0, 0.01, lookUp), lerp(0, 0.07, lookUp)],
      blink: t < 3 ? 0.7 : blinkAt(t, 4.1, 0.5) * (1 - lookUp),
      shell: {
        bristle,
        color: 0.2 + 0.6 * soften * (1 - snap),
        tightness: landed > 1 && t < NIGHT ? 0.4 : 0,
      },
    },
    t,
  );
  if (t > 12.3 && t < 14.6) sweat(ctx, TUCK_X + 84, FY - 150, t, 1.1);
  FLIES.forEach((f, i) => {
    fly(ctx, f, t, i);
  });

  // Tuck's bubbles: alone, then a storm, a bigger storm, a heart, and a storm again.
  const bx = TUCK_X + 120;
  const by = FY - 290;
  const tail = [TUCK_X + 70, FY - 196] as const;
  bubble(ctx, bx, by, mini(tuck, t), shown(t, 0.2, 3.3) * 1.5, tail);
  bubble(ctx, bx, by, 'storm', shown(t, 5.6, 9.2) * 1.2, tail);
  bubble(ctx, bx, by, 'storm', shown(t, 12.3, NIGHT - 0.4) * lerp(1.2, 1.7, seg(t, 12.3, 13)), tail);
  bubble(ctx, bx, by, 'heart', shown(t, HEART, STORM - 0.15) * 0.9, tail);
  bubble(ctx, bx, by, 'storm', shown(t, STORM, FADE_IN) * 1.3, tail);
}

/** The camera turns about this point, near Tuck. */
const PIVOT = [270, FY - 140] as const;

/** A close frame that pushes in on Tuck through the night hold, then eases back for the punch. */
function zoom(t: number): number {
  return 1.25 + 0.25 * easeInOut(seg(t, HOLD, HEART)) - 0.12 * easeInOut(seg(t, STORM, STORM + 0.6));
}

mountClip({
  id: 'tuck-go-away',
  series: 'Tuck Says Go Away',
  title: 'Firmly',
  label:
    'A short vertical clip. Tuck, a round hedgehog, likes being alone; its bubble shows only itself. ' +
    'A butterfly lands on Tuck. Tuck bristles and shows a storm in its bubble, but holds very still. ' +
    'The butterfly flies off and comes back with two friends. The storm grows bigger, and Tuck sweats. ' +
    'Krit sets up a ticket stand: one cookie per look. Pim, Gulp, and Dollop each pay a cookie, look at Tuck with a heart, and leave. ' +
    'Night falls. Krit naps on its cookies. All three butterflies sleep on Tuck. Tuck looks up at them for a long moment, ' +
    'its spikes go soft, and a small heart shows in its bubble. Then, quickly, the storm comes back. ' +
    'Captions: Tuck likes being alone. Tuck said go away. It came back with friends. Krit sold tickets. One cookie per look. Tuck said no. Firmly.',
  seconds: SECONDS,
  still: 32,
  draw(ctx, t, w, h) {
    const time = t >= FADE_IN ? 0 : t;
    const z = zoom(time);
    ctx.save();
    // At the push in, the frame drifts toward Tuck.
    const drift = (TUCK_X - PIVOT[0]) * seg(z, 1.25, 1.5);
    ctx.translate(PIVOT[0], PIVOT[1]);
    ctx.scale(z, z);
    ctx.translate(-PIVOT[0] - drift, -PIVOT[1]);
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
    { from: 0.3, to: 3.3, text: 'Tuck likes being alone.' },
    { from: 5.6, to: 8.4, text: 'Tuck said go away.' },
    { from: 12.4, to: 15.0, text: 'It came back with friends.' },
    { from: 16.2, to: 20.8, text: 'Krit sold tickets. One cookie per look.' },
    { from: STORM + 0.1, to: FADE_OUT + 0.4, text: 'Tuck said no. Firmly.' },
  ],
  sounds: [
    { at: 0.3, who: 'tuck', mood: 'sleepy' },
    { at: 3.4, fx: 'swish' },
    { at: 5.0, fx: 'pop' },
    { at: 5.3, who: 'tuck', mood: 'angry' },
    { at: 8.5, fx: 'swish' },
    { at: 10.4, fx: 'swish' },
    { at: 11.6, fx: 'pop' },
    { at: 12.0, fx: 'pop' },
    { at: 12.3, who: 'tuck', mood: 'angry' },
    { at: 14.6, who: 'krit', mood: 'happy' },
    { at: 15.2, fx: 'thud' },
    ...VISITORS.flatMap((v) => [
      { at: v.at + 1.3, fx: 'ding' as const },
      { at: v.at + 1.45, who: v.who, mood: 'happy' as const },
    ]),
    { at: NIGHT + 1, who: 'krit', mood: 'sleepy' },
    { at: HOLD, fx: 'hold' },
    { at: HEART, who: 'tuck', mood: 'happy' },
    { at: STORM, fx: 'pop' },
    { at: STORM + 0.05, who: 'tuck', mood: 'angry' },
  ],
});
