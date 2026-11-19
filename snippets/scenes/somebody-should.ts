// Somebody Should: a tap-to-reveal carousel. Tove is stuck in a puddle. One by one, friends come,
// look, nod, and wait for someone else to help. The adult layer: the bystander effect, group chats, meetings.
import { bubble, COLOR, easeBack, easeInOut, easeOut, hops, lerp, seg, wobble } from '../kit/draw.ts';
import { CAST, type Who } from '../kit/cast.ts';
import { mountCarousel, type Slide } from '../kit/carousel.ts';
import {
  blinkAt,
  breathe,
  ink,
  meadow,
  mirror,
  puddle,
  shown,
  speed,
  startle,
  sweat,
  toward,
  zzz,
} from '../kit/props.ts';

type Ctx = CanvasRenderingContext2D;

/** The ground line, the size of a creature, and where Tove is stuck. */
const FY = 370;
const S = 124;
const POOL: readonly [number, number] = [270, 480];
const DUSK = '#c9cfe0';

interface Onlooker {
  who: Who;
  x: number;
  y: number;
  size: number;
  /** Where it comes in from. */
  from: number;
}

/** The friends who come to look, in the order they come. One creature per look. */
const CROWD: readonly Onlooker[] = [
  { who: 'pim', x: 64, y: FY, size: S, from: -60 },
  { who: 'krit', x: 476, y: FY, size: S, from: 600 },
  { who: 'bell', x: 160, y: FY, size: S * 0.9, from: -60 },
  { who: 'quill', x: 384, y: FY, size: S * 0.9, from: 600 },
  { who: 'gulp', x: 80, y: 566, size: S * 0.88, from: -80 },
];

/** Tove, sunk to the middle in the puddle, with ripples at its waist. */
function stuckTove(ctx: Ctx, t: number, lt: number, struggle: number): void {
  const [px, py] = POOL;
  puddle(ctx, px, py, 140, 30);
  const wiggle = struggle * Math.sin(lt * 14);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 540, py + 2);
  ctx.ellipse(px, py, 138, 28, 0, 0, Math.PI);
  ctx.clip();
  CAST.tove(
    ctx,
    {
      x: px + 3 * wiggle,
      y: py + 46,
      size: 150,
      lean: 0.08 * wiggle,
      squash: breathe(t, 1.2, 0.03),
      look: [0, 0.02],
      blink: blinkAt(t, 2.6),
      shell: { tightness: 0.7 },
    },
    t,
  );
  ctx.restore();
  // Ripples around the waist.
  for (let k = 0; k < 2; k++) {
    const u = (t * 0.6 + k * 0.5) % 1;
    ctx.globalAlpha = (1 - u) * 0.7;
    ctx.beginPath();
    ctx.ellipse(px, py + 4, 60 + 46 * u, 9 + 9 * u, 0, 0, Math.PI * 2);
    ink(ctx, 1.4);
  }
  ctx.globalAlpha = 1;
  sweat(ctx, px + 52, py - 92, t, 1.3);
}

/**
 * One friend. `arrive` is the slide time it comes in (or null if it is already there),
 * and `look` is where its eyes go.
 */
function onlooker(
  ctx: Ctx,
  o: Onlooker,
  t: number,
  lt: number,
  arrive: number | null,
  look: readonly [number, number],
  extra = {},
): void {
  const walk = arrive === null ? null : hops(lt, arrive, arrive + 0.8, o.from, o.x, 3);
  const x = walk ? walk.x : o.x;
  const nod = arrive === null ? 0 : 0.12 * Math.sin(seg(lt, arrive + 1.9, arrive + 2.5) * Math.PI * 2);
  CAST[o.who](
    ctx,
    {
      x,
      y: o.y - (walk?.lift ?? 0),
      size: o.size,
      flip: o.x > 270,
      look,
      blink: blinkAt(t, 3.3, o.x * 0.01),
      squash: (walk?.squash ?? 0) + (arrive === null ? breathe(t, 2.2) : startle(lt, arrive + 0.9)) + nod,
      ...extra,
    },
    t,
  );
}

/** Where a friend looks: at Tove in the puddle. */
const atTove = (o: Onlooker): [number, number] => toward(o.x, o.y - o.size * 0.6, POOL[0], POOL[1] - 40);

