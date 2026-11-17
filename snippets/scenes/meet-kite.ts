// Meet Kite: a gossip. The news never stops, and each piece floats off to tell someone else.
import kite from '../../content/rigs/kite.rig.json';
import { bubble, creature, easeBack, easeOut, seg, type Icon } from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawKite = creature(kite);
const X = 190;
const SECONDS = 6;
/** Each piece of news and when Kite says it. Kite talks faster and faster. */
const NEWS: readonly (readonly [Icon, number])[] = [
  ['heart', 0.2],
  ['crown', 1.6],
  ['cookie', 2.6],
  ['storm', 3.3],
  ['star', 3.8],
  ['monster', 4.2],
];

mount({
  id: 'meet-kite',
  tag: 'Meet Kite · gossip',
  caption: 'Kite has news. Kite always has news.',
  seconds: SECONDS,
  still: 4.3,
  draw(ctx, t) {
    const talk = NEWS.reduce(
      (s, [, at]) => s + Math.max(0, Math.sin(Math.PI * seg(t, at - 0.15, at + 0.15))),
      0,
    );
    const hush = seg(t, 4.9, 5.1) * (1 - seg(t, 5.6, 5.9));

    drawKite(
      ctx,
      {
        x: X,
        y: FLOOR,
        size: 115,
        flip: true,
        squash: -0.1 * talk + 0.06 * hush,
        lean: 0.08 * talk,
        look: [0.04, 0.01],
        shell: { color: 0.3 * talk, softness: 0.3 + 0.4 * hush },
        blink: hush,
      },
      t,
    );

    // Each bubble pops out, then drifts up and away to tell someone else.
    for (const [name, at] of NEWS) {
      const u = easeOut(seg(t, at + 0.4, at + 2.2));
      if (t < at || u >= 1) continue;
      const x = X + 70 + 160 * u;
      const y = 92 - 120 * u + Math.sin(u * 8) * 6;
      bubble(ctx, x, y, name, easeBack(seg(t, at, at + 0.2)) * (1 - u * 0.5), [x - 26 + 26 * u, y + 34]);
    }
  },
});
