// Props and small motions that many comic scenes share: ground, crumbs, sweat, sleep, weather, and food.
// Each prop is drawn in ink on the toybox palette, at about the size of a creature's head.
import { arc, COLOR, easeBack, seg, wobble, type Pose } from './draw.ts';

type Ctx = CanvasRenderingContext2D;
export type Point = readonly [number, number];
export type Draw = (ctx: Ctx, pose: Pose, t: number) => void;

/** The corners of a rectangle, clockwise. */
export const rect = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Strokes the current path in ink. */
export function ink(ctx: Ctx, width = 2): void {
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Fills the current path, then strokes it in ink. */
export function paint(ctx: Ctx, color: string, width = 2): void {
  ctx.fillStyle = color;
  ctx.fill();
  ink(ctx, width);
}

/** Sky over floor, with the floor line at `horizon`. `sky` changes the sky color, for dusk and night. */
export function ground(ctx: Ctx, w: number, h: number, horizon: number, sky: string = COLOR.page): void {
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.globalAlpha = 0.35;
  ink(ctx, 1.5);
  ctx.globalAlpha = 1;
}

/**
 * The meadow: sky, a soft far hill, the floor, and a few grass tufts that sway.
 * The tufts sit at fixed places, so every frame matches.
 */
export function meadow(
  ctx: Ctx,
  w: number,
  h: number,
  horizon: number,
  t = 0,
  sky: string = COLOR.page,
): void {
  ground(ctx, w, h, horizon, sky);
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.bezierCurveTo(w * 0.25, horizon - 34, w * 0.55, horizon - 6, w * 0.8, horizon - 22);
  ctx.quadraticCurveTo(w * 0.92, horizon - 28, w, horizon - 14);
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fillStyle = '#dbe8d4';
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ink(ctx, 1.4);
  ctx.globalAlpha = 1;
  for (let k = 0; k < 5; k++) {
    const x = ((k * 0.23 + 0.07) % 1) * w;
    const y = horizon + 10 + ((k * 37) % (h - horizon - 16));
    const sway = 1.5 * Math.sin(t * 1.5 + k);
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.quadraticCurveTo(x - 5, y - 6, x - 7 + sway, y - 9);
    ctx.moveTo(x, y);
    ctx.lineTo(x + sway, y - 11);
    ctx.moveTo(x + 5, y);
    ctx.quadraticCurveTo(x + 5, y - 6, x + 7 + sway, y - 8);
    ctx.globalAlpha = 0.45;
    ink(ctx, 1.4);
    ctx.globalAlpha = 1;
  }
}

/** Bubble or prop scale over [a, b]: a pop in, and a quick shrink out. */
export const shown = (t: number, a: number, b: number): number =>
  easeBack(seg(t, a, a + 0.25)) * (1 - seg(t, b, b + 0.15));

/** The squash for a quick start of surprise at `t0`: a stretch, then a wobble. */
export const startle = (t: number, t0: number): number =>
  -0.18 * arc(seg(t, t0, t0 + 0.25)) + wobble(t, t0 + 0.25, 0.14);

/** A look in rig units from an eye at (x, y) toward (tx, ty), in pixels. */
export function toward(x: number, y: number, tx: number, ty: number, amount = 0.045): [number, number] {
  const d = Math.hypot(tx - x, ty - y) || 1;
  return [((tx - x) / d) * amount, (-(ty - y) / d) * amount];
}

/** A small creature for inside a bubble. */
export const mini =
  (draw: Draw, t: number, flip = false) =>
  (ctx: Ctx): void => {
    draw(ctx, { x: 0, y: 12, size: 24, flip }, t);
  };

/** A slow breath for a creature that stands still: a small squash that loops each `period` seconds. */
export const breathe = (t: number, period = 2, amount = 0.03): number =>
  amount * Math.sin((t / period) * Math.PI * 2);

/** A blink that closes the eyes for a moment once each `period` seconds, at `offset`. */
export const blinkAt = (t: number, period = 3, offset = 0): number => {
  const u = (((t + offset) % period) + period) % period;
  return u < 0.12 ? Math.sin((u / 0.12) * Math.PI) : 0;
};

export function crumb(ctx: Ctx, x: number, y: number, r = 3): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  paint(ctx, COLOR.cookie, 1.2);
}

/** A berry, `r` pixels wide, with a small leaf. */
export function berry(ctx: Ctx, x: number, y: number, r = 6): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  paint(ctx, COLOR.berry, 1.6);
  ctx.beginPath();
  ctx.ellipse(x + r * 0.3, y - r * 1.05, r * 0.55, r * 0.28, -0.5, 0, Math.PI * 2);
  paint(ctx, COLOR.leaf, 1.2);
  ctx.fillStyle = COLOR.paper;
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.3, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

/** A leaf `len` pixels long, turned by `a` radians. It points right when a is 0. */
export function leaf(ctx: Ctx, x: number, y: number, len: number, a = 0, color: string = COLOR.leaf): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.quadraticCurveTo(0, -len * 0.42, len / 2, 0);
  ctx.quadraticCurveTo(0, len * 0.42, -len / 2, 0);
  paint(ctx, color, 1.6);
  ctx.beginPath();
  ctx.moveTo(-len / 2, 0);
  ctx.lineTo(len * 0.35, 0);
  ink(ctx, 1);
  ctx.restore();
}

