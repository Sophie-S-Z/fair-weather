// Meet Nib: curious. Nib has to see everything up close, even a soap bubble.
import { arc, COLOR, easeInOut, easeOut, lerp, seg, wobble } from '../kit/draw.ts';
import { drawNib } from '../kit/friends.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const X = 200;
const POP = 2.5;
const NOSE: [number, number] = [X + 70, FLOOR - 64];

/** The bubble drifts in from the right and sinks to Nib's nose. */
function bubblePos(t: number): [number, number] {
  const u = easeOut(seg(t, 0, POP));
  return [lerp(540, NOSE[0], u), lerp(90, NOSE[1], u) + Math.sin(u * Math.PI * 3) * 18 * (1 - u)];
}

function soap(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(219, 238, 246, 0.6)';
  ctx.fill();
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 9, Math.PI * 1.1, Math.PI * 1.45);
  ctx.strokeStyle = COLOR.paper;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Short lines that fly out where the bubble popped. */
function pop(ctx: CanvasRenderingContext2D, u: number): void {
  if (u <= 0 || u >= 1) return;
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1 - u;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const r0 = 10 + 14 * u;
    ctx.beginPath();
    ctx.moveTo(NOSE[0] + Math.cos(a) * r0, NOSE[1] + Math.sin(a) * r0);
    ctx.lineTo(NOSE[0] + Math.cos(a) * (r0 + 6), NOSE[1] + Math.sin(a) * (r0 + 6));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

mount({
  id: 'meet-nib',
  tag: 'Meet Nib · curious',
  caption: 'Nib has to see everything up close.',
  seconds: 5.2,
  still: 2.3,
  draw(ctx, t) {
    const [bx, by] = bubblePos(t);
    // Nib leans in to the bubble, the bubble pops on its nose, and Nib looks out for the next one.
    const near = easeInOut(seg(t, 1.6, 2.4)) * (1 - easeInOut(seg(t, POP + 0.1, POP + 0.6)));
    const watch: [number, number] =
      t < POP ? [Math.max(-0.02, Math.min(0.07, (bx - X) / 3000)), (FLOOR - 60 - by) / 2500] : [0.06, 0.03];
    const lookOut = seg(t, 4.2, 4.6);

    drawNib(
      ctx,
      {
        x: X,
        y: FLOOR,
        size: 104,
        lean: 0.3 * near,
        squash: -0.08 * near + wobble(t, POP, 0.25),
        look: t < POP ? watch : [lerp(0, 0.06, lookOut), lerp(0, 0.03, lookOut)],
        blink: arc(seg(t, POP, POP + 0.35)),
        shell: { color: 0.2 + 0.5 * near },
      },
      t,
    );

    if (t < POP) soap(ctx, bx, by);
    pop(ctx, seg(t, POP, POP + 0.4));
  },
});
