// Quill Asks, strip 1: "The Tower". Krit swaps each cookie in its tower for a fresh one, one at a time.
// Is it still the same tower? Gulp settles the matter. The adult layer: identity through change.
import { bubble, easeBack, easeInOut, hops, lerp, seg, wobble, arc, type Icon } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import { blinkAt, breathe, crumb, meadow, paint, shown, sparkle, startle, sweat } from '../kit/props.ts';
import { mountStrip } from '../kit/strip.ts';

type Ctx = CanvasRenderingContext2D;
const { krit, quill, gulp } = CAST;

const FY = 226;
const S = 86;
const TOWER = 122;
/** Cookies in the tower, and the color of an old cookie next to a fresh one. */
const N = 6;
const OLD = '#94704f';
const FRESH = '#f0c27e';
const STEP = 9;

/** One flat cookie seen from the side. */
function disc(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, 17, 5.5, 0, 0, Math.PI * 2);
  paint(ctx, color, 1.8);
}

/** The tower: `fresh` cookies from the bottom are new, and the rest are old. */
function tower(ctx: Ctx, fresh: number, count = N): void {
  for (let k = 0; k < count; k++) disc(ctx, TOWER, FY - 5 - k * STEP, k < fresh ? FRESH : OLD);
}

/** The pile of old cookies on the floor, at the left. */
function pile(ctx: Ctx, n: number): void {
  for (let k = 0; k < n; k++) disc(ctx, 14 + (k % 3) * 7, FY - 4 - Math.floor(k / 3) * 8 - (k % 2) * 2, OLD);
}

/** Question bubbles that pop in one by one around Quill. */
const SPOTS: readonly (readonly [number, number])[] = [
  [196, 88],
  [150, 98],
  [230, 118],
  [168, 64],
  [222, 72],
  [138, 132],
];
function questions(
  ctx: Ctx,
  lt: number,
  times: readonly number[],
  at: readonly [number, number],
  dx = 0,
): void {
  times.forEach((t0, i) => {
    const [sx, sy] = SPOTS[i] ?? [196, 88];
    const [x, y] = [sx + dx, sy];
    // A short tail that points toward Quill's head.
    const d = Math.hypot(at[0] - x, at[1] - y) || 1;
    const tail: [number, number] = [x + ((at[0] - x) / d) * 26, y + ((at[1] - y) / d) * 26];
    const s = shown(lt, t0, 99) * (0.55 + 0.04 * Math.sin(lt * 3 + i));
    bubble(ctx, x, y, 'question' satisfies Icon, s, tail);
  });
}

const standKrit = (ctx: Ctx, t: number, lt: number, extra = {}): void => {
  krit(
    ctx,
    { x: 64, y: FY, size: S, squash: breathe(t), blink: blinkAt(t, 3.2), look: [0.05, 0], ...extra },
    t,
  );
};
const standQuill = (ctx: Ctx, t: number, extra = {}): void => {
  quill(
    ctx,
    {
      x: 200,
      y: FY,
      size: S,
      squash: breathe(t, 2.3),
      blink: blinkAt(t, 2.9, 1),
      look: [-0.05, 0.01],
      ...extra,
    },
    t,
  );
};

