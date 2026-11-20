// Strip: "I'm Fine". Glim is made of glass, so every feeling shows inside it.
// Glim says that it is fine, while a storm inside it gets worse. Pim sees it, and stays.
import { COLOR, easeOut, seg, wobble } from '../kit/draw.ts';
import { CAST } from '../kit/cast.ts';
import { blinkAt, breathe, ink, meadow, paint, rain, shown, speech, startle, sun } from '../kit/props.ts';
import { mountStrip } from '../kit/strip.ts';

type Ctx = CanvasRenderingContext2D;
const { pim, glim } = CAST;

const FY = 226;
const S = 120;
const PIM = 62;
const GLIM = 176;

/**
 * The weather inside Glim's glass body. `storm` goes from 0 (a small gray cloud) to 1 (a black cloud,
 * lightning, and water up to the eyes). `calm` turns it into a small cloud with a sun.
 */
function inside(ctx: Ctx, t: number, storm: number, calm = 0): void {
  const cx = GLIM;
  const top = FY - S * 0.3;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, FY - S * 0.17, S * 0.25, S * 0.17, 0, 0, Math.PI * 2);
  ctx.clip();
  // Water fills up from the bottom as the storm grows.
  const level = FY - S * 0.04 - storm * S * 0.24 * (1 - calm);
  ctx.fillStyle = COLOR.water;
  ctx.beginPath();
  ctx.moveTo(cx - S * 0.3, level);
  for (let k = 0; k <= 8; k++) ctx.lineTo(cx - S * 0.3 + k * S * 0.075, level + Math.sin(t * 4 + k) * 1.5);
  ctx.lineTo(cx + S * 0.3, FY);
  ctx.lineTo(cx - S * 0.3, FY);
  ctx.fill();
  // Rain under the cloud.
  if (storm > 0.15 && calm < 0.5) {
    ctx.save();
    ctx.translate(cx - 22, top + 8);
    rain(ctx, 44, 40, t, 0.3 + storm * 0.4);
    ctx.restore();
  }
  ctx.restore();

  // The cloud: gray, then dark. With calm, it shrinks and a sun peeks out.
  const r = 8 + 6 * storm * (1 - calm);
  if (calm > 0) sun(ctx, cx + 10, top + 4, 7 * calm, t);
  ctx.beginPath();
  ctx.arc(cx - r * 0.7, top + 6, r * 0.7, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(cx, top + 2, r, Math.PI * 1.1, Math.PI * 1.95);
  ctx.arc(cx + r * 0.75, top + 6, r * 0.65, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  const dark = Math.round(201 - 120 * storm * (1 - calm));
  paint(ctx, `rgb(${String(dark)},${String(dark + 5)},${String(dark + 13)})`, 1.6);
  // Lightning flashes now and then once the storm is big.
  if (storm > 0.6 && calm === 0 && t % 1.2 < 0.25) {
    ctx.beginPath();
    for (const [x, y] of [
      [2, 10],
      [-4, 18],
      [3, 18],
      [-3, 28],
    ] as const)
      ctx.lineTo(cx + x, top + y);
    ctx.strokeStyle = COLOR.glow;
    ctx.lineWidth = 3;
    ctx.stroke();
    ink(ctx, 1);
  }
}

function drawGlim(ctx: Ctx, t: number, worry: number, extra = {}): void {
  // Glim smiles wide with its body: tall and still. The shake gives it away.
  const shake = worry * Math.sin(t * 40) * 0.015;
  glim(
    ctx,
    { x: GLIM, y: FY, size: S, look: [-0.05, 0], lean: shake, blink: blinkAt(t, 3.4, 1), ...extra },
    t,
  );
}

function drawPim(ctx: Ctx, t: number, extra = {}): void {
  pim(
    ctx,
    { x: PIM, y: FY, size: S * 0.8, squash: breathe(t), blink: blinkAt(t, 3.1), look: [0.05, 0], ...extra },
    t,
  );
}

mountStrip({
  id: 'im-fine',
  series: 'Meadow Life',
  title: "I'm Fine",
  label:
    'A four-panel comic. Glim is made of clear glass, so its feelings show inside it as weather. ' +
    'Panel 1: Pim asks "How are you?" Glim says "Fine!" A small gray cloud floats inside Glim. ' +
    'Panel 2: Pim asks "Really?" Glim says "Totally fine." Inside, it rains. ' +
    'Panel 3: Glim says "Never better!" Inside, a black storm flashes lightning, and the water rises to its eyes. Glim shakes. ' +
    'Panel 4: Pim holds a leaf over Glim like an umbrella. Glim says "Okay. Not fine." Pim says "I know." ' +
    'Inside Glim, the storm shrinks, and a small sun comes out.',
  panels: [
    {
      beat: 3.6,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        drawPim(ctx, t, { squash: breathe(t) + wobble(lt, 0.3, 0.12) });
        drawGlim(ctx, t, 0);
        inside(ctx, t, 0.05);
        speech(ctx, 72, 52, 'How are you?', PIM + 6, FY - S * 0.8, shown(lt, 0.3, 99));
        speech(ctx, 178, 98, 'Fine!', GLIM, FY - S, shown(lt, 1.6, 99));
      },
    },
    {
      beat: 3.8,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        drawPim(ctx, t, { look: [0.06, -0.01], lean: 0.08 * easeOut(seg(lt, 0.3, 0.8)) });
        drawGlim(ctx, t, 0.3);
        inside(ctx, t, 0.35);
        speech(ctx, 60, 52, 'Really?', PIM + 6, FY - S * 0.8, shown(lt, 0.3, 99));
        speech(ctx, 172, 98, 'Totally fine.', GLIM, FY - S, shown(lt, 1.6, 99));
      },
    },
    {
      beat: 4.6,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        drawPim(ctx, t, { squash: startle(lt, 2.4), look: [0.06, 0.01], shell: { tightness: 0.3 } });
        drawGlim(ctx, t, 1, { squash: -0.06 });
        inside(ctx, t, Math.min(1, 0.35 + seg(lt, 0.8, 2.2) * 0.65));
        speech(ctx, 176, 92, 'Never better!', GLIM, FY - S, shown(lt, 0.4, 99), 120);
      },
    },
    {
      beat: 5,
      draw(ctx, lt, t, w, h) {
        meadow(ctx, w, h, FY, t);
        const calm = easeOut(seg(lt, 2.4, 3.6));
        drawPim(ctx, t, { x: 108, look: [0.06, 0.02], shell: { color: 0.6, softness: 0.8 } });
        drawGlim(ctx, t, 1 - calm, { shell: { softness: 0.3 + 0.5 * calm } });
        // Pim holds a big leaf over Glim, like an umbrella. The rain is inside, so it does not help. It helps.
        ctx.save();
        ctx.translate(132, FY - S * 0.92);
        ctx.rotate(-0.25);
        ctx.beginPath();
        ctx.moveTo(-4, 34);
        ctx.lineTo(10, -6);
        ink(ctx, 2.4);
        ctx.beginPath();
        ctx.moveTo(-36, 0);
        ctx.quadraticCurveTo(14, -34, 64, 0);
        ctx.quadraticCurveTo(14, -12, -36, 0);
        paint(ctx, COLOR.leaf);
        ctx.restore();
        inside(ctx, t, 1, calm);
        speech(ctx, 168, 50, 'Okay. Not fine.', GLIM, FY - S, shown(lt, 0.6, 99), 110);
        speech(ctx, 52, 104, 'I know.', 100, FY - S * 0.8, shown(lt, 1.8, 99));
      },
    },
  ],
});
