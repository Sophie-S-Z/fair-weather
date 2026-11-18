// Meet Drift: generous and dreamy. Drift rains on a dry bud, and each drop it gives makes it lighter.
import { arc, COLOR, easeBack, easeIn, easeInOut, easeOut, icon, lerp, seg, wobble } from '../kit/draw.ts';
import { drawDrift } from '../kit/friends.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const BUD_X = 236;
const SKY = FLOOR - 96;
/** When each raindrop leaves Drift. */
const DROPS = [2.0, 2.2, 2.4] as const;
const FALL = 0.45;

function drop(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - 12);
  ctx.bezierCurveTo(x + 8, y - 2, x + 8, y + 7, x, y + 7);
  ctx.bezierCurveTo(x - 8, y + 7, x - 8, y - 2, x, y - 12);
  ctx.fillStyle = COLOR.water;
  ctx.fill();
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** A stem with two leaves; `open` grows it and swaps the bud for a flower. */
function bud(ctx: CanvasRenderingContext2D, open: number): void {
  const top = FLOOR - lerp(22, 36, open);
  ctx.beginPath();
  ctx.moveTo(BUD_X, FLOOR);
  ctx.lineTo(BUD_X, top);
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(BUD_X + side * 7, FLOOR - 9, 7, 3.5, side * -0.5, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.leaf;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (open > 0) icon(ctx, 'flower', BUD_X, top, open);
  else {
    ctx.beginPath();
    ctx.ellipse(BUD_X, top - 4, 4.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.leaf;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

mount({
  id: 'meet-drift',
  tag: 'Meet Drift · generous',
  caption: 'Drift gives its rain away, and floats a bit higher.',
  seconds: 6,
  still: 3.1,
  draw(ctx, t) {
    // Drift floats in, squeezes out three drops over the bud, and floats off lighter.
    const x = t < 1.6 ? lerp(-96, BUD_X, easeOut(seg(t, 0, 1.6))) : lerp(BUD_X, 580, easeIn(seg(t, 3.4, 6)));
    const light = easeInOut(seg(t, 2.2, 3.0));
    const squeeze = arc(seg(t, 1.9, 2.6)) * 0.14 + wobble(t, 2.6, 0.12);
    const happy = seg(t, 2.8, 3.1);

    bud(ctx, easeBack(seg(t, 2.85, 3.15)) * (1 - easeInOut(seg(t, 5.3, 5.8))));

    for (const t0 of DROPS) {
      const u = seg(t, t0, t0 + FALL);
      if (u > 0 && u < 1) drop(ctx, BUD_X + (t0 - 2.2) * 60, lerp(SKY + 4, FLOOR - 30, easeIn(u)));
    }

    drawDrift(
      ctx,
      {
        x,
        y: SKY - 18 * light + Math.sin(Math.PI * t) * 4,
        size: lerp(104, 92, light),
        squash: squeeze,
        look: t > 1.2 && t < 2.9 ? [0, -0.06] : [0.04, 0],
        blink: arc(seg(t, 3.2, 3.45)),
        shell: { color: 0.2 + 0.6 * happy },
      },
      t,
    );
  },
});
