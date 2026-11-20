// Kite Has News: "The Party", a tap-to-reveal carousel. Kite overhears Pim baking. Each friend passes
// the news on, and the picture in the bubble grows: a cake, a crown, a storm, a dragon, a crowned dragon.
// Cap throws a dragon party. The adult layer: rumor, the office grapevine, and how news inflates.
import { bubble, COLOR, easeBack, easeInOut, hops, icon, lerp, seg, wobble } from '../kit/draw.ts';
import { CAST, type Who } from '../kit/cast.ts';
import { mountCarousel, type Slide } from '../kit/carousel.ts';
import { blinkAt, breathe, ink, meadow, paint, shown, startle, toward } from '../kit/props.ts';

type Ctx = CanvasRenderingContext2D;
type Picture = (ctx: Ctx) => void;

const FY = 400;
const S = 150;
/** The teller stands on the left, and the listener on the right. */
const TELL = 170;
const HEAR = 380;

// ---- Props ----

/** A small round cake with pink icing and one berry. (x, y) is the middle of its base. */
function smallCake(ctx: Ctx, x: number, y: number, s = 1): void {
  const [rx, ry, tall] = [14 * s, 4 * s, 12 * s];
  ctx.beginPath();
  ctx.moveTo(x + rx, y - tall);
  ctx.lineTo(x + rx, y);
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(x - rx, y - tall);
  ctx.closePath();
  paint(ctx, COLOR.cookie, 1.6);
  ctx.beginPath();
  ctx.ellipse(x, y - tall, rx, ry, 0, 0, Math.PI * 2);
  paint(ctx, '#f9c9d6', 1.6);
  ctx.beginPath();
  ctx.arc(x, y - tall - 3 * s, 3 * s, 0, Math.PI * 2);
  paint(ctx, COLOR.berry, 1.2);
}

/** A striped party hat on a head whose top is at (x, y). `tilt` droops it. */
function partyHat(ctx: Ctx, x: number, y: number, s = 1, tilt = 0): void {
  ctx.save();
  ctx.translate(x, y + 2);
  ctx.rotate(tilt);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.lineTo(0, -34);
  ctx.lineTo(13, 0);
  ctx.closePath();
  paint(ctx, COLOR.glow, 2);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = COLOR.berry;
  ctx.globalAlpha = 0.55;
  for (const k of [-24, -12]) {
    ctx.beginPath();
    ctx.moveTo(-20, k);
    ctx.lineTo(20, k + 8);
    ctx.lineTo(20, k + 14);
    ctx.lineTo(-20, k + 6);
    ctx.fill();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, -36, 4.5, 0, Math.PI * 2);
  paint(ctx, COLOR.accent, 1.6);
  ctx.restore();
}

/** Flags on a string across the top of the slide. `drop` lowers them in (0 to 1). */
function bunting(ctx: Ctx, w: number, drop: number, t: number): void {
  if (drop <= 0) return;
  const y0 = lerp(-40, 70, easeBack(drop));
  ctx.beginPath();
  ctx.moveTo(-10, y0 - 20);
  ctx.quadraticCurveTo(w / 2, y0 + 40, w + 10, y0 - 20);
  ink(ctx, 1.8);
  const colors = [COLOR.berry, COLOR.glow, COLOR.leaf, COLOR.water, COLOR.blush];
  for (let k = 1; k < 10; k++) {
    const u = k / 10;
    const x = lerp(-10, w + 10, u);
    const y = (1 - u) * (1 - u) * (y0 - 20) + 2 * u * (1 - u) * (y0 + 40) + u * u * (y0 - 20);
    const sway = 0.08 * Math.sin(t * 2 + k);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(11, 0);
    ctx.lineTo(0, 22);
    ctx.closePath();
    paint(ctx, colors[k % colors.length] ?? COLOR.glow, 1.6);
    ctx.restore();
  }
}