/** A bubble above a friend's head. */
function think(ctx: Ctx, o: Onlooker, name: Parameters<typeof bubble>[3], s: number): void {
  const side = o.x > 270 ? -1 : 1;
  const top = o.y - o.size * 1.1;
  bubble(ctx, o.x + side * 30, top - 26, name, s * 0.8, [o.x + side * 12, top]);
}

/** Bell's hand mirror, on its stand at Bell's side. */
function handMirror(ctx: Ctx, t: number, s = 1): void {
  if (s <= 0) return;
  ctx.save();
  ctx.translate(228, FY);
  ctx.scale(s, s);
  mirror(ctx, 0, -42, 22, (t * 0.4) % 1);
  ctx.restore();
}

/** Slides 2 to 6: friend `n` comes, looks with a start, nods, and waits. */
function arrival(n: number): Slide {
  const o = CROWD[n] as Onlooker;
  const captions = [
    'Pim saw.',
    'Krit saw.',
    'Bell saw. Bell checked its reflection.',
    'Quill saw, and wondered whose job it was.',
    'Gulp saw, and waited for someone to start.',
  ];
  return {
    caption: captions[n] ?? '',
    seconds: 3,
    draw(ctx, t, w, h) {
      meadow(ctx, w, h, FY, t);
      if (n > 2) handMirror(ctx, t);
      CROWD.slice(0, n).forEach((p) => {
        onlooker(ctx, p, t, t, null, atTove(p));
      });
      stuckTove(ctx, t, t, 0.4);
      // Bell takes a moment for its reflection first.
      const vain = o.who === 'bell' && t > 2.0;
      const look =
        t < 0.9 ? ([o.x > 270 ? -0.05 : 0.05, 0] as const) : vain ? ([0.05, 0.01] as const) : atTove(o);
      if (o.who === 'bell') handMirror(ctx, t, shown(t, 1.9, 99));
      onlooker(ctx, o, t, t, 0, look);
      think(ctx, o, 'bang', shown(t, 0.9, 1.8));
      think(ctx, o, vain ? 'heart' : 'question', shown(t, 2.1, 99));
    },
  };
}

/** Each friend's neighbor, for the long look around. */
const neighbor = (k: number, step: number): Onlooker =>
  CROWD[(k + step + CROWD.length) % CROWD.length] as Onlooker;