/** A leaf worn as a hat on a head whose top is at (x, y). */
export function leafHat(ctx: Ctx, x: number, y: number, s = 1): void {
  leaf(ctx, x, y - 3 * s, 34 * s, -0.12);
  ctx.beginPath();
  ctx.moveTo(x + 15 * s, y - 5 * s);
  ctx.quadraticCurveTo(x + 22 * s, y - 14 * s, x + 18 * s, y - 20 * s);
  ink(ctx, 1.4);
}

/** A sun with short rays that turn slowly. */
export function sun(ctx: Ctx, x: number, y: number, r: number, t = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.3);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
    ctx.lineTo(Math.cos(a) * r * 1.6, Math.sin(a) * r * 1.6);
    ink(ctx, 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  paint(ctx, COLOR.glow);
}

/** A full moon with two soft craters. */
export function moon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  paint(ctx, '#f6f1dc');
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = COLOR.ink;
  for (const [dx, dy, cr] of [
    [-0.3, -0.2, 0.2],
    [0.25, 0.3, 0.14],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, cr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A small star that twinkles. */
export function twinkle(ctx: Ctx, x: number, y: number, t: number, phase = 0): void {
  const s = 2.5 + 1.5 * Math.sin(t * 3 + phase);
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s);
  ctx.strokeStyle = COLOR.glow;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

/** Rain over the box (0, 0, w, h). The drops loop each second. `amount` thins it out. */
export function rain(ctx: Ctx, w: number, h: number, t: number, amount = 1): void {
  ctx.strokeStyle = '#7fa9c4';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  const count = Math.round(28 * amount);
  for (let k = 0; k < count; k++) {
    const x = ((k * 97.3) % w) + 6;
    const y = (((t + k * 0.137) % 1) * (h + 20) - 10 + k * 13) % (h + 20);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 2, y + 8);
    ctx.stroke();
  }
}

/** A flat puddle centered on (x, y). */
export function puddle(ctx: Ctx, x: number, y: number, rx: number, ry = rx * 0.22): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  paint(ctx, COLOR.water, 1.6);
}

/** A drop of sweat that slides down from (x, y) once each `period` seconds. */
export function sweat(ctx: Ctx, x: number, y: number, t: number, period = 1.5): void {
  const u = (t % period) / period;
  if (u > 0.5) return;
  const v = u * 2;
  const dy = y + v * 14;
  ctx.beginPath();
  ctx.moveTo(x, dy - 6);
  ctx.quadraticCurveTo(x + 4, dy, x, dy + 2);
  ctx.quadraticCurveTo(x - 4, dy, x, dy - 6);
  ctx.globalAlpha = 1 - v * 0.6;
  paint(ctx, COLOR.water, 1.2);
  ctx.globalAlpha = 1;
}

/** Little z letters float up from (x, y) while someone sleeps. */
export function zzz(ctx: Ctx, x: number, y: number, t: number, big = 1): void {
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let k = 0; k < 3; k++) {
    const u = (t / 3 + k / 3) % 1;
    ctx.globalAlpha = Math.sin(Math.PI * u) * 0.7;
    ctx.font = `bold ${String((9 + 9 * u) * big)}px system-ui, sans-serif`;
    ctx.fillText('z', x + 26 * u * big, y - 40 * u * big);
  }
  ctx.globalAlpha = 1;
}

/** Short speed lines behind a fast mover at (x, y) that moves toward +x when `dir` is 1. */
export function speed(ctx: Ctx, x: number, y: number, dir: 1 | -1, size = 30): void {
  ctx.globalAlpha = 0.5;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(x - dir * size * 0.6, y - size * 0.5 + k * size * 0.35);
    ctx.lineTo(x - dir * size * (1.2 + 0.25 * k), y - size * 0.5 + k * size * 0.35);
    ink(ctx, 2);
  }
  ctx.globalAlpha = 1;
}

/** A small butterfly whose wings flap. `s` scales it. */
export function butterfly(
  ctx: Ctx,
  x: number,
  y: number,
  t: number,
  s = 1,
  color: string = COLOR.glow,
): void {
  const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 9));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side * flap, 1);
    ctx.beginPath();
    ctx.ellipse(6, -4, 7, 5, -0.5, 0, Math.PI * 2);
    paint(ctx, color, 1.3);
    ctx.beginPath();
    ctx.ellipse(5, 4, 4.5, 3.5, 0.5, 0, Math.PI * 2);
    paint(ctx, color, 1.3);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(0, 7);
  ink(ctx, 2.2);
  ctx.restore();
}

