// The Cookie Economy, strip 1: "Interest". Krit borrows one crumb and pays it back with a bonus crumb.
// Somehow, that leaves Pim in debt. The adult layer: a favor that you did not ask for still feels owed.
import { arc, bubble, easeInOut, easeOut, hops, lerp, seg, wobble } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import { blinkAt, breathe, cookie, cookieStack, crumb, meadow, shown, startle, sweat } from '../kit/props.ts';
import { mountStrip } from '../kit/strip.ts';

type Ctx = CanvasRenderingContext2D;
const { pim, krit } = CAST;

/** The floor line and the creature size in each panel. */
const FY = 226;
const S = 100;
/** Pim sits on the left with its cookies; Krit comes and goes on the right. */
const PIM = 60;
const PILE = 126;
const KRIT = 186;

/** A crumb that flies in an arc from (x0, y0) to (x1, y1) over the window [a, b]. */
function toss(
  ctx: Ctx,
  lt: number,
  a: number,
  b: number,
  from: [number, number],
  to: [number, number],
): void {
  const u = seg(lt, a, b);
  const x = lerp(from[0], to[0], easeInOut(u));
  const y = lerp(from[1], to[1], u) - arc(u) * 34;
  crumb(ctx, x, y, 3.5);
}

function scene(ctx: Ctx, w: number, h: number): void {
  meadow(ctx, w, h, FY);
  cookieStack(ctx, PILE, FY, 3);
}

function sitPim(ctx: Ctx, t: number, extra: Partial<Parameters<typeof pim>[1]> = {}): void {
  pim(
    ctx,
    { x: PIM, y: FY, size: S, squash: breathe(t), blink: blinkAt(t, 3.1), look: [0.04, 0], ...extra },
    t,
  );
}

mountStrip({
  id: 'cookie-economy-interest',
  series: 'The Cookie Economy',
  title: 'Interest',
  label:
    'A four-panel comic. Panel 1: Krit asks Pim for one crumb, and Pim gives it. ' +
    'Panel 2: Krit comes back and returns the crumb. ' +
    'Panel 3: Krit adds one more crumb, with a bow and a crown in its bubble. Krit insists. ' +
    'Panel 4: Krit waits with a cookie in its bubble. Pim, puzzled and sweating, pushes a whole cookie over to Krit. ' +
    'Caption: Pim now owes Krit a cookie.',
  panels: [
    {
      caption: 'Krit borrows one crumb.',
      beat: 3.6,
      draw(ctx, lt, t, w, h) {
        scene(ctx, w, h);
        const come = hops(lt, 0.1, 0.9, w + 50, KRIT, 3);
        const go = hops(lt, 2.6, 3.4, KRIT, w - 14, 3);
        const x = lt < 2.6 ? come.x : go.x;
        const lift = lt < 2.6 ? come.lift : go.lift;
        sitPim(ctx, t, { look: [0.05, 0], squash: breathe(t) + wobble(lt, 1.6, 0.1) });
        krit(
          ctx,
          { x, y: FY - lift, size: S, flip: lt > 2.6, look: [-0.05, 0], squash: come.squash + go.squash },
          t,
        );
        bubble(
          ctx,
          KRIT - 14,
          FY - S - 46,
          (c: Ctx) => {
            crumb(c, 0, 2, 6);
          },
          shown(lt, 0.9, 1.8) * 0.75,
          [KRIT - 18, FY - S - 18],
        );
        if (lt > 1.6 && lt < 2.2) toss(ctx, lt, 1.6, 2.2, [PILE, FY - 26], [KRIT, FY - S - 4]);
        if (lt >= 2.2) crumb(ctx, x, FY - lift - S - 4, 3.5);
      },
    },
    {
      caption: 'Krit returns one crumb.',
      beat: 3.4,
      draw(ctx, lt, t, w, h) {
        scene(ctx, w, h);
        const come = hops(lt, 0.1, 0.9, w + 50, KRIT, 3);
        sitPim(ctx, t);
        krit(ctx, { x: come.x, y: FY - come.lift, size: S, look: [-0.05, 0], squash: come.squash }, t);
        if (lt < 1.3) crumb(ctx, come.x, FY - come.lift - S - 4, 3.5);
        else toss(ctx, lt, 1.3, 1.9, [KRIT, FY - S - 4], [PILE + 26, FY - 4]);
        bubble(ctx, PIM + 14, FY - S - 40, 'heart', shown(lt, 2.1, 99) * 0.6, [PIM + 6, FY - S - 14]);
      },
    },
    {
      caption: 'Plus one more. Krit insists.',
      beat: 4.8,
      draw(ctx, lt, t, w, h) {
        scene(ctx, w, h);
        crumb(ctx, PILE + 26, FY - 4, 3.5);
        // Krit bows low, with ceremony.
        const bow = easeOut(seg(lt, 2.2, 2.6)) * (1 - easeInOut(seg(lt, 3.2, 3.6)));
        sitPim(ctx, t, {
          squash: breathe(t) + startle(lt, 2.0),
          look: lt > 2.0 ? [0.02, -0.03] : [0.04, 0],
        });
        krit(
          ctx,
          { x: KRIT, y: FY, size: S, look: [-0.05, -0.02], lean: -0.25 * bow, squash: 0.12 * bow },
          t,
        );
        bubble(ctx, KRIT + 6, FY - S - 46, 'crown', shown(lt, 0.4, 99) * 0.75, [KRIT, FY - S - 18]);
        if (lt < 1.4) crumb(ctx, KRIT - 20, FY - 40, 3.5);
        toss(ctx, lt, 1.4, 2.0, [KRIT - 20, FY - 40], [PILE + 38, FY - 4]);
        bubble(ctx, PIM + 4, FY - S - 40, 'question', shown(lt, 3.6, 99) * 0.6, [PIM, FY - S - 14]);
      },
    },
    {
      caption: 'Pim now owes Krit a cookie.',
      beat: 5,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY);
        // The pile loses its top cookie, which slides over to Krit.
        cookieStack(ctx, PILE, FY, lt < 1.6 ? 3 : 2);
        crumb(ctx, PILE + 26, FY - 4, 3.5);
        crumb(ctx, PILE + 38, FY - 4, 3.5);
        const slide = easeInOut(seg(lt, 1.6, 2.8));
        if (lt >= 1.6) cookie(ctx, lerp(PILE, KRIT - 54, slide), FY - 20 + 12 * slide - arc(slide) * 10, 11);
        sitPim(ctx, t, {
          lean: 0.12 * Math.sin(Math.PI * slide),
          look: [0.05, -0.01],
          shell: { tightness: 0.35 },
        });
        sweat(ctx, PIM + 26, FY - S + 6, lt, 1.4);
        const glee = wobble(lt, 3.0, 0.2);
        krit(ctx, { x: KRIT, y: FY, size: S, look: [-0.05, 0], squash: glee + breathe(t, 1.6) }, t);
        bubble(ctx, KRIT + 6, FY - S - 46, 'cookie', shown(lt, 0.3, 2.8) * 0.75, [KRIT, FY - S - 18]);
        bubble(ctx, KRIT + 6, FY - S - 46, 'crown', shown(lt, 3.0, 99) * 0.75, [KRIT, FY - S - 18]);
        bubble(ctx, PIM + 4, FY - S - 40, 'question', shown(lt, 3.4, 99) * 0.6, [PIM, FY - S - 14]);
      },
    },
  ],
});
