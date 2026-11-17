// Meet Quill: thinks too hard. Each question makes more questions, until one idea clears them all.
import quill from '../../content/rigs/quill.rig.json';
import { bubble, creature, easeBack, seg } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawQuill = creature(quill);
const X = 200;
/** Each question: where it floats and when it pops up. */
const QUESTIONS = [
  [270, 92, 0.3],
  [200, 62, 1.1],
  [335, 70, 1.3],
  [150, 110, 1.9],
  [255, 40, 2.0],
  [395, 110, 2.15],
  [320, 140, 2.3],
] as const;
const IDEA = 3.1;

mount({
  id: 'meet-quill',
  tag: 'Meet Quill · thinks too hard',
  caption: 'Every answer brings a new question.',
  seconds: 6,
  still: 2.6,
  draw(ctx, t) {
    const count = QUESTIONS.filter(([, , at]) => t > at && t < IDEA).length;
    const heavy = Math.min(1, count / QUESTIONS.length);
    const relief = seg(t, IDEA, IDEA + 0.2) * (1 - seg(t, 4.6, 5.0));

    drawQuill(
      ctx,
      {
        x: X,
        y: FLOOR,
        size: 115,
        squash: 0.18 * heavy - 0.08 * relief,
        lean: Math.sin(t * 7) * 0.02 * heavy,
        look: [0.03, 0.06],
        shell: { tightness: 0.4 * heavy, softness: 0.3 + 0.6 * relief, color: relief * 0.5 },
      },
      t,
    );

    for (const [x, y, at] of QUESTIONS) {
      const s = easeBack(seg(t, at, at + 0.2)) * (1 - seg(t, IDEA, IDEA + 0.12));
      bubble(ctx, x, y, 'question', s * 0.85, [x - 10, y + 30]);
    }
    bubble(
      ctx,
      320,
      70,
      'star',
      1.3 * easeBack(seg(t, IDEA, IDEA + 0.3)) * (1 - seg(t, 5.0, 5.3)),
      [282, 110],
    );
    // ...and then a new question.
    bubble(ctx, 330, 50, 'question', 0.85 * easeBack(seg(t, 4.5, 4.7)) * (1 - seg(t, 5.7, 5.95)), [320, 80]);
  },
});
