// Philosophy (Bergson): what we see has already happened, so we live a little in the past.
import moss from '../../content/rigs/moss.rig.json';
import { COLOR, creature, dashed, easeInOut, lerp, seg } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawMoss = creature(moss);
const MOSS_X = 150;
const SIZE = 115;
const SECONDS = 6.4;
/** How far behind the firefly Moss's eyes are. */
const DELAY = 0.8;
const HEAD: [number, number] = [MOSS_X + 4, FLOOR - SIZE - 10];
/** The firefly's flight: [time, x, y]. It lands on Moss's head and rests there for a while. */
const PATH: readonly (readonly [number, number, number])[] = [
  [0, 330, 95],
  [1.1, 410, 165],
  [2.1, 300, 190],
  [3.1, 250, 70],
  [4.1, ...HEAD],
  [5.4, ...HEAD],
  [SECONDS, 330, 95],
];

/** Where the firefly is at time t, with a small bob in the air. */
function fly(t: number): [number, number] {
  const time = ((t % SECONDS) + SECONDS) % SECONDS;
  const k = PATH.findIndex(([at]) => at > time);
  const a = PATH[k - 1] ?? PATH[0];
  const b = PATH[k] ?? PATH[0];
  if (!a || !b) return [0, 0];
  const u = easeInOut(seg(time, a[0], b[0]));
  const resting = a[1] === b[1] && a[2] === b[2];
  return [lerp(a[1], b[1], u), lerp(a[2], b[2], u) + (resting ? 0 : Math.sin(time * 9) * 4)];
}

function firefly(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 30);
  glow.addColorStop(0, `${COLOR.glow}ee`);
  glow.addColorStop(1, `${COLOR.glow}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(x - 30, y - 30, 60, 60);
  const flap = Math.sin(t * 40) * 0.4;
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 5, y - 4, 5, 3, side * (0.6 + flap), 0, Math.PI * 2);
    ctx.fillStyle = COLOR.paper;
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.accent;
  ctx.fill();
  ctx.stroke();
}

mount({
  id: 'a-little-late',
  tag: 'Philosophy · Bergson',
  caption: 'You always see a little of the past.',
  seconds: SECONDS,
  still: 4.5,
  draw(ctx, t) {
    const [fx, fy] = fly(t);
    const [gx, gy] = fly(t - DELAY);
    const eyeX = MOSS_X;
    const eyeY = FLOOR - SIZE * 0.55;
    const dist = Math.hypot(gx - eyeX, gy - eyeY) || 1;
    // Moss looks where it last saw the firefly. When that catches up to its own head, it beams.
    const found = seg(t, 4.8, 5.1) * (1 - seg(t, 5.9, 6.2));

    dashed(ctx, eyeX + ((gx - eyeX) / dist) * 30, eyeY + ((gy - eyeY) / dist) * 30, gx, gy, t * 25);
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(gx, gy, 9, 0, Math.PI * 2);
    ctx.strokeStyle = COLOR.ink;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    drawMoss(
      ctx,
      {
        x: MOSS_X,
        y: FLOOR,
        size: SIZE,
        look: [((gx - eyeX) / dist) * 0.04, (-(gy - eyeY) / dist) * 0.05],
        squash: -0.08 * found,
        shell: { softness: 0.8 + found * 0.2, color: found },
      },
      t,
    );
    firefly(ctx, fx, fy, t);
  },
});
