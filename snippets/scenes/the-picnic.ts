// The picnic: a four-panel comic with seventeen creatures. The panels play one after another, and
// each one holds its last frame until the strip fades out and starts again.
//   1. Pim brings one cookie, and four hungry friends pop up out of nowhere.
//   2. Pim shares it. Krit grabs extra, and Gulp's tongue takes it back.
//   3. Drift rains on everyone: each one takes the rain in its own way.
//   4. A rainbow comes out, and Inch arrives at last. Pim saved a piece for Inch.
import bell from '../../content/rigs/bell.rig.json';
import echo from '../../content/rigs/echo.rig.json';
import frog from '../../content/rigs/frog.rig.json';
import glassling from '../../content/rigs/glassling.rig.json';
import kite from '../../content/rigs/kite.rig.json';
import krit from '../../content/rigs/krit.rig.json';
import moss from '../../content/rigs/moss.rig.json';
import pim from '../../content/rigs/pim.rig.json';
import quill from '../../content/rigs/quill.rig.json';
import snail from '../../content/rigs/snail.rig.json';
import tove from '../../content/rigs/tove.rig.json';
import {
  arc,
  bubble,
  bush,
  COLOR,
  creature,
  easeBack,
  easeIn,
  easeInOut,
  easeOut,
  hops,
  icon,
  lerp,
  seg,
  wobble,
  type Icon,
} from '../kit/draw.ts';
import { drawDollop, drawDrift, drawHush, drawNib, drawSprig, drawTuck } from '../kit/friends.ts';
import { ART_HEIGHT, FONT, mount, WIDTH } from '../kit/stage.ts';

type Ctx = CanvasRenderingContext2D;

const drawPim = creature(pim);
const drawKrit = creature(krit);
const drawGulp = creature(frog);
const drawEcho = creature(echo);
const drawInch = creature(snail);
const drawMoss = creature(moss);
const drawBell = creature(bell);
const drawTove = creature(tove);
const drawGlim = creature(glassling);
const drawKite = creature(kite);
const drawQuill = creature(quill);

const GAP = 8;
/** Room above the panels for the tag. */
const TOP = 26;
const PW = (WIDTH - 3 * GAP) / 2;
const PH = (ART_HEIGHT - TOP - 2 * GAP) / 2;
/** The floor line inside each panel. */
const FY = PH - 24;
/** Creature height inside a panel. */
const S = 44;
const BEAT = 4;
const SECONDS = 4 * BEAT + 2;

/** A small speech bubble. */
const say = (
  ctx: Ctx,
  x: number,
  y: number,
  name: Icon,
  s: number,
  tail: readonly [number, number],
): void => {
  bubble(ctx, x, y, name, s * 0.62, tail);
};

/** Pops in at `a` and out at `b`, for bubbles. */
const pop = (lt: number, a: number, b: number): number =>
  easeBack(seg(lt, a, a + 0.2)) * (1 - seg(lt, b - 0.15, b));

/** A small cookie piece. */
function crumb(ctx: Ctx, x: number, y: number, r = 4.5): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = COLOR.cookie;
  ctx.fill();
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

/** A creature that pops up from under the floor, like a head out of a hole. */
const riseY = (lt: number, at: number): number => FY + 50 * (1 - easeBack(seg(lt, at, at + 0.3)));

// ---- Panel 1: one cookie ----

function panel1(ctx: Ctx, lt: number, t: number): void {
  const walk = hops(lt, 0, 0.9, -30, 70, 3);
  const carry = lt < 1.0;
  const worry = seg(lt, 2.6, 2.8);
  const glance = Math.sin(seg(lt, 2.8, 3.8) * Math.PI * 3) * 0.07 * worry;
  drawPim(
    ctx,
    {
      x: walk.x,
      y: FY - walk.lift,
      size: S,
      squash: walk.squash + wobble(lt, 1.0, 0.12),
      look: worry > 0 ? [glance, 0] : [0.04, -0.02],
      shell: { tightness: 0.4 * worry },
    },
    t,
  );
  const drop = seg(lt, 0.95, 1.15);
  if (carry) icon(ctx, 'cookie', walk.x, FY - walk.lift - S - 6, 0.6);
  else icon(ctx, 'cookie', lerp(walk.x, 102, drop), lerp(FY - S - 6, FY - 8, easeIn(drop)), 0.6);

  // The hungry friends pop up one by one, all eyes on the cookie.
  const friends = [
    { draw: drawNib, x: 24, at: 1.4 },
    { draw: drawKrit, x: 140, at: 1.65 },
    { draw: drawGulp, x: 174, at: 1.9 },
    { draw: drawDollop, x: 207, at: 2.15 },
  ];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, PW, FY);
  ctx.clip();
  for (const f of friends) {
    const look: [number, number] = [f.x < 102 ? 0.07 : -0.07, -0.03];
    f.draw(ctx, { x: f.x, y: riseY(lt, f.at), size: S * 0.85, look, shell: { color: 0.5 } }, t);
  }
  ctx.restore();
  say(ctx, 54, 26, 'question', pop(lt, 3.0, 9), [66, 42]);
}

