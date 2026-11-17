// Psychology: conformity. One creature looks up, so the next one does too, and the next.
import bell from '../../content/rigs/bell.rig.json';
import kite from '../../content/rigs/kite.rig.json';
import moss from '../../content/rigs/moss.rig.json';
import tove from '../../content/rigs/tove.rig.json';
import { bubble, creature, easeBack, easeInOut, hops, seg, wobble } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawMoss = creature(moss);
/** Each joiner: how it draws, where it stops, and when it hops in. */
const JOINERS = [
  { draw: creature(tove), x: 215, at: 0.5 },
  { draw: creature(bell), x: 310, at: 1.7 },
  { draw: creature(kite), x: 405, at: 2.9 },
] as const;
const UP: [number, number] = [0.01, 0.1];

mount({
  id: 'look-up',
  tag: 'Psychology · conformity',
  caption: 'Nobody knows what is up there.',
  seconds: 7,
  still: 4.6,
  draw(ctx, t) {
    // Everyone stretches to see better, then Moss (who started it) nods off.
    const peer = easeInOut(seg(t, 4.1, 4.5)) * (1 - easeInOut(seg(t, 6.1, 6.5)));
    const doze = seg(t, 5.1, 5.5) * (1 - seg(t, 6.5, 6.8));
    drawMoss(
      ctx,
      {
        x: 92,
        y: FLOOR,
        size: 92,
        look: [UP[0], UP[1] * (1 - doze)],
        blink: doze,
        squash: -0.06 - peer * 0.06 + doze * 0.08,
      },
      t,
    );

    for (const j of JOINERS) {
      const walk = hops(t, j.at, j.at + 0.9, 540, j.x, 3);
      const glance = seg(t, j.at + 0.9, j.at + 1.05);
      const up = easeInOut(seg(t, j.at + 1.3, j.at + 1.5));
      const look: [number, number] = [-0.05 * glance * (1 - up) + UP[0] * up, UP[1] * up];
      j.draw(
        ctx,
        {
          x: walk.x,
          y: FLOOR - walk.lift,
          size: 100,
          squash: walk.squash - peer * 0.1 + wobble(t, j.at + 0.9, 0.12),
          look,
          alpha: 1 - seg(t, 6.4, 6.9),
        },
        t,
      );
    }

    // Kite, last in, wonders what they are all looking at.
    const ask = easeBack(seg(t, 4.6, 4.85)) * (1 - seg(t, 5.9, 6.1));
    bubble(ctx, 440, 74, 'question', ask, [420, 108]);
  },
});
