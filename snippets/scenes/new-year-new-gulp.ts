// Strip: "New Year, New Gulp". Gulp starts a healthy diet of leaves. A fly comes by.
// Gulp holds out for as long as a frog can, then finds a reason.
import { COLOR, easeInOut, lerp, seg, wobble } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import { blinkAt, breathe, leaf, meadow, shown, speech, sweat } from '../kit/props.ts';
import { mountStrip } from '../kit/strip.ts';

type Ctx = CanvasRenderingContext2D;
const { gulp } = CAST;

const FY = 226;
const S = 110;
const GULP = 118;
/** Gulp's mouth, a little under its eyes. */
const MOUTH: readonly [number, number] = [GULP, FY - S * 0.55];

/** A small black fly with fast wings. */
function fly(ctx: Ctx, x0: number, y0: number, t: number): void {
  // Drawn larger than the fly on the cake page, so it reads in a small panel.
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(1.6, 1.6);
  const [x, y] = [0, 0];
  const flap = Math.sin(t * 60) * 0.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 4, y - 5, 5, 3, side * (0.8 + flap), 0, Math.PI * 2);
    ctx.fillStyle = COLOR.glass;
    ctx.fill();
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.ink;
  ctx.fill();
  ctx.restore();
}

/** The fly's loop around Gulp's head: a slow figure eight. */
const flyAt = (t: number): [number, number] => [
  GULP + Math.sin(t * 1.7) * 70,
  FY - S * 0.95 + Math.sin(t * 3.4) * 14,
];

mountStrip({
  id: 'new-year-new-gulp',
  series: 'Meadow Life',
  title: 'New Year, New Gulp',
  label:
    'A four-panel comic. Panel 1, January 1: Gulp holds up a leaf and says "New year. New Gulp." ' +
    'Panel 2: Gulp chews the leaf with half-shut eyes, gray and sad, and says "Mmm. Leaf." ' +
    "Panel 3: A fly loops around Gulp's head. Gulp shakes and sweats, and its eyes follow the fly. " +
    'Panel 4, January 1, 9:05 AM: Gulp\'s tongue snaps up the fly. Gulp, pink and happy, says "Flies are basically salad."',
  panels: [
    {
      caption: 'January 1',
      beat: 3.4,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        const lift = easeInOut(seg(lt, 0.3, 0.8));
        gulp(
          ctx,
          {
            x: GULP,
            y: FY,
            size: S,
            squash: breathe(t) - 0.06 * lift,
            blink: blinkAt(t, 3),
            look: [0, 0.03],
          },
          t,
        );
        leaf(ctx, GULP + 62, FY - S * 0.55 - 26 * lift, 40, -1.1);
        speech(ctx, 118, 66, 'New year. New Gulp.', GULP, FY - S, shown(lt, 0.6, 99), 140);
      },
    },
    {
      beat: 3.6,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        // Chewing: a slow up and down squash. The leaf gets shorter with each chew.
        const chew = Math.abs(Math.sin(lt * 4)) * 0.05;
        gulp(
          ctx,
          {
            x: GULP,
            y: FY,
            size: S,
            squash: chew,
            blink: 0.55,
            gray: 0.45,
            shell: { tightness: 0.2 },
          },
          t,
        );
        const left = 1 - seg(lt, 0, 3) * 0.6;
        leaf(ctx, MOUTH[0] + 18 * left, MOUTH[1] + 6, 40 * left, 0.1);
        speech(ctx, 110, 70, 'Mmm. Leaf.', GULP, FY - S, shown(lt, 1.2, 99));
      },
    },
    {
      beat: 4.8,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        const [fx, fy] = flyAt(t);
        const want = seg(lt, 0.5, 1.5);
        // Gulp holds still and shakes. Only its eyes move, after the fly.
        const shake = Math.sin(t * 50) * 0.012 * want;
        const d = Math.hypot(fx - GULP, fy - (FY - S * 0.7)) || 1;
        gulp(
          ctx,
          {
            x: GULP,
            y: FY,
            size: S,
            lean: shake,
            squash: 0.04 * want,
            look: [((fx - GULP) / d) * 0.06, (-(fy - (FY - S * 0.7)) / d) * 0.06],
            gray: 0.35,
            shell: { tightness: 0.5 * want },
          },
          t,
        );
        sweat(ctx, GULP + S * 0.42, FY - S * 0.7, lt, 1.1);
        sweat(ctx, GULP - S * 0.4, FY - S * 0.62, lt + 0.5, 1.3);
        fly(ctx, fx, fy, t);
        speech(ctx, 120, 58, 'Stay strong, Gulp.', GULP, FY - S, shown(lt, 1.4, 99), 140);
      },
    },
    {
      caption: 'January 1, 9:05 AM',
      beat: 5,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        // The tongue snaps out and back with the fly.
        const out = easeInOut(seg(lt, 0.4, 0.55));
        const back = easeInOut(seg(lt, 0.6, 0.8));
        const reach = out * (1 - back);
        const target: [number, number] = [GULP + 76, FY - S * 1.2];
        if (reach > 0) {
          ctx.beginPath();
          ctx.moveTo(...MOUTH);
          ctx.lineTo(lerp(MOUTH[0], target[0], reach), lerp(MOUTH[1], target[1], reach));
          ctx.strokeStyle = COLOR.berry;
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        if (lt < 0.6) fly(ctx, target[0] + (lt < 0.55 ? Math.sin(t * 8) * 4 : 0), target[1], t);
        gulp(
          ctx,
          {
            x: GULP,
            y: FY,
            size: S,
            squash: wobble(lt, 0.8, 0.22) + breathe(t),
            blink: lt > 1 ? blinkAt(t, 2.6) : 0,
            look: [0.03, 0.02],
            shell: { color: 0.7, softness: 0.8 },
          },
          t,
        );
        speech(ctx, 116, 60, 'Flies are basically salad.', GULP, FY - S, shown(lt, 1.4, 99), 130);
      },
    },
  ],
});
