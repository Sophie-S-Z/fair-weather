// The Cookie Economy, strip 2: "Reserves". The meadow keeps one cookie on a stump, just in case.
// Three guards share the watch. Gulp takes the night. The adult layer: a store of value that is only trust.
import { bubble, COLOR, easeInOut, easeOut, hops, lerp, seg, wobble, type Pose } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import {
  blinkAt,
  breathe,
  cookie,
  crumb,
  meadow,
  moon,
  paint,
  shown,
  sparkle,
  startle,
  sweat,
  twinkle,
} from '../kit/props.ts';
import { mountStrip } from '../kit/strip.ts';

type Ctx = CanvasRenderingContext2D;
const { pim, krit, tuck, bell, gulp } = CAST;

const FY = 226;
const S = 92;
/** The stump with the reserve cookie stands in the middle of each panel. */
const STUMP = 122;
const TOP = FY - 34;
/** Gulp is wide, so it stands smaller than the others. */
const GULP = 66;

/** A short tree stump, 34 pixels tall, with rings on its cut top. */
function stump(ctx: Ctx, x: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 24, FY);
  ctx.lineTo(x - 21, TOP);
  ctx.lineTo(x + 21, TOP);
  ctx.lineTo(x + 24, FY);
  ctx.closePath();
  paint(ctx, COLOR.wood);
  ctx.beginPath();
  ctx.ellipse(x, TOP, 21, 6, 0, 0, Math.PI * 2);
  paint(ctx, '#ead1ae');
  ctx.beginPath();
  ctx.ellipse(x, TOP, 10, 3, 0, 0, Math.PI * 2);
  ctx.strokeStyle = COLOR.ink;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** The reserve: one cookie, standing on its edge on the stump, with a soft glow. */
function reserve(ctx: Ctx, x: number, y: number, t: number): void {
  ctx.beginPath();
  ctx.arc(x, y, 20 + Math.sin(t * 2) * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.glow;
  ctx.globalAlpha = 0.6;
  ctx.fill();
  ctx.globalAlpha = 1;
  cookie(ctx, x, y, 12);
}

/** Night: a blue wash over the panel, a moon, and stars. */
function night(ctx: Ctx, w: number, h: number, t: number): void {
  ctx.fillStyle = '#1f2b4d';
  ctx.globalAlpha = 0.42;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  moon(ctx, 40, 88, 16);
  for (const [x, y, p] of [
    [96, 70, 0],
    [74, 128, 1.3],
    [130, 104, 2.1],
    [220, 64, 3.4],
  ] as const)
    twinkle(ctx, x, y, t, p);
}

/** Gulp's cheeks, full: two round bulges, drawn under the body so only the outer edge shows. */
function cheeks(ctx: Ctx, x: number, y: number, s: number): void {
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * 0.6 * s, y - 0.36 * s, 0.22 * s, 0.2 * s, 0, 0, Math.PI * 2);
    paint(ctx, '#9fd8b6', 0.05 * s);
  }
}

const stand = (draw: typeof pim, ctx: Ctx, t: number, pose: Pose): void => {
  draw(ctx, { size: S, squash: breathe(t), blink: blinkAt(t, 3.3, pose.x / 50), ...pose }, t);
};

