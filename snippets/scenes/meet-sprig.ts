// Meet Sprig: eager to grow. Sprig stretches to be as tall as the flower, and the flower bends down to it.
import { arc, bubble, COLOR, easeBack, easeInOut, icon, lerp, seg } from '../kit/draw.ts';
import { drawSprig } from '../kit/friends.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const X = 196;
const STEM_X = 286;
/** The flower head: up high, and bent down over Sprig. */
const UP: [number, number] = [STEM_X, FLOOR - 160];
const DOWN: [number, number] = [X + 20, FLOOR - 112];

function flower(ctx: CanvasRenderingContext2D, bend: number): void {
  const hx = lerp(UP[0], DOWN[0], bend);
  const hy = lerp(UP[1], DOWN[1], bend) - arc(bend) * 14;
  const cx = STEM_X + 4 * bend;
  const cy = lerp(FLOOR - 90, FLOOR - 150, bend);
  ctx.beginPath();
  ctx.moveTo(STEM_X, FLOOR);
  ctx.quadraticCurveTo(cx, cy, hx, hy);
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(STEM_X + 11, FLOOR - 40, 11, 5, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.leaf;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-1.2 * bend);
  icon(ctx, 'flower', 0, 0, 1.5);
  ctx.restore();
}

mount({
  id: 'meet-sprig',
  tag: 'Meet Sprig · eager',
  caption: 'Sprig wants to be tall. The flower meets it halfway.',
  seconds: 6,
  still: 3.9,
  draw(ctx, t) {
    // Sprig stretches up on tiptoe, cannot reach, and sags. The flower bends down to say hello.
    const reach = easeInOut(seg(t, 0.5, 1.2)) * (1 - easeInOut(seg(t, 2.2, 2.7)));
    const strain = reach * seg(t, 1.2, 1.4);
    const bend = easeInOut(seg(t, 2.7, 3.6)) * (1 - easeInOut(seg(t, 4.8, 5.7)));
    const glad = seg(t, 3.5, 3.8) * (1 - seg(t, 5.2, 5.6));

    flower(ctx, bend);
    drawSprig(
      ctx,
      {
        x: X,
        y: FLOOR - 4 * reach,
        size: 84,
        squash: -0.28 * reach + Math.sin(t * 50) * 0.015 * strain,
        look: bend > 0.5 ? [0.03, 0.06] : [0.05, 0.05 * (1 - seg(t, 2.2, 2.6)) + 0.0],
        blink: t > 2.3 && t < 2.6 ? 0.6 : 0,
        shell: { color: 0.2 + 0.7 * glad, softness: 0.5 + 0.5 * glad, tightness: 0.3 * strain },
      },
      t,
    );
    bubble(ctx, X - 66, 92, 'heart', easeBack(seg(t, 3.7, 3.95)) * (1 - seg(t, 4.7, 4.9)), [X - 30, 128]);
  },
});
