// Meet Tove: nervous, and joins any crowd. Even a crowd of rocks.
import tove from '../../content/rigs/tove.rig.json';
import { bubble, COLOR, creature, easeBack, easeIn, hops, lerp, seg } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawTove = creature(tove);
/** The crowd: [x, width, height]. */
const ROCKS = [
  [300, 34, 26],
  [352, 44, 34],
  [410, 30, 22],
] as const;
const ROLL = 4.2;

mount({
  id: 'meet-tove',
  tag: 'Meet Tove · nervous',
  caption: 'Tove feels safe in any crowd.',
  seconds: 6.4,
  still: 3.0,
  draw(ctx, t) {
    // Alone, Tove shivers. With the rocks, Tove relaxes. When a rock rolls off, Tove follows it.
    const join = hops(t, 0.6, 1.5, 90, 238, 3);
    const follow = hops(t, ROLL + 0.4, 5.4, 238, 560, 4);
    const enter = hops(t, 5.6, 6.4, -60, 90, 2);
    const x = t < ROLL + 0.4 ? join.x : t < 5.6 ? follow.x : enter.x;
    const lift = join.lift + follow.lift + enter.lift;
    const calm = seg(t, 1.6, 2.0) * (1 - seg(t, ROLL, ROLL + 0.2));
    const nerves = 1 - calm;

    drawTove(
      ctx,
      {
        x,
        y: FLOOR - lift,
        size: 105,
        squash: join.squash + follow.squash + enter.squash,
        lean: Math.sin(t * 40) * 0.025 * nerves,
        look: [0.05 * (t > 1.0 ? 1 : 0), 0],
        shell: { tightness: 0.6 * nerves, softness: 0.3 + 0.7 * calm, color: 0.5 * calm },
      },
      t,
    );

    ROCKS.forEach(([rx, w, h], i) => {
      const away = i === 2 ? easeIn(seg(t, ROLL, ROLL + 1.0)) : 0;
      const back = i === 2 ? seg(t, 5.6, 6.3) : 0;
      const x0 = t < 5.6 ? lerp(rx, 560, away) : lerp(560, rx, back);
      ctx.save();
      ctx.translate(x0, FLOOR - h / 2);
      ctx.rotate((x0 - rx) / 15);
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#c9c4ba';
      ctx.fill();
      ctx.strokeStyle = COLOR.ink;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.restore();
    });

    bubble(ctx, 300, 92, 'heart', easeBack(seg(t, 2.0, 2.25)) * (1 - seg(t, 3.8, 4.0)), [270, 128]);
  },
});