/** Confetti that falls and loops each 3 seconds. */
function confetti(ctx: Ctx, w: number, h: number, t: number, amount = 1): void {
  const colors = [COLOR.berry, COLOR.accent, COLOR.leaf, COLOR.water, COLOR.glow];
  for (let k = 0; k < 26 * amount; k++) {
    const x = (k * 83.7) % w;
    const y = ((t / 3 + k * 0.173) % 1) * h;
    ctx.save();
    ctx.translate(x + 8 * Math.sin(t * 2 + k), y);
    ctx.rotate(t * 3 + k);
    ctx.fillStyle = colors[k % colors.length] ?? COLOR.glow;
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
}

// ---- The pictures in the bubbles ----

const CAKE: Picture = (ctx) => {
  smallCake(ctx, 0, 8, 1);
};
const CROWN: Picture = (ctx) => {
  icon(ctx, 'crown', 0, 0);
};
const STORM: Picture = (ctx) => {
  icon(ctx, 'storm', 0, -4);
};
const DRAGON: Picture = (ctx) => {
  icon(ctx, 'monster', 0, 0);
};
const CROWNED: Picture = (ctx) => {
  icon(ctx, 'monster', 0, 5, 0.85);
  icon(ctx, 'crown', 0, -13, 0.55);
};

/** Where the top of each creature's head is, as a part of its size. */
const TOP: Partial<Record<Who, number>> = {
  kite: 0.96,
  gulp: 0.9,
  cap: 1.1,
  krit: 0.95,
  tove: 0.86,
  bell: 0.97,
  pim: 0.96,
};
/** Sizes that make the cast look about the same height in a two-shot. */
const TWO: Partial<Record<Who, number>> = { gulp: 0.78, cap: 0.86 };
const two = (who: Who): number => S * (TWO[who] ?? 1);

/** A bubble over a creature at x, which leans toward the middle. */
function say(ctx: Ctx, who: Who, x: number, size: number, picture: Picture, s: number): void {
  const top = FY - size * (TOP[who] ?? 0.9);
  const side = x < 270 ? -1 : 1;
  bubble(ctx, x + side * 20, top - 40 * Math.max(1, s), picture, s, [x + side * 6, top - 4]);
}

/** Three small curves from the teller's mouth toward the listener's ear: a whisper. */
function whisperLines(ctx: Ctx, u: number): void {
  if (u <= 0 || u >= 1) return;
  for (let k = 0; k < 3; k++) {
    const a = seg(u, k * 0.15, k * 0.15 + 0.4) * (1 - seg(u, 0.75, 1));
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(TELL + 64 + k * 14, FY - 90, 10 + k * 6, -0.6, 0.6);
    ink(ctx, 2);
  }
  ctx.globalAlpha = 1;
}

/** One link in the chain: the teller whispers, its picture shrinks, and the listener's grows. */
function whisper(
  caption: string,
  teller: Who,
  listener: Who,
  told: Picture,
  heard: Picture,
  grow: number,
  onHear?: (ctx: Ctx, t: number) => void,
): Slide {
  return {
    caption,
    seconds: 3.4,
    draw(ctx, t, w, h) {
      meadow(ctx, w, h, FY, t);
      const lean = easeInOut(seg(t, 0.2, 0.6)) * (1 - easeInOut(seg(t, 1.6, 2.0)));
      CAST[teller](
        ctx,
        {
          x: TELL + 14 * lean,
          y: FY,
          size: two(teller),
          lean: 0.22 * lean,
          squash: breathe(t),
          look: toward(TELL, FY - 100, HEAR, FY - 100),
          blink: blinkAt(t, 3.2),
        },
        t,
      );
      const heardAt = 1.4;
      CAST[listener](
        ctx,
        {
          x: HEAR,
          y: FY,
          size: two(listener),
          squash: t < heardAt ? breathe(t) : startle(t, heardAt) + breathe(t, 2, 0.02),
          look: t < heardAt ? [-0.02, 0] : [0.02, -0.03],
          blink: blinkAt(t, 2.9, 1),
          shell: { tightness: 0.4 * seg(t, heardAt, heardAt + 0.3) },
        },
        t,
      );
      whisperLines(ctx, seg(t, 0.5, 1.6));
      say(ctx, teller, TELL, two(teller), told, 0.9 * (1 - seg(t, 0.9, 1.2)));
      say(ctx, listener, HEAR, two(listener), heard, easeBack(seg(t, heardAt + 0.1, heardAt + 0.5)) * grow);
      onHear?.(ctx, t);
    },
  };
}

// ---- The crowd at the party ----

const CROWD: readonly { who: Who; x: number; y: number; size: number }[] = [
  { who: 'krit', x: 78, y: FY, size: 120 },
  { who: 'tove', x: 186, y: FY, size: 112 },
  { who: 'cap', x: 300, y: FY, size: 130 },
  { who: 'bell', x: 412, y: FY, size: 116 },
  { who: 'kite', x: 486, y: 520, size: 110 },
  { who: 'gulp', x: 110, y: 530, size: 112 },
];

function party(
  ctx: Ctx,
  t: number,
  w: number,
  h: number,
  look: (i: number) => readonly [number, number],
  droop = 0,
): void {
  meadow(ctx, w, h, FY, t);
  bunting(ctx, w, 1, t);
  CROWD.forEach((c, i) => {
    CAST[c.who](
      ctx,
      {
        x: c.x,
        y: c.y,
        size: c.size,
        squash: breathe(t + i * 0.4, 1.6, 0.03),
        look: look(i),
        blink: blinkAt(t, 3, i * 0.7),
      },
      t,
    );
    partyHat(
      ctx,
      c.x + (c.who === 'kite' ? 0.21 * c.size : 0),
      c.y - c.size * (TOP[c.who] ?? 0.9),
      0.9,
      (i % 2 ? 0.15 : -0.15) + droop * (i % 2 ? 0.5 : -0.5),
    );
  });
}

const SLIDES: Slide[] = [
  {
    caption: 'Kite heard some news.',
    seconds: 3,
    draw(ctx, t, w, h) {
      meadow(ctx, w, h, FY, t);
      // Far off on the hill, Pim bakes something small.
      CAST.pim(ctx, { x: 456, y: FY - 6, size: 56, look: [-0.03, 0], squash: breathe(t, 1.4) }, t);
      smallCake(ctx, 492, FY - 4, 0.7);
      const peek = easeInOut(seg(t, 0.3, 0.9));
      CAST.kite(
        ctx,
        {
          x: lerp(160, 200, peek),
          y: FY + 60,
          size: S * 1.1,
          lean: 0.18 * peek,
          look: [0.05, 0.01],
          blink: blinkAt(t, 3.4),
          squash: wobble(t, 1.3, 0.12),
        },
        t,
      );
      say(ctx, 'kite', 200, S * 1.1, CAKE, shown(t, 1.3, 99) * 0.9);
    },
  },
  whisper('Kite told Krit.', 'kite', 'krit', CAKE, CROWN, 1),
  whisper('Krit told Tove.', 'krit', 'tove', CROWN, STORM, 1.1),
  whisper('Tove told Gulp.', 'tove', 'gulp', STORM, DRAGON, 1.25),
  whisper('Gulp told Bell.', 'gulp', 'bell', DRAGON, CROWNED, 1.45),
  whisper('Bell told Cap. Cap planned a party.', 'bell', 'cap', CROWNED, CROWNED, 1.7, (ctx, t) => {
    bunting(ctx, 540, seg(t, 2.2, 2.8), t);
    if (t > 2.3) partyHat(ctx, HEAR, FY - two('cap') * 1.1, 1.1 * easeBack(seg(t, 2.3, 2.7)), 0.1);
  }),
  {
    caption: 'Everyone came to meet the dragon.',
    seconds: 3.5,
    draw(ctx, t, w, h) {
      party(ctx, t, w, h, () => [0, 0.05]);
      confetti(ctx, w, h, t);
      // A big empty spot in the sky where the dragon should be.
      bubble(ctx, 270, 170, CROWNED, shown(t, 0.6, 99) * 1.9, [254, 200]);
    },
  },
  {
    caption: 'It was a small cake.',
    seconds: 4.5,
    draw(ctx, t, w, h) {
      // Pim hops in with the cake. Everyone looks down, and the hats droop.
      const walk = hops(t, 0.2, 1.4, -60, 270, 4);
      const seen = seg(t, 1.6, 1.9);
      party(
        ctx,
        t,
        w,
        h,
        (i) => {
          const c = CROWD[i] ?? { x: 0, y: 0, size: 0 };
          return seen > 0 ? toward(c.x, c.y - c.size * 0.6, 270, 520) : [0, 0.05];
        },
        seg(t, 2.6, 3.4),
      );
      confetti(ctx, w, h, t, 1 - seg(t, 2.4, 3.2));
      CAST.pim(
        ctx,
        {
          x: walk.x,
          y: 560 - walk.lift,
          size: 92,
          squash: walk.squash + wobble(t, 1.4, 0.15),
          look: [0.02, 0.03],
          blink: blinkAt(t, 3.1),
        },
        t,
      );
      smallCake(ctx, walk.x + 52, 560 - walk.lift, 0.9);
      bubble(ctx, walk.x - 6, 420, 'heart', shown(t, 1.6, 99) * 0.7, [walk.x - 2, 450]);
      // Gulp, as always, checks.
      const lick = Math.sin(seg(t, 3.6, 4.1) * Math.PI);
      if (lick > 0) {
        ctx.beginPath();
        ctx.moveTo(150, 470);
        ctx.lineTo(lerp(150, 300, lick), lerp(470, 545, lick));
        ctx.strokeStyle = COLOR.berry;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    },
  },
];

mountCarousel({
  id: 'kite-has-news-the-party',
  series: 'Kite Has News',
  title: 'The Party',
  label:
    'A carousel in eight slides. Slide 1: Kite peeks over the hill and sees Pim, far off, baking one small cake. A cake appears in Kite’s bubble. ' +
    'Slide 2: Kite whispers to Krit, and the cake in the bubble becomes a crown. ' +
    'Slide 3: Krit whispers to Tove, and the crown becomes a storm. ' +
    'Slide 4: Tove whispers to Gulp, and the storm becomes a dragon. ' +
    'Slide 5: Gulp whispers to Bell, and the dragon gets a crown. Each bubble is bigger than the last. ' +
    'Slide 6: Bell tells Cap. Cap puts on a party hat, and party flags drop in. ' +
    'Slide 7: everyone comes to meet the dragon, in party hats under the flags and confetti, and looks up at a huge bubble of a crowned dragon. ' +
    'Slide 8: Pim hops in with one small cake and a heart. Everyone looks down at it, and the party hats droop. Gulp tries a lick. ' +
    'Caption: It was a small cake.',
  slides: SLIDES,
});
