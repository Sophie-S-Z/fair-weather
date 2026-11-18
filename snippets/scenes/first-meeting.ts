// First meeting: curious Nib finds shy Hush in a bush. Nib looks too close, and they scare each
// other. Then Nib leaves its flower as a gift and steps back, and Hush comes out to take it.
import {
  arc,
  bubble,
  bush,
  easeBack,
  easeIn,
  easeInOut,
  easeOut,
  hops,
  icon,
  lerp,
  seg,
  wobble,
  type Pose,
} from '../kit/draw.ts';
import { drawHush, drawNib } from '../kit/friends.ts';
import { FLOOR, mount, WIDTH } from '../kit/stage.ts';

const SECONDS = 14.5;
const NIB_SIZE = 92;
const HUSH_SIZE = 96;
const BUSH_X = 330;
/** Where Nib waits, and where Nib leans in to look. */
const WAIT_X = 160;
const NEAR_X = 225;
/** Where the gift lands, and where Hush sits to take it. */
const GIFT_X = 246;
const SIT_X = 262;
const HIDDEN = FLOOR + 60;
const PEEK = FLOOR - 16;
const OVER = FLOOR - 80;
const STARTLE = 4.45;

type Step = { x: number; lift: number; squash: number };

/** The top of a creature's head for a pose, where the flower sits. */
const headTop = (p: Pose, size: number, top: number): [number, number] => [
  p.x + (p.lean ?? 0) * top * size,
  p.y - top * size * (1 - (p.squash ?? 0)),
];

/** Nib's walk: in from the left, up to the bush, back in a fright, over with the gift, and off to the right. */
function nibStep(t: number): Step {
  if (t < 2.0) return hops(t, 0, 2.0, -60, WAIT_X - 10, 4);
  if (t < STARTLE) return hops(t, 3.0, 3.5, WAIT_X - 10, NEAR_X, 2);
  if (t < 6.0) return hops(t, STARTLE + 0.05, STARTLE + 0.45, NEAR_X, WAIT_X, 1);
  if (t < 7.0) return hops(t, 6.0, 6.4, WAIT_X, NEAR_X + 10, 1);
  if (t < 9.9) return hops(t, 7.0, 7.4, NEAR_X + 10, WAIT_X, 1);
  if (t < 13.0) return hops(t, 9.9, 10.5, WAIT_X, WAIT_X, 2);
  return hops(t, 13.0, SECONDS, WAIT_X, 560, 6);
}

/** Hush's place, and whether it is in front of the bush. */
function hushAt(t: number): { x: number; y: number; front: boolean } {
  const up = (a: number, b: number, from: number, to: number): number =>
    lerp(from, to, easeInOut(seg(t, a, b)));
  if (t < 4.6) return { x: BUSH_X, y: lerp(HIDDEN, PEEK, easeOut(seg(t, 4.2, STARTLE))), front: false };
  if (t < 7.2) return { x: BUSH_X, y: lerp(PEEK, HIDDEN, easeIn(seg(t, 4.6, 4.8))), front: false };
  if (t < 9.0)
    return { x: BUSH_X, y: t < 8.4 ? up(7.2, 8.0, HIDDEN, PEEK) : up(8.4, 9.0, PEEK, OVER), front: false };
  if (t < 11.6) {
    // Out over the top of the bush, down beside the gift, and back up again.
    const out = easeInOut(seg(t, 9.0, 9.6));
    const back = easeInOut(seg(t, 11.0, 11.6));
    const bob = Math.sin((t - 9.6) * Math.PI * 2) * 2 * seg(t, 9.6, 9.8) * (1 - seg(t, 10.8, 11.0));
    return {
      x: lerp(lerp(BUSH_X, SIT_X, out), BUSH_X, back),
      y: lerp(lerp(OVER, FLOOR - 4, out), OVER, back) - arc(out) * 12 - arc(back) * 12 + bob,
      front: true,
    };
  }
  if (t < 12.2) return { x: BUSH_X, y: up(11.6, 12.2, OVER, HIDDEN), front: false };
  // One last peek, to say goodbye.
  return {
    x: BUSH_X,
    y: up(12.3, 12.8, HIDDEN, PEEK) + (PEEK - HIDDEN) * -easeInOut(seg(t, 13.6, 14.2)),
    front: false,
  };
}

