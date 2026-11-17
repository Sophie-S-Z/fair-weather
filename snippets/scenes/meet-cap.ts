// Meet Cap: loud and popular. One shout, and a party sprouts up around it.
import toadstool from '../../content/rigs/toadstool.rig.json';
import { bubble, COLOR, creature, easeBack, easeOut, seg, wobble } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawCap = creature(toadstool);
const X = 240;
const SHOUT = 0.9;
/** The little guests: [x, size, when they pop up]. */
const SPROUTS = [
  [95, 1, 1.2],
  [390, 1.2, 1.35],
  [150, 0.8, 1.5],
  [335, 0.9, 1.65],
] as const;
const BEAT = 0.5;

function sprout(ctx: CanvasRenderingContext2D, x: number, s: number, hop: number): void {
  const y = FLOOR - hop;
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(x - 6 * s, y - 22 * s, 12 * s, 22 * s, 4 * s);
  ctx.fillStyle = COLOR.paper;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y - 22 * s, 18 * s, 13 * s, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = COLOR.berry;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLOR.ink;
  for (const dx of [-2.5, 2.5]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y - 12 * s, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

mount({
  id: 'meet-cap',
  tag: 'Meet Cap · loud',
  caption: 'Cap is the life of the party.',
  seconds: 5,
  still: 2.6,
  draw(ctx, t) {
    const windUp = seg(t, 0.4, SHOUT);
    const party = seg(t, 1.9, 2.0) * (1 - seg(t, 4.0, 4.1));
    const beat = Math.abs(Math.sin((Math.PI * (t - 2)) / BEAT)) * party;

    // Spores puff out with the shout.
    const puff = easeOut(seg(t, SHOUT, SHOUT + 0.9));
    if (puff > 0 && puff < 1) {
      ctx.fillStyle = COLOR.accent;
      ctx.globalAlpha = 1 - puff;
      for (let k = 0; k < 14; k++) {
        const a = Math.PI + (k / 13) * Math.PI;
        ctx.beginPath();
        ctx.arc(X + Math.cos(a) * 140 * puff, FLOOR - 90 + Math.sin(a) * 110 * puff, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    for (const [x, s, at] of SPROUTS) {
      const grow = easeBack(seg(t, at, at + 0.3)) * (1 - seg(t, 4.2, 4.6));
      if (grow > 0) sprout(ctx, x, s * grow, beat * 12);
    }

    drawCap(
      ctx,
      {
        x: X,
        y: FLOOR - beat * 14,
        size: 100,
        squash:
          0.16 * windUp * (t < SHOUT ? 1 : 0) -
          0.18 * seg(t, SHOUT, SHOUT + 0.05) * (1 - seg(t, 1.3, 1.6)) +
          wobble(t, 1.6, 0.15) +
          (beat > 0.9 ? 0.05 : 0),
        look: [0, 0.02],
        shell: { softness: 0.5 + 0.5 * party, color: party * 0.4 },
      },
      t,
    );
    bubble(ctx, X + 80, 66, 'bang', easeBack(seg(t, SHOUT, SHOUT + 0.2)) * (1 - seg(t, 1.6, 1.8)), [
      X + 52,
      100,
    ]);
  },
});
