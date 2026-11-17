// Meet Glim: honest and fragile. Glim is made of glass, so its feelings show right through.
import glassling from '../../content/rigs/glassling.rig.json';
import { COLOR, creature, easeBack, easeIn, icon, lerp, seg, wobble } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawGlim = creature(glassling);
const X = 230;
const SIZE = 125;
const HEART_Y = FLOOR - SIZE * 0.95 * 0.25;
const DROP = 1.6;
const BLOOM = 3.3;

/** A flower that grows from the floor to the right of Glim. */
function flower(ctx: CanvasRenderingContext2D, grow: number): void {
  const x = 340;
  const top = FLOOR - 100 * grow;
  ctx.beginPath();
  ctx.moveTo(x, FLOOR);
  ctx.quadraticCurveTo(x - 8, (FLOOR + top) / 2, x, top);
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  icon(ctx, 'flower', x, top, grow * 1.6);
}

mount({
  id: 'meet-glim',
  tag: 'Meet Glim · honest',
  caption: 'Glim cannot hide a feeling.',
  seconds: 6,
  still: 2.4,
  draw(ctx, t) {
    // A raindrop makes Glim sad; a flower makes Glim glad again.
    const sad = seg(t, DROP, DROP + 0.1) * (1 - seg(t, BLOOM + 0.3, BLOOM + 0.5));
    const glad = seg(t, BLOOM + 0.3, BLOOM + 0.5);
    const grow = easeBack(seg(t, BLOOM, BLOOM + 0.5)) * (1 - seg(t, 5.3, 5.8));

    if (t > DROP - 0.6 && t < DROP) {
      const y = lerp(-10, FLOOR - SIZE * 0.95, easeIn(seg(t, DROP - 0.6, DROP)));
      ctx.beginPath();
      ctx.moveTo(X + 4, y - 16);
      ctx.quadraticCurveTo(X + 16, y + 3, X + 4, y + 7);
      ctx.quadraticCurveTo(X - 8, y + 3, X + 4, y - 16);
      ctx.fillStyle = COLOR.water;
      ctx.fill();
      ctx.strokeStyle = COLOR.ink;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
    if (grow > 0) flower(ctx, grow);

    drawGlim(
      ctx,
      {
        x: X,
        y: FLOOR,
        size: SIZE,
        squash: wobble(t, DROP, 0.2) + wobble(t, BLOOM + 0.3, 0.15),
        lean: Math.sin(t * 30) * 0.015 * sad,
        look: glad > 0 ? [0.05, 0] : [0, -0.03 * sad],
        shell: { tightness: 0.35 * sad, softness: 0.3 + 0.5 * glad },
      },
      t,
    );

    // The feeling inside the glass: a heart, a small storm, then a bigger heart.
    const beat = 1 + 0.08 * Math.sin(t * 8);
    const heart =
      (1 - seg(t, DROP, DROP + 0.1)) * (t < BLOOM ? 1 : 0) +
      easeBack(seg(t, BLOOM + 0.3, BLOOM + 0.6)) * 1.25;
    ctx.globalAlpha = 0.9;
    icon(ctx, 'heart', X, HEART_Y, heart * beat * (1 - 0.2 * seg(t, 5.3, 5.9)));
    icon(ctx, 'storm', X, HEART_Y - 4, sad * 0.9);
    ctx.globalAlpha = 1;
  },
});