mount({
  id: 'first-meeting',
  tag: 'First meeting · Nib and Hush',
  caption: 'Nib is curious. Hush is shy. A small gift helps.',
  seconds: SECONDS,
  still: 10.4,
  draw(ctx, t) {
    const step = nibStep(t);
    const near = easeInOut(seg(t, 3.6, 4.2)) * (1 - easeOut(seg(t, STARTLE, STARTLE + 0.2)));
    const bow = arc(seg(t, 6.4, 6.9));
    const glad = seg(t, 9.9, 10.2) * (1 - seg(t, 12.4, 13.0));
    const scan = Math.sin(seg(t, 2.0, 2.8) * Math.PI * 2) * 0.06;
    const nib: Pose = {
      x: step.x,
      y: FLOOR - step.lift,
      size: NIB_SIZE,
      lean: 0.3 * near + 0.18 * bow,
      squash: step.squash - 0.06 * near + 0.12 * bow + wobble(t, STARTLE, 0.25),
      look: t < 2.0 ? [0.05, 0] : t < 2.8 ? [scan, 0] : t < 13.0 ? [0.06, 0.01] : [0.05, 0],
      blink: arc(seg(t, 7.6, 7.8)) + arc(seg(t, STARTLE, STARTLE + 0.15)),
      shell: {
        color: 0.2 + 0.6 * glad,
        tightness: 0.4 * seg(t, STARTLE, STARTLE + 0.1) * (1 - seg(t, 5.0, 5.4)),
      },
    };

    const h = hushAt(t);
    const shy = seg(t, 7.9, 8.2) * (1 - seg(t, 14.0, 14.3));
    const hush: Pose = {
      x: h.x,
      y: h.y,
      size: HUSH_SIZE,
      look: h.front ? [-0.05, -0.01] : [-0.06, 0],
      blink: t > STARTLE + 0.1 && t < 5.2 ? 1 : 0,
      squash: wobble(t, 4.8, 0.15) + wobble(t, 9.6, 0.12),
      shell: { color: 0.2 + 0.8 * Math.max(shy, seg(t, STARTLE, STARTLE + 0.1) * (1 - seg(t, 5.2, 5.6))) },
    };

    // The gift: on Nib's head, then on the floor, then on Hush's head.
    const nibHead = headTop(nib, NIB_SIZE, 0.8);
    const hushHead = headTop(hush, HUSH_SIZE, 0.97);
    const drop = seg(t, 6.6, 6.9);
    const take = easeInOut(seg(t, 9.8, 10.1));
    const gift = (on: [number, number] | null): void => {
      if (t < 6.6) icon(ctx, 'flower', nibHead[0], nibHead[1], 0.75);
      else if (t < 9.8) {
        if (on) return;
        icon(
          ctx,
          'flower',
          lerp(nibHead[0], GIFT_X, drop),
          lerp(nibHead[1], FLOOR - 9, drop) - arc(drop) * 24,
          0.75,
        );
      } else if (on)
        icon(ctx, 'flower', lerp(GIFT_X, on[0], take), lerp(FLOOR - 9, on[1], take) - arc(take) * 20, 0.75);
    };

    const drawHushAndGift = (): void => {
      drawHush(ctx, hush, t);
      if (t >= 9.8) gift(hushHead);
    };

    if (h.front) bush(ctx, BUSH_X, FLOOR);
    else {
      // Behind the bush, Hush stays above the floor line.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, WIDTH, FLOOR);
      ctx.clip();
      drawHushAndGift();
      ctx.restore();
      bush(ctx, BUSH_X, FLOOR, wobble(t, 4.85, 1) + wobble(t, 12.2, 0.6));
    }
    if (t >= 6.6 && t < 9.8) gift(null);
    if (h.front) drawHushAndGift();

    drawNib(ctx, nib, t);
    if (t < 6.6) gift(nibHead);

    const pop = (a: number, b: number): number => easeBack(seg(t, a, a + 0.25)) * (1 - seg(t, b - 0.2, b));
    bubble(ctx, WAIT_X - 40, 96, 'question', pop(2.8, 3.6), [WAIT_X - 14, 134]);
    bubble(ctx, NEAR_X - 50, 92, 'bang', pop(STARTLE + 0.05, 5.2), [NEAR_X - 22, 130]);
    bubble(ctx, BUSH_X + 70, 104, 'bang', pop(STARTLE + 0.05, 5.0), [BUSH_X + 34, 150]);
    bubble(ctx, WAIT_X - 40, 96, 'flower', pop(5.3, 6.0), [WAIT_X - 14, 134]);
    bubble(ctx, WAIT_X - 46, 92, 'heart', pop(10.1, 11.0), [WAIT_X - 18, 130]);
    bubble(ctx, SIT_X + 66, 74, 'heart', pop(10.3, 11.0), [SIT_X + 34, 112]);
    bubble(ctx, BUSH_X + 70, 104, 'heart', pop(12.5, 13.3), [BUSH_X + 34, 150]);
  },
});