// ---- Panel 2: sharing, fairly ----

/** Where each piece lands: on the heads of Krit, Echo, and Gulp. Pim keeps the last one for Inch. */
const PIECES = [
  { x: 34, y: FY - S - 4 },
  { x: 74, y: FY - S - 2 },
  { x: 166, y: FY - S - 2 },
  { x: 118, y: FY - S - 4 },
] as const;
const BURST = 0.6;
const GRAB = 1.6;
const ZAP = 2.6;

function panel2(ctx: Ctx, lt: number, t: number): void {
  const PIM_X = 118;
  const fly = easeOut(seg(lt, BURST, BURST + 0.5));
  const grab = easeInOut(seg(lt, GRAB, GRAB + 0.4));
  const zap = seg(lt, ZAP, ZAP + 0.5);
  const reach = arc(zap);
  const kritHas = lt < ZAP + 0.25 ? (lt > GRAB + 0.4 ? 2 : 1) : 1;

  drawInch(ctx, { x: 236 + 2 * seg(lt, 0, 4), y: FY, size: S * 0.8, look: [-0.05, 0] }, t);
  drawPim(
    ctx,
    {
      x: PIM_X,
      y: FY,
      size: S,
      squash: wobble(lt, BURST, 0.2),
      shell: { color: 0.2 + 0.6 * seg(lt, 1.0, 1.3) },
    },
    t,
  );
  drawKrit(
    ctx,
    {
      x: 34,
      y: FY,
      size: S,
      look: [0.06, 0],
      squash: wobble(lt, GRAB + 0.4, 0.1) + wobble(lt, ZAP + 0.25, 0.2),
      shell: { bristle: 0.3 + 0.4 * seg(lt, ZAP + 0.25, ZAP + 0.4) },
    },
    t,
  );
  // Echo copies Krit: when Krit's piece goes, Echo sulks the same way, a beat late.
  drawEcho(
    ctx,
    {
      x: 74,
      y: FY,
      size: S,
      look: [-0.06, 0],
      squash: wobble(lt, GRAB + 0.7, 0.1) + wobble(lt, ZAP + 0.55, 0.2),
      shell: { bristle: 0.4 * seg(lt, ZAP + 0.55, ZAP + 0.7) },
    },
    t,
  );
  const mouth: [number, number] = [166, FY - S * 0.62];
  drawGulp(
    ctx,
    { x: 166, y: FY, size: S, look: [-0.07, 0.02], shell: { color: 0.2 + 0.6 * seg(lt, 3.1, 3.3) } },
    t,
  );

  if (lt < BURST) {
    icon(ctx, 'cookie', PIM_X + 26, FY - 8, 0.6);
  } else {
    // Krit's stack: its own piece, then Echo's on top.
    const kritTop: [number, number] = [34, FY - S - 4];
    PIECES.forEach((p, i) => {
      if (i === 1 && lt > GRAB) {
        // Echo's piece hops over to the top of Krit's stack, and Gulp's tongue takes it.
        if (lt > ZAP + 0.25 && reach < 0.5) return;
        const x = lerp(p.x, kritTop[0], grab);
        const y = lerp(p.y, kritTop[1] - 9, grab) - arc(grab) * 18;
        const back = lt > ZAP + 0.25;
        crumb(
          ctx,
          back ? lerp(mouth[0], kritTop[0], reach) : x,
          back ? lerp(mouth[1], kritTop[1] - 9, reach) : y,
        );
        return;
      }
      const sx = PIM_X + 26;
      crumb(ctx, lerp(sx, p.x, fly), lerp(FY - 8, p.y, fly) - arc(fly) * 30);
    });
    if (kritHas === 2) say(ctx, 18, 24, 'crown', pop(lt, GRAB + 0.4, ZAP + 0.3), [28, 50]);
  }
  if (zap > 0 && zap < 1) {
    ctx.beginPath();
    ctx.moveTo(mouth[0], mouth[1]);
    ctx.lineTo(lerp(mouth[0], 34, reach), lerp(mouth[1], FY - S - 13, reach));
    ctx.strokeStyle = COLOR.berry;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  say(ctx, 60, 26, 'bang', pop(lt, ZAP + 0.3, 9), [44, 46]);
  say(ctx, 196, 30, 'heart', pop(lt, ZAP + 0.6, 9), [176, 52]);
}

// ---- Panel 3: Drift says hi ----

function panel3(ctx: Ctx, lt: number, t: number): void {
  const dx = lt < 1.0 ? lerp(-40, 50, easeOut(seg(lt, 0, 1.0))) : lerp(50, 270, easeInOut(seg(lt, 1.0, 3.8)));
  const raining = seg(lt, 0.9, 1.1);
  const wet = (x: number): number => seg(lt, 1.0 + ((x - 50) / 220) * 2.8, 1.3 + ((x - 50) / 220) * 2.8);

  // Rain: short lines that fall from Drift's underside.
  if (raining > 0) {
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const u = (lt * 2.2 + k / 6) % 1;
      const x = dx - 22 + k * 9;
      const y = lerp(34, FY - 4, u);
      ctx.globalAlpha = raining;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 1, y + 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // A puddle grows under Bell, and Bell admires its face in it.
  const puddle = wet(170);
  if (puddle > 0) {
    ctx.beginPath();
    ctx.ellipse(170, FY + 3, 20 * puddle, 4.5 * puddle, 0, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.water;
    ctx.fill();
  }

  // Tove hides behind grumpy Tuck. Tuck says go away, and keeps very still.
  const hide = hops(lt, 1.0, 1.4, 8, 30, 1);
  drawTove(
    ctx,
    {
      x: hide.x,
      y: FY - hide.lift,
      size: S * 0.9,
      squash: hide.squash,
      shell: { tightness: 0.6 },
      look: [0.05, 0.03],
    },
    t,
  );
  drawTuck(
    ctx,
    {
      x: 64,
      y: FY,
      size: S,
      look: [0.02, 0.06],
      shell: { bristle: 0.15 + 0.7 * wet(64), color: 0.2 + 0.6 * seg(lt, 3.0, 3.4) },
    },
    t,
  );
  // Moss sleeps through all of it.
  drawMoss(ctx, { x: 116, y: FY, size: S, blink: 1, squash: Math.sin(t * 2) * 0.03 }, t);
  drawBell(
    ctx,
    {
      x: 170,
      y: FY,
      size: S,
      look: [0, -0.06 * puddle],
      shell: { color: 0.2 + 0.6 * puddle },
      lean: 0.08 * puddle,
    },
    t,
  );
  // Sprig loves rain: it stretches up to drink it.
  const drink = wet(210);
  drawSprig(
    ctx,
    {
      x: 210,
      y: FY,
      size: S * 0.9,
      squash: -0.3 * drink,
      look: [-0.02, 0.06],
      shell: { color: 0.2 + 0.7 * drink },
    },
    t,
  );
  drawDrift(ctx, { x: dx, y: 40, size: S * 0.75, look: [0, -0.06], shell: { color: 0.7 } }, t);

  say(ctx, 34, 22, 'storm', pop(lt, 1.4, 2.6), [56, 46]);
  say(ctx, 140, 24, 'star', pop(lt, 2.6, 9), [160, 50]);
  say(ctx, 200, 22, 'heart', pop(lt, 3.3, 9), [206, 46]);
}

// ---- Panel 4: it all ends well ----

function rainbow(ctx: Ctx, u: number): void {
  if (u <= 0) return;
  const bands = [COLOR.berry, COLOR.glow, COLOR.leaf, COLOR.water] as const;
  bands.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(PW / 2, FY, 100 - i * 7, Math.PI, Math.PI + Math.PI * u);
    ctx.strokeStyle = c;
    ctx.lineWidth = 7;
    ctx.lineCap = 'butt';
    ctx.stroke();
  });
}

function panel4(ctx: Ctx, lt: number, t: number): void {
  rainbow(ctx, easeInOut(seg(lt, 0, 1.0)));

  // Hush peeks out of a little bush to see the rainbow.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, PW, FY);
  ctx.clip();
  drawHush(
    ctx,
    { x: 196, y: FY + 34 - 40 * easeOut(seg(lt, 0.6, 1.2)), size: S * 0.9, look: [-0.05, 0.03] },
    t,
  );
  ctx.restore();
  ctx.save();
  ctx.translate(196, FY);
  ctx.scale(0.42, 0.42);
  bush(ctx, 0, 0);
  ctx.restore();

  // Glim is glass, so its happy feeling shows inside.
  drawGlim(ctx, { x: 24, y: FY, size: S, look: [0.03, 0.04], shell: { color: 0.6 } }, t);
  icon(ctx, 'heart', 24, FY - S * 0.36, 0.45 * easeBack(seg(lt, 1.0, 1.3)));

  // Kite tells Quill the news; Quill has questions.
  drawKite(
    ctx,
    { x: 58, y: FY, size: S * 0.95, look: [0.06, 0], squash: Math.sin(lt * 14) * 0.03 * seg(lt, 0.8, 1.0) },
    t,
  );
  drawQuill(ctx, { x: 94, y: FY, size: S, look: [-0.06, 0] }, t);

  // Inch arrives at last, and Pim saved a piece for Inch.
  const PIM_X = 132;
  const INCH_X = 164;
  drawPim(ctx, { x: PIM_X, y: FY, size: S, look: [0.06, 0], squash: wobble(lt, 1.6, 0.12) }, t);
  drawInch(
    ctx,
    { x: INCH_X, y: FY, size: S * 0.8, look: [-0.06, 0.02], shell: { color: 0.2 + 0.7 * seg(lt, 2.2, 2.5) } },
    t,
  );
  // The piece Pim kept on its head in panel 2 hops over to Inch.
  const give = easeInOut(seg(lt, 1.6, 2.1));
  crumb(ctx, lerp(PIM_X, INCH_X - 24, give), lerp(FY - S - 4, FY - 6, give) - arc(give) * 16, 4.5);

  say(ctx, 46, 24, 'bang', pop(lt, 0.8, 9), [56, 44]);
  say(ctx, 96, 22, 'question', pop(lt, 1.3, 9), [94, 44]);
  say(ctx, 178, 24, 'heart', pop(lt, 2.3, 9), [166, 48]);
}

// ---- The strip ----

const PANELS = [
  { draw: panel1, text: 'Pim brings one cookie.' },
  { draw: panel2, text: 'Pim shares it. Fairly.' },
  { draw: panel3, text: 'Then Drift says hi.' },
  { draw: panel4, text: 'It all ends well.' },
] as const;

function caption(ctx: Ctx, text: string): void {
  ctx.font = `bold 10px ${FONT}`;
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(0, PH - 18, w, 18);
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, PH - 18, w, 18);
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 6, PH - 9);
}

