// Meet Hush: shy. Hush hides when you look, then peeks out again to say hi.
import { bubble, COLOR, easeBack, easeIn, easeInOut, seg, wobble } from '../kit/draw.ts';
import { drawHush } from '../kit/friends.ts';
import { FLOOR, mount, WIDTH } from '../kit/stage.ts';

const X = 240;
const HIDDEN = FLOOR + 60;
const PEEK = FLOOR - 16;
const DUCK = 2.0;
/** The bush: [x offset, y offset, radius] of each round clump. */
const CLUMPS = [
  [-60, -17, 17],
  [-34, -30, 22],
  [0, -36, 24],
  [34, -30, 22],
  [60, -17, 17],
  [-22, -14, 14],
  [22, -14, 14],
] as const;

/** The bush in front of Hush. Strokes first, then fills, so only the outside edge shows. The floor line closes the bottom. */
function bush(ctx: CanvasRenderingContext2D, shake: number): void {
  for (const pass of ['stroke', 'fill'] as const) {
    if (pass === 'fill') {
      ctx.fillStyle = COLOR.leaf;
      ctx.fillRect(X - 60, FLOOR - 18, 120, 18);
    }
    CLUMPS.forEach(([dx, dy, r], i) => {
      ctx.beginPath();
      ctx.arc(X + dx + shake * (i % 2 ? 1 : -1) * 4, FLOOR + dy, r, 0, Math.PI * 2);
      if (pass === 'stroke') {
        ctx.lineWidth = 4.4;
        ctx.strokeStyle = COLOR.ink;
        ctx.stroke();
      } else {
        ctx.fillStyle = COLOR.leaf;
        ctx.fill();
      }
    });
  }
}

mount({
  id: 'meet-hush',
  tag: 'Meet Hush · shy',
  caption: 'Hush is shy, but it always says hi.',
  seconds: 5.6,
  still: 3.9,
  draw(ctx, t) {
    // Up slowly, sees you, blushes, ducks. Up again, braver, and says hi. Then back down.
    const y =
      t < DUCK
        ? HIDDEN + (PEEK - HIDDEN) * easeInOut(seg(t, 0.8, 1.5))
        : t < 2.6
          ? PEEK + (HIDDEN - PEEK) * easeIn(seg(t, DUCK, DUCK + 0.25))
          : HIDDEN + (PEEK - HIDDEN) * easeInOut(seg(t, 2.7, 3.5)) * (1 - easeInOut(seg(t, 4.6, 5.2)));
    const blush = seg(t, 1.75, 1.95) * (1 - seg(t, 5.0, 5.4));
    const sees = t > 1.6 && t < 4.8;

    // Hush stays behind the floor line.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, FLOOR);
    ctx.clip();
    drawHush(
      ctx,
      {
        x: X,
        y,
        size: 100,
        squash: wobble(t, DUCK + 0.25, 0.15),
        look: sees ? [0, -0.01] : [-0.07, 0],
        blink: t > DUCK - 0.1 && t < 2.6 ? 1 : 0,
        shell: { color: 0.2 + 0.8 * blush, tightness: t > DUCK && t < 3.2 ? 0.3 : 0 },
      },
      t,
    );
    ctx.restore();

    bush(ctx, t > DUCK ? wobble(t, DUCK + 0.2, 1) : 0);
    bubble(ctx, X + 70, 70, 'heart', easeBack(seg(t, 3.5, 3.75)) * (1 - seg(t, 4.5, 4.7)), [X + 34, 104]);
  },
});
