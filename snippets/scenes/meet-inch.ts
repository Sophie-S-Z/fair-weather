// Meet Inch: slow, and in no hurry. A whole day goes by, and Inch moves a little.
import snail from '../../content/rigs/snail.rig.json';
import { COLOR, creature, seg } from '../kit/draw.ts';
import { FLOOR, mount, WIDTH } from '../kit/stage.ts';

const drawInch = creature(snail);
const SECONDS = 7;
/** Grass tufts slide past by one gap each day, so the loop joins. */
const GAP = 60;
const NIGHT = '#283353';

/** The sun or the moon on its arc across the sky; it starts at phase 0 and sets at phase 0.55. */
function orb(ctx: CanvasRenderingContext2D, color: string, phase: number): void {
  const u = phase / 0.55;
  if (u < 0 || u > 1) return;
  ctx.beginPath();
  ctx.arc(30 + u * (WIDTH - 60), FLOOR - 40 - Math.sin(Math.PI * u) * 170, 18, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
}

mount({
  id: 'meet-inch',
  tag: 'Meet Inch · slow',
  caption: 'Inch made great progress today.',
  seconds: SECONDS,
  still: 2.0,
  draw(ctx, t) {
    const day = t / SECONDS;
    const dark = Math.max(0, Math.sin(Math.PI * 2 * (day - 0.45))) ** 0.7;

    // The sun crosses in the first half of the day, the moon in the second, over the night sky.
    orb(ctx, COLOR.glow, day + 0.05);
    ctx.globalAlpha = 0.55 * dark;
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, WIDTH, FLOOR + 80);
    ctx.globalAlpha = dark;
    ctx.fillStyle = COLOR.paper;
    for (const [sx, sy] of [
      [60, 50],
      [140, 90],
      [230, 40],
      [320, 75],
      [410, 45],
      [450, 120],
    ] as const) {
      ctx.beginPath();
      ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    orb(ctx, COLOR.paper, day - 0.45);

    // Tufts slide right as Inch creeps left.
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let x = -GAP + ((day * GAP) % GAP); x < WIDTH + GAP; x += GAP) {
      ctx.beginPath();
      ctx.moveTo(x - 5, FLOOR);
      ctx.lineTo(x - 7, FLOOR - 9);
      ctx.moveTo(x, FLOOR);
      ctx.lineTo(x, FLOOR - 12);
      ctx.moveTo(x + 5, FLOOR);
      ctx.lineTo(x + 7, FLOOR - 8);
      ctx.stroke();
    }

    // Inch stretches forward and pulls up, over and over, asleep at night.
    const step = Math.sin(t * Math.PI * 2 * (6 / SECONDS));
    const asleep = seg(dark, 0.5, 0.9);
    drawInch(
      ctx,
      {
        x: 250,
        y: FLOOR,
        size: 92,
        squash: -0.05 * step * (1 - asleep) + 0.06 * asleep,
        lean: -0.06 * step * (1 - asleep),
        blink: asleep,
        look: [-0.03, 0],
      },
      t,
    );
  },
});
