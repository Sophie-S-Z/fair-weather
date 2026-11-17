// Making (creative autonomy): the goal can change while you make the thing.
import pim from '../../content/rigs/pim.rig.json';
import { bubble, COLOR, creature, easeBack, easeInOut, hops, seg, wobble } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawPim = creature(pim);
const PIM_X = 110;
const SIZE = 108;
const C: [number, number] = [335, 130];
const R = 62;
const DRAW_START = 0.7;
const DRAW_END = 3.4;
/** The point at u (0..1) along the drawing: a circle that wanders into five petals early on. */
function at(u: number): [number, number] {
  const a = u * Math.PI * 2 - Math.PI / 2;
  const petals = easeInOut(seg(u, 0.12, 0.3));
  const r = R * (0.8 + 0.42 * petals * Math.sin(10 * Math.PI * u));
  return [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r];
}

mount({
  id: 'new-plan',
  tag: 'Making · creative autonomy',
  caption: 'The plan was a circle. The line had a better idea.',
  seconds: 6.6,
  still: 4.2,
  draw(ctx, t) {
    const drawn = easeInOut(seg(t, DRAW_START, DRAW_END));
    const fade = 1 - seg(t, 5.7, 6.2);
    const surprise = DRAW_START + (DRAW_END - DRAW_START) * 0.25;
    const fill = seg(t, 3.5, 4.0) * fade;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.beginPath();
    const steps = Math.ceil(drawn * 160);
    for (let i = 0; i <= steps; i++) ctx.lineTo(...at(Math.min(i / 160, drawn)));
    if (fill > 0) {
      ctx.save();
      ctx.globalAlpha = fade * fill * 0.6;
      ctx.fillStyle = COLOR.blush;
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (fill > 0) {
      ctx.beginPath();
      ctx.arc(C[0], C[1], 12 * easeBack(fill), 0, Math.PI * 2);
      ctx.fillStyle = COLOR.glow;
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // The pencil tip, while it draws.
    const [px, py] = at(drawn);
    if (t > DRAW_START - 0.2 && t < DRAW_END + 0.3) {
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = COLOR.accent;
      ctx.fill();
      ctx.strokeStyle = COLOR.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Pim watches the pencil, gasps when it wanders, then hops for joy.
    const eyeY = FLOOR - SIZE * 0.6;
    const watch = t > DRAW_END + 0.3 ? C : [px, py];
    const dx = (watch[0] ?? 0) - PIM_X;
    const dy = (watch[1] ?? 0) - eyeY;
    const d = Math.hypot(dx, dy) || 1;
    const joy = hops(t, 3.6, 4.4, PIM_X, PIM_X, 2);
    const happy = seg(t, 3.6, 3.8) * (1 - seg(t, 5.8, 6.2));
    drawPim(
      ctx,
      {
        x: PIM_X,
        y: FLOOR - joy.lift * 1.5,
        size: SIZE,
        squash: joy.squash + wobble(t, surprise, 0.22),
        look: [(dx / d) * 0.045, (-dy / d) * 0.05],
        shell: { softness: 0.6 + 0.4 * happy, color: happy * 0.5 },
      },
      t,
    );

    const plan = t < 3.0 ? 'circle' : 'flower';
    const pop = easeBack(seg(t, 0.1, 0.35)) * (1 - seg(t, 5.8, 6.1));
    const swap = 1 - 0.25 * Math.sin(Math.PI * seg(t, 2.9, 3.1));
    bubble(ctx, PIM_X + 66, 62, plan, pop * swap, [PIM_X + 38, 98]);
  },
});
