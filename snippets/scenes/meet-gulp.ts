// Meet Gulp: always hungry. Gulp catches a fly, and the next fly is already on its way.
import frog from '../../content/rigs/frog.rig.json';
import { COLOR, creature, easeInOut, easeOut, lerp, seg, wobble } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawGulp = creature(frog);
const X = 180;
const SIZE = 100;
const MOUTH: [number, number] = [X, FLOOR - SIZE * 1.05 * 0.62];
const ZAP = 1.5;
const SECONDS = 4.8;

/** The fly circles over here; the next fly flies in from the right to the same circle. */
function fly(t: number): [number, number] {
  const a = t * 5;
  return [330 + Math.cos(a) * 45, 110 + Math.sin(a * 2) * 22];
}

function drawFly(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const flap = Math.sin(t * 60) * 0.5;
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 6, y - 8, 8, 4.5, side * (0.8 + flap), 0, Math.PI * 2);
    ctx.fillStyle = COLOR.glass;
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.ink;
  ctx.fill();
}

mount({
  id: 'meet-gulp',
  tag: 'Meet Gulp · always hungry',
  caption: 'Gulp is never full. Never.',
  seconds: SECONDS,
  still: 1.55,
  draw(ctx, t) {
    const [fx, fy] = fly(t);
    // The tongue shoots out to the fly and comes back with it.
    const out = easeOut(seg(t, ZAP, ZAP + 0.12));
    const reel = easeInOut(seg(t, ZAP + 0.12, ZAP + 0.35));
    const [tx, ty] = fly(ZAP + 0.12);
    const reach = out * (1 - reel);
    const full = seg(t, ZAP + 0.35, ZAP + 0.5) * (1 - seg(t, 3.4, 4.0));

    if (reach > 0) {
      ctx.beginPath();
      ctx.moveTo(MOUTH[0], MOUTH[1]);
      ctx.lineTo(lerp(MOUTH[0], tx, reach), lerp(MOUTH[1], ty, reach));
      ctx.strokeStyle = COLOR.berry;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    const look = (x: number, y: number): [number, number] => {
      const d = Math.hypot(x - MOUTH[0], y - MOUTH[1]) || 1;
      return [((x - MOUTH[0]) / d) * 0.04, (-(y - MOUTH[1]) / d) * 0.04];
    };
    const [nx, ny] = [lerp(560, fx, easeInOut(seg(t, 3.2, SECONDS))), lerp(60, fy, seg(t, 3.2, SECONDS))];
    drawGulp(
      ctx,
      {
        x: X,
        y: FLOOR,
        size: SIZE * (1 + 0.1 * full),
        squash: wobble(t, ZAP + 0.35, 0.25) - 0.05 * full,
        blink: full * (t < 2.6 ? 1 : 0),
        look: t < ZAP + 0.4 ? look(fx, fy) : t > 3.2 ? look(nx, ny) : [0, 0],
        shell: { color: 0.6 * full, softness: 0.3 + 0.6 * full },
      },
      t,
    );

    if (t < ZAP + 0.12) drawFly(ctx, fx, fy, t);
    else if (reach > 0) drawFly(ctx, lerp(MOUTH[0], tx, reach), lerp(MOUTH[1], ty, reach), t);
    if (t > 3.2) drawFly(ctx, nx, ny, t);
  },
});
