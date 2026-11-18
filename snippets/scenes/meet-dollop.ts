// Meet Dollop: jolly and very ticklish. A ladybug climbs up, and Dollop laughs it right off.
import { arc, COLOR, easeIn, easeInOut, easeOut, lerp, seg, wobble } from '../kit/draw.ts';
import { drawDollop } from '../kit/friends.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const X = 260;
const HOME = 130;
const LAUNCH = 2.4;
const LAND = 3.4;

/** A ladybug from the side, facing right, tilted by `angle`. `step` moves its legs. */
function ladybug(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, step: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = COLOR.ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6;
  for (const lx of [-4, 1, 6]) {
    ctx.beginPath();
    ctx.moveTo(lx, -1);
    ctx.lineTo(lx + Math.sin(step + lx) * 2, 3);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(8, -3, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.ink;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -2, 9, 7.5, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = COLOR.berry;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = COLOR.ink;
  for (const [dx, dy] of [
    [-4, -5],
    [2, -6.5],
    [4, -3.5],
  ] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The ladybug's climb hugs Dollop's left side: a curve from the floor to near the top. */
const CLIMB = [
  [X - 60, FLOOR],
  [X - 52, FLOOR - 92],
  [X - 16, FLOOR - 102],
] as const;

/** Where the ladybug is: on the floor, up Dollop's side, in the air, and back on the floor. */
function bug(t: number): { x: number; y: number; angle: number; step: number } {
  if (t < 1.3) return { x: lerp(HOME, X - 60, easeInOut(seg(t, 0, 1.3))), y: FLOOR, angle: 0, step: t * 14 };
  const [p0, p1, p2] = CLIMB;
  if (t < LAUNCH) {
    const u = easeInOut(seg(t, 1.3, LAUNCH - 0.1));
    const v = 1 - u;
    const dx = 2 * v * (p1[0] - p0[0]) + 2 * u * (p2[0] - p1[0]);
    const dy = 2 * v * (p1[1] - p0[1]) + 2 * u * (p2[1] - p1[1]);
    return {
      x: v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0],
      y: v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1],
      angle: Math.atan2(dy, dx),
      step: t * 14,
    };
  }
  const u = seg(t, LAUNCH, LAND);
  if (u < 1)
    return {
      x: lerp(p2[0], HOME, easeOut(u)),
      y: lerp(p2[1], FLOOR, easeIn(u)) - arc(u) * 90,
      angle: -u * Math.PI * 4,
      step: 0,
    };
  // Landed, a bit dizzy.
  return { x: HOME, y: FLOOR, angle: wobble(t, LAND, 0.6), step: 0 };
}

mount({
  id: 'meet-dollop',
  tag: 'Meet Dollop · jolly',
  caption: 'Dollop is very, very ticklish.',
  seconds: 5.4,
  still: 2.1,
  draw(ctx, t) {
    const giggle = seg(t, 1.4, 2.3) * (1 - seg(t, 3.0, 4.2));
    const squash = Math.sin(t * 34) * 0.07 * giggle + (t > LAUNCH ? wobble(t, LAUNCH, -0.3) : 0);

    drawDollop(
      ctx,
      {
        x: X,
        y: FLOOR,
        size: 112,
        squash,
        look: t < 1.4 ? [-0.06, -0.02] : [0, 0],
        blink: 0.8 * giggle,
        shell: { color: 0.2 + 0.7 * giggle, softness: 0.8 + 0.2 * giggle },
      },
      t,
    );

    const b = bug(t);
    ladybug(ctx, b.x, b.y, b.angle, b.step);
  },
});
