// Meet Krit: grabby and bold. Krit stacks cookies on its head until the tower falls.
import krit from '../../content/rigs/krit.rig.json';
import { bubble, creature, easeBack, easeIn, icon, seg, wobble } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawKrit = creature(krit);
const X = 240;
const SIZE = 112;
const HEAD = FLOOR - SIZE * 0.9;
/** When each cookie lands on the stack. The last one is one too many. */
const DROPS = [0.4, 1.0, 1.6, 2.2, 2.8];
const FALL = 3.0;

mount({
  id: 'meet-krit',
  tag: 'Meet Krit · grabby',
  caption: 'Krit always wants one more.',
  seconds: 5.4,
  still: 2.5,
  draw(ctx, t) {
    const landed = DROPS.filter((d) => t >= d).length;
    const stacked = t < FALL ? landed : 0;
    const sway = Math.sin(t * 5) * 0.035 * stacked;
    const sulk = seg(t, 3.4, 3.6) * (1 - seg(t, 4.8, 5.1));
    const squash = DROPS.reduce((s, d) => s + wobble(t, d, 0.08), 0) + wobble(t, FALL, 0.2);

    drawKrit(
      ctx,
      {
        x: X,
        y: FLOOR,
        size: SIZE,
        squash,
        lean: sway * 0.6,
        look: sulk > 0 ? [0, -0.04] : [0, 0.07],
        shell: { bristle: 0.25 + 0.15 * stacked + 0.6 * sulk, tightness: 0.2 * sulk },
      },
      t,
    );

    // The tower sways from the top of Krit's head.
    ctx.save();
    ctx.translate(X, HEAD);
    ctx.rotate(sway);
    for (let i = 0; i < stacked; i++) icon(ctx, 'cookie', 0, -14 - i * 22, 1.15);
    ctx.restore();

    // The next cookie drops in from the sky.
    const next = DROPS.find((d) => t < d && t > d - 0.4);
    if (next !== undefined && t < FALL) {
      const u = easeIn(seg(t, next - 0.4, next));
      icon(ctx, 'cookie', X, -20 + (HEAD - 14 - landed * 22 + 20) * u, 1.15);
    }

    // Too many: the cookies tumble off to the right.
    const fall = seg(t, FALL, FALL + 0.9);
    if (fall > 0 && fall < 1) {
      DROPS.forEach((_, i) => {
        ctx.save();
        ctx.translate(X + fall * (90 + 40 * i), HEAD - 14 - i * 22 + 500 * fall * fall - 120 * fall);
        ctx.rotate(fall * (4 + i));
        icon(ctx, 'cookie', 0, 0, 1.15);
        ctx.restore();
      });
    }

    bubble(ctx, X + 75, 80, 'storm', easeBack(seg(t, 3.5, 3.75)) * (1 - seg(t, 4.7, 4.9)), [X + 45, 115]);
  },
});
