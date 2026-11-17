// Meet Echo: a copycat. Echo copies every bounce of a ball, a beat late.
import echo from '../../content/rigs/echo.rig.json';
import { COLOR, creature, seg, wobble } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawEcho = creature(echo);
const BALL_X = 170;
const ECHO_X = 310;
const LATE = 0.5;
/** The ball's bounces: [start, length, height]. Big, small, small, then a tiny one. */
const BOUNCES = [
  [0.2, 0.6, 70],
  [0.8, 0.4, 32],
  [1.2, 0.4, 32],
  [2.3, 0.3, 10],
] as const;

/** Height of the ball above the floor at time t, and the landing squash. */
function bounce(t: number): { lift: number; land: number } {
  let lift = 0;
  let land = 0;
  for (const [start, length, height] of BOUNCES) {
    const u = seg(t, start, start + length);
    if (u > 0 && u < 1) lift = height * 4 * u * (1 - u);
    land += wobble(t, start + length, 0.2);
  }
  return { lift, land };
}

mount({
  id: 'meet-echo',
  tag: 'Meet Echo · copycat',
  caption: 'Echo does what you do, a bit later.',
  seconds: 3.8,
  still: 1.0,
  draw(ctx, t) {
    const ball = bounce(t);
    const copy = bounce(t - LATE);
    const proud = seg(t, 3.0, 3.15) * (1 - seg(t, 3.55, 3.75));

    // The ball: a small orange rubber ball that squashes as it lands.
    const r = 13;
    const flat = Math.max(0, ball.land) * 0.8;
    ctx.beginPath();
    ctx.ellipse(
      BALL_X,
      FLOOR - r * (1 - flat) - ball.lift,
      r * (1 + flat),
      r * (1 - flat),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = COLOR.accent;
    ctx.fill();
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    drawEcho(
      ctx,
      {
        x: ECHO_X,
        y: FLOOR - copy.lift * 0.9,
        size: 110,
        squash: copy.land * 0.6 - (copy.lift > 0 ? 0.06 : 0),
        look: proud > 0 ? [0, 0] : [-0.05, Math.min(0.05, ball.lift / 1000)],
        shell: { color: proud * 0.6, softness: 0.3 + 0.5 * proud },
      },
      t,
    );
  },
});
