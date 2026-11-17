// Game theory: the prisoner's dilemma. Both grab the cookie, so nobody gets any.
import krit from '../../content/rigs/krit.rig.json';
import pim from '../../content/rigs/pim.rig.json';
import {
  bubble,
  creature,
  easeBack,
  easeIn,
  easeInOut,
  easeOut,
  icon,
  lerp,
  seg,
  wobble,
} from '../kit/draw.ts';
import { FLOOR, mount } from '../kit/stage.ts';

const drawPim = creature(pim);
const drawKrit = creature(krit);

const CX = 240;
const CY = FLOOR - 13;
const BURST = 1.55;
const GRAVITY = 900;
/** Each crumb's launch speed (x, y) and size. */
const CRUMBS = [
  [-150, -330, 4],
  [-60, -420, 3],
  [-20, -280, 2.5],
  [25, -380, 3.5],
  [70, -300, 3],
  [140, -360, 2.5],
  [-110, -220, 2],
  [10, -460, 2],
  [180, -250, 3],
] as const;

/** Where a crumb rests after it lands. */
function landing(vx: number, vy: number): [number, number, number] {
  const tl = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * 11)) / GRAVITY;
  return [CX + vx * tl, FLOOR - 2, tl];
}

function crumbs(ctx: CanvasRenderingContext2D, t: number): void {
  const back = easeInOut(seg(t, 3.5, 4.0));
  if (t >= 4) return;
  for (const [vx, vy, r] of CRUMBS) {
    const [lx, ly, tl] = landing(vx, vy);
    const s = Math.min(t - BURST, tl);
    let x = CX + vx * s;
    let y = CY + vy * s + 0.5 * GRAVITY * s * s;
    if (t >= 3.5) [x, y] = [lerp(lx, CX, back), lerp(ly, CY, back) - 40 * Math.sin(Math.PI * back)];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r / 6, r / 6);
    icon(ctx, 'cookie', 0, 0, 0.5);
    ctx.restore();
  }
}

mount({
  id: 'cookie-standoff',
  tag: 'Game theory · the cookie standoff',
  caption: 'Both grab. Nobody eats.',
  seconds: 4.6,
  still: 2.7,
  draw(ctx, t) {
    // Wind up, lunge, bounce off, glare, then the crumbs fly home.
    const wind = easeInOut(seg(t, 0.8, 1.3));
    const lunge = easeIn(seg(t, 1.3, BURST));
    const recoil = easeOut(seg(t, BURST, 1.95));
    const home = easeInOut(seg(t, 3.9, 4.5));
    const reach = lunge * (1 - recoil) * 52 + recoil * (1 - home) * 22;
    const squash = wind * 0.14 * (1 - lunge) - lunge * (1 - recoil) * 0.16 + wobble(t, BURST, 0.2);
    const lean = (-wind * 0.12 + lunge * 0.4) * (1 - recoil);
    const glare = seg(t, 2.1, 2.3) * (1 - seg(t, 3.3, 3.5));
    const down = t > 1.9 && (t < 2.1 || t > 3.3) && t < 4.2;
    const look = (dir: number): [number, number] =>
      glare > 0.5
        ? [0.04 * dir, 0]
        : down
          ? [0.02 * dir, -0.05]
          : t > 0.5
            ? [0.03 * dir, -0.04]
            : [0.035 * dir, 0];
    const mood = { bristle: 0.25 + glare * 0.6, tightness: glare * 0.15 };

    drawPim(ctx, { x: 140 + reach, y: FLOOR, size: 108, squash, lean, look: look(1), shell: mood }, t);
    drawKrit(
      ctx,
      { x: 340 - reach, y: FLOOR, size: 108, squash, lean: -lean, look: look(-1), shell: mood },
      t,
    );

    if (t < BURST) icon(ctx, 'cookie', CX, CY, 1);
    else crumbs(ctx, t);
    if (t > 3.95) icon(ctx, 'cookie', CX, CY, easeBack(seg(t, 3.95, 4.25)));

    const pop = easeBack(seg(t, 2.25, 2.5)) * (1 - seg(t, 3.2, 3.35));
    bubble(ctx, 96, 76, 'storm', pop, [118, 112]);
    bubble(ctx, 384, 76, 'storm', pop, [362, 112]);
  },
});