mountStrip({
  id: 'cookie-economy-reserves',
  series: 'The Cookie Economy',
  title: 'Reserves',
  label:
    'A four-panel comic. Panel 1: Pim sets one cookie on a stump, and it glows. Krit stares at it. ' +
    'Caption: The meadow keeps one cookie in reserve. ' +
    'Panel 2: Three guards take turns by the stump: Tuck with its spikes up, Bell, and Gulp, who has a moon in its bubble. ' +
    'Caption: Three guards share the watch. ' +
    'Panel 3: Night. Gulp guards the cookie alone. It looks left, it looks right, and it sweats. ' +
    'Caption: Gulp takes the night shift. ' +
    'Panel 4: Morning. The stump is empty except for crumbs. Gulp has full round cheeks and a heart in its bubble. ' +
    'Pim and Krit stare at the stump. Caption: The reserve is now a feeling.',
  panels: [
    {
      caption: 'The meadow keeps one cookie in reserve.',
      beat: 3.6,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        stump(ctx, STUMP);
        // Pim lifts the cookie onto the stump, and it starts to glow.
        const lift = easeInOut(seg(lt, 0.4, 1.2));
        if (lt < 1.2)
          cookie(
            ctx,
            lerp(54, STUMP, lift),
            lerp(FY - 50, TOP - 14, lift) - Math.sin(lift * Math.PI) * 30,
            12,
          );
        else reserve(ctx, STUMP, TOP - 14, t);
        sparkle(ctx, STUMP, TOP - 14, lt, 1.2);
        stand(pim, ctx, t, {
          x: 46,
          y: FY,
          lean: 0.15 * Math.sin(lift * Math.PI),
          look: [0.05, -0.01],
          squash: breathe(t) + wobble(lt, 1.3, 0.12),
        });
        const stare = seg(lt, 1.4, 1.7);
        stand(krit, ctx, t, {
          x: 202,
          y: FY,
          look: [lerp(-0.02, -0.06, stare), lerp(0, 0.02, stare)],
          shell: { bristle: 0.4 * stare, color: 0.2 + 0.5 * stare },
          squash: breathe(t) + startle(lt, 1.4),
        });
        bubble(ctx, 196, FY - S - 44, 'crown', shown(lt, 2.0, 99) * 0.7, [196, FY - S - 18]);
      },
    },
    {
      caption: 'Three guards share the watch.',
      beat: 3.6,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        stump(ctx, 92);
        reserve(ctx, 92, TOP - 14, t);
        // The guards stand to attention one after another: a stretch, then still.
        const guards = [
          { draw: tuck, x: 40, at: 0.3, shell: { bristle: 0.9 } },
          { draw: bell, x: 146, at: 0.9, shell: {} },
        ];
        for (const g of guards) {
          const rise = easeOut(seg(lt, g.at, g.at + 0.3));
          if (rise <= 0) continue;
          stand(g.draw, ctx, t, {
            x: g.x,
            y: FY,
            size: S * 0.74,
            alpha: rise,
            squash: startle(lt, g.at),
            look: [g.x < 92 ? 0.05 : -0.05, 0],
            shell: g.shell,
          });
        }
        // Gulp, last in the rota, hops in and gets the moon.
        const hop = hops(lt, 1.5, 2.3, w + 40, 208, 2);
        if (lt > 1.5)
          stand(gulp, ctx, t, {
            x: hop.x,
            y: FY - hop.lift,
            size: GULP * 0.75,
            squash: hop.squash + wobble(lt, 2.3, 0.15),
            look: [-0.06, 0.02],
          });
        bubble(
          ctx,
          212,
          FY - 92,
          (c: Ctx) => {
            moon(c, 0, 0, 10);
          },
          shown(lt, 2.5, 99) * 0.7,
          [210, FY - 62],
        );
      },
    },
    {
      caption: 'Gulp takes the night shift.',
      beat: 5.2,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        stump(ctx, STUMP);
        reserve(ctx, STUMP, TOP - 14, t);
        night(ctx, w, h, t);
        // Gulp looks left, looks right, then only at the cookie. Its eyes grow; it sweats.
        const left = seg(lt, 0.6, 0.8) * (1 - seg(lt, 1.4, 1.6));
        const right = seg(lt, 1.6, 1.8) * (1 - seg(lt, 2.4, 2.6));
        const fix = seg(lt, 2.8, 3.2);
        stand(gulp, ctx, t, {
          x: 194,
          y: FY,
          size: GULP,
          look: [-0.07 * left + 0.07 * right - 0.06 * fix, 0.02 * fix],
          lean: -0.12 * easeInOut(seg(lt, 3.2, 4.6)),
          shell: { tightness: 0.5 * fix, color: 0.3 + 0.5 * fix },
          squash: breathe(t, 1.2, 0.04),
        });
        if (lt > 2.8) sweat(ctx, 226, FY - GULP + 6, lt, 1.2);
        bubble(ctx, 186, FY - GULP - 50, 'cookie', shown(lt, 3.6, 99) * 0.75, [190, FY - GULP - 22]);
      },
    },
    {
      caption: 'The reserve is now a feeling.',
      beat: 4.4,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        stump(ctx, STUMP);
        crumb(ctx, STUMP - 8, TOP - 2, 2.4);
        crumb(ctx, STUMP + 6, TOP - 1, 2);
        crumb(ctx, STUMP + 30, FY - 2, 2.2);
        const gx = 188;
        cheeks(ctx, gx, FY, GULP * 1.05);
        stand(gulp, ctx, t, {
          x: gx,
          y: FY,
          size: GULP,
          look: [-0.03, -0.03],
          squash: 0.1 + breathe(t, 2.4, 0.02),
          shell: { softness: 0.9, color: 0.8 },
        });
        bubble(ctx, gx, FY - GULP - 44, 'heart', shown(lt, 1.6, 99) * 0.75, [gx - 4, FY - GULP - 16]);
        // Pim and Krit arrive and stare at the empty stump.
        const come = seg(lt, 0.3, 0.6);
        stand(pim, ctx, t, {
          x: 24,
          y: FY,
          size: S * 0.85,
          alpha: come,
          look: [0.06, 0.02],
          squash: startle(lt, 0.9),
        });
        stand(krit, ctx, t, {
          x: 70,
          y: FY + 10,
          size: S * 0.8,
          alpha: come,
          look: [0.06, 0.01],
          shell: { bristle: 0.9 * seg(lt, 0.9, 1.1) },
          squash: startle(lt, 1.0),
        });
        bubble(ctx, 52, FY - S - 30, 'bang', shown(lt, 1.0, 99) * 0.6, [50, FY - S - 4]);
      },
    },
  ],
});