/** A dry, cracked patch where the puddle was. */
function dryPatch(ctx: Ctx): void {
  const [px, py] = POOL;
  ctx.beginPath();
  ctx.ellipse(px, py, 140, 30, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e6d6b4';
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ink(ctx, 1.4);
  for (const [x1, y1, x2, y2] of [
    [-70, -6, -30, 4],
    [-30, 4, -10, -10],
    [10, 8, 50, -4],
    [50, -4, 80, 6],
    [-10, -10, 10, 8],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(px + x1, py + y1);
    ctx.lineTo(px + x2, py + y2);
    ink(ctx, 1.2);
  }
  ctx.globalAlpha = 1;
}

const SLIDES: Slide[] = [
  {
    caption: 'Tove is stuck.',
    seconds: 2.5,
    draw(ctx, t, w, h) {
      meadow(ctx, w, h, FY, t);
      // Tove struggles, then gives up and waits.
      stuckTove(ctx, t, t, 1 - seg(t, 1.4, 2.0));
      bubble(ctx, POOL[0] + 72, POOL[1] - 150, 'storm', shown(t, 0.8, 99) * 0.95, [
        POOL[0] + 34,
        POOL[1] - 102,
      ]);
    },
  },
  ...[0, 1, 2, 3, 4].map(arrival),
  {
    caption: 'Everyone agreed that somebody should.',
    seconds: 5.5,
    draw(ctx, t, w, h) {
      meadow(ctx, w, h, FY, t);
      stuckTove(ctx, t, t, 0.4);
      handMirror(ctx, t);
      // Each friend looks at Tove, then at a neighbor, then at another, and holds.
      CROWD.forEach((o, k) => {
        const step = t < 1.2 ? 0 : t < 2.4 ? 1 : t < 3.6 ? -1 : 2;
        const p = neighbor(k, step);
        const look = step === 0 ? atTove(o) : toward(o.x, o.y - o.size * 0.6, p.x, p.y - p.size * 0.6);
        onlooker(ctx, o, t, t, null, look);
        think(ctx, o, 'question', shown(t, 0.2 + k * 0.15, 99) * (1 + 0.15 * easeOut(seg(t, 3.8, 4.3))));
      });
    },
  },
  {
    caption: 'Inch arrived on Thursday.',
    seconds: 6,
    draw(ctx, t, w, h) {
      // Days go by: the sky dims, and the friends fall asleep where they stand.
      const night = seg(t, 0, 1.2);
      meadow(ctx, w, h, FY, t, night > 0.5 ? DUSK : COLOR.page);
      handMirror(ctx, 0);
      CROWD.forEach((o, k) => {
        onlooker(ctx, o, t, t, null, atTove(o), { blink: night, squash: breathe(t + k, 2.6, 0.04) });
        if (night >= 1) zzz(ctx, o.x + 16, o.y - o.size * 0.9, t + k * 0.7, 0.8);
      });
      const out = easeBack(seg(t, 4.2, 4.8));
      if (out <= 0) stuckTove(ctx, t, t, 0.1);
      else {
        puddle(ctx, POOL[0], POOL[1], 140, 30);
        const x = lerp(POOL[0], 272, out);
        CAST.tove(
          ctx,
          {
            x,
            y: lerp(POOL[1] + 46, 440, out),
            size: 130,
            squash: wobble(t, 4.8, 0.2),
            look: [0.05, 0],
            shell: { color: 0.5 },
          },
          t,
        );
        bubble(ctx, 318, 268, 'heart', shown(t, 5.0, 99) * 0.75, [298, 296]);
      }
      // Inch glides in, very slowly, and gives one small push.
      const ix = lerp(620, 390, easeInOut(seg(t, 0.4, 4.0)));
      const push = Math.sin(seg(t, 3.9, 4.4) * Math.PI);
      CAST.inch(
        ctx,
        {
          x: ix - 10 * push,
          y: 566,
          size: 124,
          flip: true,
          lean: -0.15 * push,
          look: [-0.05, 0],
          blink: blinkAt(t, 3.5),
        },
        t,
      );
    },
  },
  {
    caption: 'Then Echo ran in to help.',
    seconds: 3,
    draw(ctx, t, w, h) {
      meadow(ctx, w, h, FY, t);
      dryPatch(ctx);
      const run = easeOut(seg(t, 0, 0.7));
      const x = lerp(-80, POOL[0], run);
      if (run < 1) speed(ctx, x, POOL[1] - 30, 1, 60);
      const ready = seg(t, 0.8, 1.0);
      CAST.echo(
        ctx,
        {
          x,
          y: POOL[1] + 10,
          size: 146,
          lean: 0.25 * (1 - run) - 0.1 * wobble(t, 0.7, 1),
          squash: startle(t, 1.0),
          look: ready > 0 ? [Math.sin(seg(t, 1.6, 2.6) * Math.PI * 2) * 0.05, 0.02] : [0.05, 0],
          shell: { tightness: 0.3 * ready },
        },
        t,
      );
      bubble(ctx, POOL[0] + 66, POOL[1] - 176, 'bang', shown(t, 0.8, 1.6) * 0.8, [
        POOL[0] + 24,
        POOL[1] - 140,
      ]);
      bubble(ctx, POOL[0] + 66, POOL[1] - 176, 'question', shown(t, 1.8, 99) * 0.8, [
        POOL[0] + 24,
        POOL[1] - 140,
      ]);
    },
  },
];

mountCarousel({
  id: 'somebody-should',
  series: 'Somebody Should',
  title: 'The Puddle',
  label:
    'A carousel in nine slides. Slide 1: Tove is stuck in a puddle up to its middle, struggles, and gives up with a storm in its bubble. ' +
    'Slides 2 to 6: one by one, Pim, Krit, Bell, Quill, and Gulp come over, see Tove with a start, nod, and wait with a question in their bubbles. ' +
    'Bell checks its reflection. Quill wonders whose job it is. Gulp waits for someone to start. ' +
    'Slide 7: everyone agrees that somebody should help. They look at Tove, then at each other, and hold their questions. ' +
    'Slide 8: days go by and the friends fall asleep standing up. Inch arrives on Thursday, slowly, and gives one small push. Tove pops out with a heart. ' +
    'Slide 9: Echo runs in to help, a beat late as always. The puddle is now a dry, cracked patch, and Echo looks around, puzzled.',
  slides: SLIDES,
});
