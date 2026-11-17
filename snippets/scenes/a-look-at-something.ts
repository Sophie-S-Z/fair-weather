// Philosophy (Husserl): consciousness is always consciousness of something, even of a thing that is gone.
import quill from '../../content/rigs/quill.rig.json';
import { bubble, COLOR, creature, dashed, easeBack, easeInOut, icon, lerp, seg } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawQuill = creature(quill);
const QUILL_X = 130;
const SIZE = 112;
const EYE: [number, number] = [QUILL_X, FLOOR - SIZE * 0.58];
const COOKIE: [number, number] = [330, 100];
const STAR: [number, number] = [400, 185];

mount({
  id: 'a-look-at-something',
  tag: 'Philosophy · Husserl',
  caption: 'A look always points at something.',
  seconds: 6.4,
  still: 4.7,
  draw(ctx, t) {
    // Cookie, then star, then nothing, then a remembered cookie that turns real again.
    const toStar = easeInOut(seg(t, 1.7, 2.1));
    const back = easeInOut(seg(t, 4.0, 4.5));
    const u = toStar * (1 - back);
    const bob = Math.sin(t * 2.5) * 4;
    const tx = lerp(COOKIE[0], STAR[0], u);
    const ty = lerp(COOKIE[1], STAR[1], u) + bob;
    const dx = tx - EYE[0];
    const dy = ty - EYE[1];
    const dist = Math.hypot(dx, dy);
    const puzzled = seg(t, 3.55, 3.7) * (1 - seg(t, 4.3, 4.5));

    dashed(
      ctx,
      EYE[0] + (dx / dist) * 45,
      EYE[1] + (dy / dist) * 45,
      tx - (dx / dist) * 26,
      ty - (dy / dist) * 26,
      t * 30,
    );

    const cookie = t < 1.7 ? 1 - easeInOut(seg(t, 1.5, 1.7)) : seg(t, 5.6, 6.2);
    icon(ctx, 'cookie', COOKIE[0], COOKIE[1] + bob, 1.4 * cookie);
    icon(
      ctx,
      'star',
      STAR[0],
      STAR[1] + bob,
      1.4 * easeBack(seg(t, 1.7, 1.95)) * (1 - easeInOut(seg(t, 3.3, 3.5))),
    );

    // The remembered cookie: a dashed outline where the cookie was.
    const memory = seg(t, 4.3, 4.6) * (1 - seg(t, 5.9, 6.2));
    if (memory > 0) {
      ctx.save();
      ctx.globalAlpha = memory;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(COOKIE[0], COOKIE[1] + bob, 17, 0, Math.PI * 2);
      ctx.strokeStyle = COLOR.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    drawQuill(
      ctx,
      {
        x: QUILL_X,
        y: FLOOR,
        size: SIZE,
        look: [(dx / dist) * 0.045, (-dy / dist) * 0.05],
        lean: 0.08 * Math.sign(dx) * (1 - puzzled) - 0.05 * puzzled,
        squash: -0.05 * memory,
        shell: { softness: 0.3 + 0.6 * memory, color: memory * 0.6 },
      },
      t,
    );
    bubble(ctx, QUILL_X + 70, 72, 'question', easeBack(seg(t, 3.55, 3.8)) * (1 - seg(t, 4.3, 4.45)), [
      QUILL_X + 44,
      100,
    ]);
  },
});