/** A cookie `r` pixels in radius. `bite` takes a round bite out of its right side (0 to 1). */
export function cookie(ctx: Ctx, x: number, y: number, r = 10, bite = 0): void {
  ctx.save();
  if (bite > 0) {
    // Cut the bite out: clip to everything but one circle at the right edge.
    ctx.beginPath();
    ctx.rect(x - 2 * r, y - 2 * r, 4 * r, 4 * r);
    ctx.arc(x + r * 1.05, y - r * 0.2, r * 0.7 * bite, 0, Math.PI * 2);
    ctx.clip('evenodd');
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  paint(ctx, COLOR.cookie, 1.8);
  ctx.fillStyle = COLOR.ink;
  for (const [dx, dy] of [
    [-0.4, -0.25],
    [0.3, -0.1],
    [-0.1, 0.4],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A stack of `n` cookies on (x, y), seen from the side, that leans by `lean` pixels at the top. */
export function cookieStack(ctx: Ctx, x: number, y: number, n: number, lean = 0, r = 12): void {
  for (let k = 0; k < n; k++) {
    const u = n > 1 ? k / (n - 1) : 0;
    const cx = x + lean * u * u;
    const cy = y - 4 - k * 6.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, 4.2, 0, 0, Math.PI * 2);
    paint(ctx, COLOR.cookie, 1.6);
  }
}

/** A hand mirror on a stand, with its glass at (x, y). `glint` slides a shine across it. */
export function mirror(ctx: Ctx, x: number, y: number, r: number, glint = 0): void {
  ctx.beginPath();
  ctx.moveTo(x, y + r);
  ctx.lineTo(x, y + r * 1.9);
  ctx.moveTo(x - r * 0.5, y + r * 1.9);
  ctx.lineTo(x + r * 0.5, y + r * 1.9);
  ink(ctx, 3);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
  paint(ctx, COLOR.wood, 2.4);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.66, r * 0.86, 0, 0, Math.PI * 2);
  paint(ctx, COLOR.glass, 1.6);
  if (glint > 0) {
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = COLOR.paper;
    ctx.translate(x - r + glint * r * 2, y);
    ctx.rotate(0.5);
    ctx.fillRect(-3, -r * 1.2, 6, r * 2.4);
    ctx.restore();
  }
}

/** A round tree with a trunk, standing on the floor at (x, floor). `sway` moves the crown. */
export function tree(ctx: Ctx, x: number, floor: number, s = 1, sway = 0): void {
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, floor);
  ctx.quadraticCurveTo(x - 6 * s, floor - 40 * s, x - 7 * s, floor - 80 * s);
  ctx.lineTo(x + 7 * s, floor - 80 * s);
  ctx.quadraticCurveTo(x + 6 * s, floor - 40 * s, x + 9 * s, floor);
  paint(ctx, COLOR.wood);
  const crown: [number, number, number][] = [
    [-34, -96, 30],
    [0, -122, 38],
    [34, -96, 30],
    [-14, -84, 24],
    [16, -84, 24],
  ];
  for (const pass of ['stroke', 'fill'] as const)
    crown.forEach(([dx, dy, r], i) => {
      ctx.beginPath();
      ctx.arc(x + (dx + sway * (1 + (i % 2))) * s, floor + dy * s, r * s, 0, Math.PI * 2);
      if (pass === 'stroke') ink(ctx, 4.4);
      else {
        ctx.fillStyle = COLOR.leaf;
        ctx.fill();
      }
    });
}

/** A small sparkle that pops at `t0` and fades over half a second. */
export function sparkle(ctx: Ctx, x: number, y: number, t: number, t0: number): void {
  const u = seg(t, t0, t0 + 0.5);
  if (u <= 0 || u >= 1) return;
  ctx.globalAlpha = 1 - u;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 6 * u, y + Math.sin(a) * 6 * u);
    ctx.lineTo(x + Math.cos(a) * (10 + 10 * u), y + Math.sin(a) * (10 + 10 * u));
    ctx.strokeStyle = COLOR.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** The big tree, with roots that spread on the floor. `crown` colors the leaves. */
export function bigTree(
  ctx: Ctx,
  x: number,
  floor: number,
  s: number,
  crown: string = COLOR.leaf,
  sway = 0,
): void {
  ctx.beginPath();
  ctx.moveTo(x - 70 * s, floor);
  ctx.quadraticCurveTo(x - 30 * s, floor - 6 * s, x - 16 * s, floor - 30 * s);
  ctx.lineTo(x - 12 * s, floor - 120 * s);
  ctx.lineTo(x + 12 * s, floor - 120 * s);
  ctx.lineTo(x + 16 * s, floor - 30 * s);
  ctx.quadraticCurveTo(x + 30 * s, floor - 6 * s, x + 70 * s, floor);
  ctx.closePath();
  paint(ctx, COLOR.wood, 2.4);
  const clumps: [number, number, number][] = [
    [-54, -134, 38],
    [0, -170, 50],
    [54, -134, 38],
    [-26, -118, 30],
    [28, -116, 30],
    [0, -136, 36],
  ];
  for (const pass of ['stroke', 'fill'] as const)
    clumps.forEach(([dx, dy, r], i) => {
      ctx.beginPath();
      ctx.arc(x + (dx + sway * (i % 2 ? 1 : -1)) * s, floor + dy * s, r * s, 0, Math.PI * 2);
      if (pass === 'stroke') ink(ctx, 4.4);
      else {
        ctx.fillStyle = crown;
        ctx.fill();
      }
    });
}