mount({
  id: 'the-picnic',
  tag: 'Comic · The picnic',
  caption: 'One cookie, seventeen friends.',
  seconds: SECONDS,
  still: 16.5,
  draw(ctx, t) {
    ctx.fillStyle = COLOR.paper;
    ctx.fillRect(0, 0, WIDTH, ART_HEIGHT);
    const fade = 1 - seg(t, SECONDS - 0.5, SECONDS);
    PANELS.forEach((panel, i) => {
      const start = i * BEAT;
      const show = easeBack(seg(t, start, start + 0.3)) * fade;
      if (show <= 0) return;
      const x = GAP + (i % 2) * (PW + GAP);
      const y = TOP + Math.floor(i / 2) * (PH + GAP);
      ctx.save();
      ctx.translate(x + PW / 2, y + PH / 2);
      ctx.scale(show, show);
      ctx.translate(-PW / 2, -PH / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, PW, PH);
      ctx.clip();
      ctx.fillStyle = COLOR.page;
      ctx.fillRect(0, 0, PW, FY);
      ctx.fillStyle = COLOR.floor;
      ctx.fillRect(0, FY, PW, PH - FY);
      panel.draw(ctx, Math.min(t - start, BEAT), t);
      caption(ctx, panel.text);
      ctx.restore();
      ctx.strokeStyle = COLOR.ink;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(0, 0, PW, PH);
      ctx.restore();
    });
  },
});