mountStrip({
  id: 'quill-asks-the-tower',
  series: 'Quill Asks',
  title: 'The Tower',
  label:
    'A four-panel comic. Panel 1: Krit has a tower of old cookies. It takes the top cookie off and puts a fresh one on. ' +
    'Quill watches, with one question in its bubble. Caption: Krit swaps one cookie for a fresh one. ' +
    'Panel 2: Krit swaps the rest, one by one. Now every cookie in the tower is fresh, and the old ones lie in a pile. ' +
    'Quill has three questions now. Caption: Then the next. Then all of them. ' +
    'Panel 3: Krit stands proud, with a crown in its bubble. Quill is ringed by six question bubbles and sweats. ' +
    'Behind Quill, Gulp looks in at the tower. Caption: Quill wonders if it is the same tower. ' +
    'Panel 4: Gulp sits where the tower was, round and full, with crumbs around it. Both the tower and the pile are gone. ' +
    'Krit bristles. All of Quill’s questions are gone, and then one new question pops up. Caption: The question is closed.',
  panels: [
    {
      caption: 'Krit swaps one cookie for a fresh one.',
      beat: 3.8,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        // The old top cookie flies to the floor; a fresh one drops on with a sparkle.
        const off = seg(lt, 0.5, 1.1);
        const on = seg(lt, 1.3, 1.8);
        tower(ctx, 0, N - 1);
        if (off < 1)
          disc(
            ctx,
            lerp(TOWER, 14, easeInOut(off)),
            lerp(FY - 5 - (N - 1) * STEP, FY - 4, off) - arc(off) * 40,
            OLD,
          );
        else pile(ctx, 1);
        if (on > 0) disc(ctx, TOWER, lerp(FY - 120, FY - 5 - (N - 1) * STEP, easeBack(on)), FRESH);
        sparkle(ctx, TOWER, FY - 5 - (N - 1) * STEP, lt, 1.8);
        standKrit(ctx, t, lt, { lean: 0.15 * arc(seg(lt, 0.4, 1.0)) + 0.12 * arc(seg(lt, 1.2, 1.8)) });
        standQuill(ctx, t, { squash: breathe(t, 2.3) + startle(lt, 2.0) });
        questions(ctx, lt, [2.2], [200, FY - S + 10]);
      },
    },
    {
      caption: 'Then the next. Then all of them.',
      beat: 3.8,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        // Each old cookie turns fresh in turn, from the top down, and joins the pile.
        const swaps = Math.min(N - 1, Math.floor(seg(lt, 0.3, 2.3) * (N - 1) + (lt > 0.3 ? 1 : 0)));
        for (let k = 0; k < N; k++) disc(ctx, TOWER, FY - 5 - k * STEP, k >= N - 1 - swaps ? FRESH : OLD);
        pile(ctx, 1 + swaps);
        for (let k = 0; k < N - 1; k++)
          sparkle(ctx, TOWER, FY - 5 - (N - 2 - k) * STEP, lt, 0.3 + (k * 2) / (N - 1));
        standKrit(ctx, t, lt, { squash: breathe(t) + 0.05 * Math.sin(lt * 10) * (lt < 2.3 ? 1 : 0) });
        standQuill(ctx, t, { shell: { tightness: 0.2 } });
        questions(ctx, lt, [0, 1.2, 2.2], [200, FY - S + 10]);
      },
    },
    {
      caption: 'Quill wonders if it is the same tower.',
      beat: 5.4,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        tower(ctx, N);
        pile(ctx, N);
        // Gulp's eyes rise at the right edge, behind Quill, and fix on the tower.
        const peek = easeInOut(seg(lt, 3.4, 4.0));
        if (peek > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, w, FY);
          ctx.clip();
          gulp(
            ctx,
            { x: w - 6, y: FY + 64 - 34 * peek, size: 66, look: [-0.07, 0.02], blink: blinkAt(t, 2.4) },
            t,
          );
          ctx.restore();
        }
        standKrit(ctx, t, lt, { look: [0.02, -0.03], squash: breathe(t) - 0.05 });
        bubble(ctx, 70, FY - S - 44, 'crown', shown(lt, 0.3, 99) * 0.7, [68, FY - S - 18]);
        const strain = seg(lt, 0.6, 2.6);
        standQuill(ctx, t, {
          x: 172,
          look: [-0.02, 0.04 * Math.sin(lt * 2)],
          shell: { tightness: 0.2 + 0.6 * strain, color: 0.2 + 0.4 * strain },
          squash: breathe(t, 0.9, 0.03),
        });
        questions(ctx, lt, [0, 0, 0, 0.8, 1.4, 2.0], [172, FY - S + 10], -26);
        if (lt > 1.6) sweat(ctx, 196, FY - S + 18, lt, 1.1);
      },
    },
    {
      caption: 'The question is closed.',
      beat: 4.4,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        for (const [x, y, r] of [
          [86, FY - 2, 2.6],
          [140, FY - 3, 2.2],
          [20, FY - 2, 2.4],
          [104, FY - 10, 1.8],
        ] as const)
          crumb(ctx, x, y, r);
        const hop = hops(lt, 0, 0.5, TOWER + 30, TOWER, 1);
        gulp(
          ctx,
          {
            x: hop.x,
            y: FY - hop.lift,
            size: 70,
            squash: 0.12 + hop.squash + wobble(lt, 0.5, 0.2) + breathe(t, 2.6, 0.02),
            look: [0, -0.02],
            blink: 0.6,
            shell: { softness: 0.9, color: 0.8 },
          },
          t,
        );
        krit(
          ctx,
          {
            x: 34,
            y: FY,
            size: S * 0.92,
            look: [0.06, 0],
            squash: startle(lt, 0.6),
            shell: { bristle: 0.9 },
          },
          t,
        );
        bubble(ctx, 40, FY - S - 34, 'bang', shown(lt, 0.7, 99) * 0.6, [38, FY - S - 8]);
        standQuill(ctx, t, { x: 204, look: [-0.06, 0.02], squash: breathe(t, 2.3) + startle(lt, 2.6) });
        // The old questions are gone. One new one grows anyway.
        bubble(ctx, 200, FY - S - 46, 'question', shown(lt, 2.6, 99) * 0.62, [210, FY - S - 16]);
      },
    },
  ],
});
