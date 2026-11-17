// Meet Pim: kind, and shares first. Pim breaks a cookie and gives half to you.
import pim from '../../content/rigs/pim.rig.json';
import {
  arc,
  bubble,
  COLOR,
  creature,
  easeBack,
  easeInOut,
  hops,
  icon,
  lerp,
  seg,
  wobble,
} from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawPim = creature(pim);
const PIM_X = 170;
const CX = 290;
const CY = FLOOR - 14;

/** One half of the cookie, its flat side to the left (-1) or to the right (1), with two chips. */
function half(ctx: CanvasRenderingContext2D, side: -1 | 1, x: number, y: number, s: number): void {
  if (s <= 0) return;
  const r = 12 * s;
  const a = side > 0 ? Math.PI / 2 : -Math.PI / 2;
  ctx.beginPath();
  ctx.arc(x, y, r, a, a + Math.PI);
  ctx.closePath();
  ctx.fillStyle = COLOR.cookie;
  ctx.fill();
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = COLOR.ink;
  for (const [dx, dy] of [
    [0.45, -0.3],
    [0.35, 0.4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x - side * dx * r, y + dy * r, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

mount({
  id: 'meet-pim',
  tag: 'Meet Pim · kind',
  caption: 'Pim always shares. This half is yours.',
  seconds: 5,
  still: 2.4,
  draw(ctx, t) {
    // Pim nudges the cookie, it snaps in two, and one half slides out to you.
    const nudge = hops(t, 0.5, 0.9, PIM_X, PIM_X + 40, 1);
    const back = hops(t, 1.2, 1.6, PIM_X + 40, PIM_X, 1);
    const x = t < 1.2 ? nudge.x : back.x;
    const out = easeInOut(seg(t, 1.0, 1.8));
    const gone = seg(t, 3.9, 4.3);
    const joy = hops(t, 2.0, 2.8, PIM_X, PIM_X, 2);
    const happy = seg(t, 1.8, 2.0) * (1 - seg(t, 4.0, 4.4));

    drawPim(
      ctx,
      {
        x,
        y: FLOOR - joy.lift,
        size: 112,
        squash: nudge.squash + back.squash + joy.squash + wobble(t, 0.9, 0.15),
        look: t < 1.8 ? [0.05, -0.03] : [0.02, 0],
        shell: { softness: 0.6 + 0.4 * happy, color: happy * 0.5 },
      },
      t,
    );

    if (t < 1.0) icon(ctx, 'cookie', CX, CY, 1.3);
    else if (t < 4.3) {
      // Pim keeps the left half; the right half hops forward to you and grows as it comes near.
      half(ctx, 1, CX - 4 * out, CY, 1.3 * (1 - gone));
      const near = lerp(1.3, 2.2, out);
      half(ctx, -1, lerp(CX + 4, 380, out), lerp(CY, FLOOR + 28, out) - arc(out) * 40, near * (1 - gone));
    } else icon(ctx, 'cookie', CX, CY, 1.3 * easeBack(seg(t, 4.4, 4.8)));

    bubble(ctx, PIM_X + 60, 80, 'heart', easeBack(seg(t, 1.9, 2.15)) * (1 - seg(t, 3.7, 3.9)), [
      PIM_X + 30,
      112,
    ]);
  },
});
