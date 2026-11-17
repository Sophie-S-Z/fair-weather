// Networks: a rumor changes a little at each step of the chain.
import echo from '../../content/rigs/echo.rig.json';
import kite from '../../content/rigs/kite.rig.json';
import quill from '../../content/rigs/quill.rig.json';
import toadstool from '../../content/rigs/toadstool.rig.json';
import {
  alongYarn,
  bubble,
  creature,
  easeBack,
  easeInOut,
  icon,
  seg,
  wobble,
  yarn,
  type Icon,
} from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

/** The chain: who stands where, and what they think they heard. */
const CHAIN: readonly { draw: ReturnType<typeof creature>; x: number; heard: Icon }[] = [
  { draw: creature(kite), x: 75, heard: 'cookie' },
  { draw: creature(echo), x: 185, heard: 'crown' },
  { draw: creature(quill), x: 295, heard: 'storm' },
  { draw: creature(toadstool), x: 405, heard: 'monster' },
];
const KNOT = FLOOR - 36;
const SAG = 12;
/** When the message leaves each creature. */
const SEND = [0.7, 2.0, 3.3];
const TRIP = 0.7;
/** When each creature's bubble pops up. */
const heardAt = (i: number): number => (i === 0 ? 0.2 : (SEND[i - 1] ?? 0) + TRIP);

mount({
  id: 'telephone',
  tag: 'Networks · telephone',
  caption: 'It started as a cookie.',
  seconds: 7,
  still: 5.2,
  draw(ctx, t) {
    for (let i = 0; i + 1 < CHAIN.length; i++) {
      yarn(ctx, (CHAIN[i]?.x ?? 0) + 22, KNOT, (CHAIN[i + 1]?.x ?? 0) - 22, KNOT, SAG);
    }

    const fright = seg(t, 4.75, 4.9) * (1 - seg(t, 6.0, 6.4));
    const clear = 1 - seg(t, 6.2, 6.6);
    CHAIN.forEach((c, i) => {
      const got = heardAt(i);
      const last = i === CHAIN.length - 1;
      const jump = last ? Math.max(0, Math.sin(Math.PI * seg(t, 4.75, 5.2))) * 26 : 0;
      // Everyone turns to the scream at the end; before that they face the message.
      const toward = t > 4.8 && !last ? 0.04 : i === 0 ? 0.04 : -0.04;
      c.draw(
        ctx,
        {
          x: c.x,
          y: FLOOR - jump,
          size: 90,
          squash: wobble(t, got, 0.18) + (last ? -0.15 * fright : 0),
          look: [toward, 0],
          shell: last ? { tightness: fright, bristle: fright * 0.8 } : {},
        },
        t,
      );
      bubble(ctx, c.x + 14, 82, c.heard, easeBack(seg(t, got, got + 0.25)) * clear, [c.x + 2, 116]);
    });

    // The message rides the yarn from one creature to the next.
    SEND.forEach((start, i) => {
      const u = seg(t, start, start + TRIP);
      if (u <= 0 || u >= 1) return;
      const a = CHAIN[i];
      const b = CHAIN[i + 1];
      if (!a || !b) return;
      const [x, y] = alongYarn(a.x + 22, KNOT, b.x - 22, KNOT, SAG, easeInOut(u));
      icon(ctx, a.heard, x, y - 12, 0.6);
    });
  },
});
