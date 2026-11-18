// Meet Tuck: grumpy but soft. Tuck says go away to a butterfly, then holds very still so it can rest.
import { bubble, COLOR, easeBack, easeInOut, lerp, seg, wobble } from '../kit/draw.ts';
import { drawTuck } from '../kit/friends.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const X = 230;
const SIZE = 100;
const PERCH: [number, number] = [X + 4, FLOOR - SIZE - 1];
const LAND = 1.8;
const LEAVE = 4.0;

/** Where the butterfly is, and how fast it flaps. */
function flight(t: number): { x: number; y: number; flap: number } {
  if (t < LAND) {
    const u = easeInOut(seg(t, 0, LAND));
    return {
      x: lerp(-30, PERCH[0], u),
      y: lerp(70, PERCH[1], u) + Math.sin(u * Math.PI * 4) * 16 * (1 - u),
      flap: 22,
    };
  }
  if (t < LEAVE) return { x: PERCH[0], y: PERCH[1], flap: 3 };
  const u = easeInOut(seg(t, LEAVE, 6));
  return { x: lerp(PERCH[0], 520, u), y: lerp(PERCH[1], 50, u) + Math.sin(u * Math.PI * 4) * 14, flap: 22 };
}

function butterfly(ctx: CanvasRenderingContext2D, x: number, y: number, open: number): void {
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 1.8;
  for (const side of [-1, 1]) {
    for (const [wy, rx, ry] of [
      [-5, 9, 7],
      [4, 6, 5],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(x + side * rx * open, y + wy, rx * open + 0.5, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = wy < 0 ? COLOR.glow : COLOR.blush;
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.moveTo(x, y - 9);
  ctx.lineTo(x, y + 8);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.stroke();
}

mount({
  id: 'meet-tuck',
  tag: 'Meet Tuck · grumpy, but soft',
  caption: 'Tuck says go away, but keeps very still.',
  seconds: 6,
  still: 3.4,
  draw(ctx, t) {
    const b = flight(t);
    const huff = seg(t, LAND, LAND + 0.2) * (1 - seg(t, 2.6, 3.0));
    const soft = seg(t, 2.8, 3.2) * (1 - seg(t, 5.0, 5.8));
    const follow = Math.max(-0.07, Math.min(0.07, (b.x - X) / 2500));

    drawTuck(
      ctx,
      {
        x: X,
        y: FLOOR,
        size: SIZE,
        squash: wobble(t, LEAVE + 0.6, 0.12),
        look: t > LAND - 0.2 && t < LEAVE ? [0, 0.05] : [follow, 0.04],
        blink: 0.6 * soft,
        shell: {
          bristle: 0.15 + 0.8 * huff,
          color: 0.2 + 0.7 * soft,
          softness: 0.3 + 0.6 * soft,
        },
      },
      t,
    );
    butterfly(ctx, b.x, b.y, 0.35 + 0.65 * Math.abs(Math.cos(t * b.flap)));
    bubble(ctx, X - 78, 84, 'storm', easeBack(seg(t, 1.95, 2.2)) * (1 - seg(t, 2.6, 2.8)), [X - 44, 122]);
  },
});
