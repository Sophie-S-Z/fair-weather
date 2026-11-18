// Drawing helpers for the snippets: the toybox creatures, bubbles, icons, and timing curves.
import { boilFrameAt, deform } from '../../src/render/line/deform.ts';
import { bodyColor, fillOutline } from '../../src/render/line/fill.ts';
import { RIG_POINTS, type Rig } from '../../src/render/line/rig.ts';
import type { Shell } from '../../src/render/line/shell.ts';
import { buildStrip, taperedWidth } from '../../src/render/line/strip.ts';
import { PALETTE } from '../../src/render/palette.ts';
import { CAST, type Temper } from '../../src/toy/cast.ts';
import type { CastId } from '../../src/toy/types.ts';

type Ctx = CanvasRenderingContext2D;

/** A 0xRRGGBB color as a CSS color. */
export const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export const COLOR = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, css(v)])) as Record<
  keyof typeof PALETTE,
  string
>;

// ---- Timing (Ammer's guide: few keys, uneven spacing, a bit of overshoot) ----

export const clamp01 = (u: number): number => Math.min(1, Math.max(0, u));
export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
/** Progress through the window [a, b] of t, clamped to 0..1. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
export const easeInOut = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
export const easeOut = (u: number): number => 1 - (1 - u) ** 3;
export const easeIn = (u: number): number => u ** 3;
/** Ease out past the end, then settle back: a pop. */
export const easeBack = (u: number): number => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2;
/** 0 at both ends and 1 in the middle: the arc of a hop. */
export const arc = (u: number): number => Math.sin(Math.PI * clamp01(u));
/**
 * A walk of `hops` small hops from x0 to x1 over the window [a, b] of t.
 * Returns the x, the lift above the floor, and the squash of each landing.
 */
export function hops(t: number, a: number, b: number, x0: number, x1: number, count: number) {
  const u = seg(t, a, b);
  const phase = (u * count) % 1;
  const moving = u > 0 && u < 1;
  return {
    x: lerp(x0, x1, easeInOut(u)),
    lift: moving ? arc(phase) * 16 : 0,
    squash: moving ? 0.12 * Math.cos(Math.PI * 2 * phase) * (1 - arc(phase)) - 0.06 * arc(phase) : 0,
  };
}

/** A damped wobble that starts at `t0`, for the squash after a landing or a bump. */
export const wobble = (t: number, t0: number, amount = 0.25): number =>
  t < t0 ? 0 : amount * Math.exp(-6 * (t - t0)) * Math.cos(18 * (t - t0));

// ---- Creatures ----

/** Ink width in rig units, as in the toybox line view. */
const INK_WIDTH = 0.05;
const EYE = 0.026;
const BLUSH = 0.038;
const GRAY = 0xd6d4cf;
const taper = taperedWidth(INK_WIDTH, RIG_POINTS);

export interface Pose {
  /** Base center, in pixels. */
  x: number;
  y: number;
  /** Height in pixels. */
  size?: number;
  /** Positive flattens, negative stretches; the width changes the other way. */
  squash?: number;
  /** Sideways shear of the top: positive leans right. */
  lean?: number;
  /** Mirror left to right. */
  flip?: boolean;
  /** Changes to the creature's resting mood. */
  shell?: Partial<Shell>;
  /** Where the eyes look, as an offset in rig units. */
  look?: readonly [number, number];
  /** 0 open, 1 shut. */
  blink?: number;
  alpha?: number;
  /** 0 shows the creature's own colors, 1 turns it gray. */
  gray?: number;
  /** Body color; the creature's own tint by default. */
  fill?: string;
}

const points = new Float32Array(RIG_POINTS * 2);
const body = new Float32Array(RIG_POINTS * 2);
const strip = new Float32Array(RIG_POINTS * 4);

/** The part of a temper that sets how a creature looks. */
export type Look = Pick<Temper, 'rest' | 'scale' | 'tint'>;

/**
 * One toybox creature, drawn from its rig with the toybox deform (mood and the 12 fps boil).
 * The rig JSON comes from `content/rigs`, which the content tests already check.
 * A creature outside the toybox cast gives its own `look`.
 */
export function creature(json: unknown, look?: Look): (ctx: Ctx, pose: Pose, t: number) => void {
  const rig = json as Rig;
  const temper = look ?? (rig.id in CAST ? CAST[rig.id as CastId] : undefined);
  const rest: Shell = temper?.rest ?? { tightness: 0, bristle: 0, color: 0, softness: 0.3 };
  const tint = temper?.tint ?? PALETTE.paper;

  return (ctx, pose, t) => {
    const size = (pose.size ?? 80) * (temper?.scale ?? 1);
    const squash = pose.squash ?? 0;
    const sy = 1 - squash;
    const sx = (pose.flip ? -1 : 1) * (1 + squash * 0.7);
    const lean = pose.lean ?? 0;
    const at = (rx: number, ry: number): [number, number] => [
      pose.x + (rx * sx + lean * ry) * size,
      pose.y - ry * sy * size,
    ];

    // As in the toybox, the body fill skips the bristle and the boil, so its shape stays steady.
    const shell = { ...rest, ...pose.shell };
    deform(rig, shell, boilFrameAt(t, false), points);
    deform(rig, { ...shell, bristle: 0 }, 0, body);
    for (const p of [points, body]) {
      for (let i = 0; i < RIG_POINTS; i++) {
        const [x, y] = at(p[2 * i] ?? 0, p[2 * i + 1] ?? 0);
        p[2 * i] = x;
        p[2 * i + 1] = y;
      }
    }

    ctx.save();
    ctx.globalAlpha *= pose.alpha ?? 1;
    const alpha = ctx.globalAlpha;

    // Body fill: the outline with its curls cut out.
    const outline = fillOutline(body);
    ctx.beginPath();
    for (let k = 0; k < outline.length; k += 2) ctx.lineTo(outline[k] ?? 0, outline[k + 1] ?? 0);
    const gray = clamp01(pose.gray ?? 0);
    ctx.fillStyle = pose.fill ?? css(bodyColor(tint, GRAY, gray));
    ctx.fill();

    // The ink line: a tapered strip, filled as one polygon.
    buildStrip(points, (i) => taper(i) * size, strip);
    ctx.beginPath();
    for (let i = 0; i < RIG_POINTS; i++) ctx.lineTo(strip[4 * i] ?? 0, strip[4 * i + 1] ?? 0);
    for (let i = RIG_POINTS - 1; i >= 0; i--) ctx.lineTo(strip[4 * i + 2] ?? 0, strip[4 * i + 3] ?? 0);
    ctx.fillStyle = COLOR.ink;
    ctx.fill();

    // Face: the blushes mirror across the eyes, and the eyes shift with the look.
    const { eyeL, eyeR, blush } = rig.markers;
    const [lx, ly] = pose.look ?? [0, 0];
    ctx.fillStyle = COLOR.blush;
    ctx.globalAlpha *= 1 - gray;
    for (const bx of [blush[0], eyeL[0] + eyeR[0] - blush[0]]) {
      const [x, y] = at(bx + lx * 0.5, blush[1] + ly * 0.5);
      ctx.beginPath();
      ctx.ellipse(x, y, BLUSH * size, BLUSH * size * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLOR.ink;
    const open = 1 - clamp01(pose.blink ?? 0) * 0.85;
    for (const e of [eyeL, eyeR]) {
      const [x, y] = at(e[0] + lx, e[1] + ly);
      ctx.beginPath();
      ctx.ellipse(x, y, EYE * size, EYE * size * open, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
}

// ---- Bubbles and icons ----

export type Icon =
  'cookie' | 'crown' | 'storm' | 'monster' | 'heart' | 'question' | 'bang' | 'star' | 'flower' | 'circle';

const stroke = (ctx: Ctx, width = 2.2): void => {
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLOR.ink;
  ctx.stroke();
};

const paint = (ctx: Ctx, color: string): void => {
  ctx.fillStyle = color;
  ctx.fill();
  stroke(ctx);
};

/** A closed shape through points around (0, 0), for stars and spikes. */
const ring = (ctx: Ctx, n: number, r: (k: number) => number): void => {
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r(k), Math.sin(a) * r(k));
  }
  ctx.closePath();
};

/** Icons are drawn about 28 pixels across, centered on (0, 0). */
const ICONS: Record<Icon, (ctx: Ctx) => void> = {
  cookie: (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    paint(ctx, COLOR.cookie);
    ctx.fillStyle = COLOR.ink;
    for (const [x, y] of [
      [-5, -3],
      [4, -1],
      [-1, 5],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  crown: (ctx) => {
    ctx.beginPath();
    for (const [x, y] of [
      [-13, 8],
      [-13, -6],
      [-6.5, 1],
      [0, -10],
      [6.5, 1],
      [13, -6],
      [13, 8],
    ] as const)
      ctx.lineTo(x, y);
    ctx.closePath();
    paint(ctx, COLOR.glow);
  },
  storm: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.arc(-7, 0, 6, Math.PI * 0.6, Math.PI * 1.5);
    ctx.arc(1, -4, 8, Math.PI * 1.1, Math.PI * 1.95);
    ctx.arc(8, 1, 5.5, Math.PI * 1.4, Math.PI * 0.45);
    ctx.closePath();
    paint(ctx, '#c9ced6');
    ctx.beginPath();
    for (const [x, y] of [
      [1, 7],
      [-3, 13],
      [2, 13],
      [-2, 19],
    ] as const)
      ctx.lineTo(x, y);
    stroke(ctx, 2);
  },
  monster: (ctx) => {
    ring(ctx, 18, (k) => (k % 2 === 0 ? 14 : 10));
    paint(ctx, COLOR.berry);
    ctx.fillStyle = COLOR.paper;
    for (const x of [-4.5, 4.5]) {
      ctx.beginPath();
      ctx.arc(x, -3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLOR.ink;
    for (const x of [-4, 5]) {
      ctx.beginPath();
      ctx.arc(x, -2.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    for (let k = 0; k <= 6; k++) ctx.lineTo(-6 + k * 2, k % 2 === 0 ? 4 : 7);
    ctx.fillStyle = COLOR.paper;
    ctx.fill();
    stroke(ctx, 1.6);
  },
  heart: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 11);
    ctx.bezierCurveTo(-16, 0, -11, -14, 0, -5);
    ctx.bezierCurveTo(11, -14, 16, 0, 0, 11);
    ctx.closePath();
    paint(ctx, COLOR.berry);
  },
  question: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.bezierCurveTo(-6, -14, 7, -14, 7, -6);
    ctx.bezierCurveTo(7, -1, 0, -1, 0, 4);
    stroke(ctx, 3);
    ctx.beginPath();
    ctx.arc(0, 10, 2, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.ink;
    ctx.fill();
  },
  bang: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(0, 3);
    stroke(ctx, 4);
    ctx.beginPath();
    ctx.arc(0, 10, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = COLOR.ink;
    ctx.fill();
  },
  star: (ctx) => {
    ring(ctx, 10, (k) => (k % 2 === 0 ? 13 : 5.5));
    paint(ctx, COLOR.glow);
  },
  flower: (ctx) => {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 7, Math.sin(a) * 7, 6, 4, a, 0, Math.PI * 2);
      paint(ctx, COLOR.blush);
    }
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    paint(ctx, COLOR.glow);
  },
  circle: (ctx) => {
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    stroke(ctx);
  },
};

/** An icon at (x, y), scaled by `s` (0 hides it). */
export function icon(ctx: Ctx, name: Icon, x: number, y: number, s = 1): void {
  if (s <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ICONS[name](ctx);
  ctx.restore();
}

/**
 * A round speech bubble centered on (x, y), with its tail toward (tx, ty), holding one icon.
 * `s` scales the whole bubble, for pops.
 */
export function bubble(
  ctx: Ctx,
  x: number,
  y: number,
  name: Icon,
  s = 1,
  tail: readonly [number, number] = [x - 12, y + 34],
): void {
  if (s <= 0) return;
  const r = 22 * s;
  const a = Math.atan2(tail[1] - y, tail[0] - x);
  ctx.beginPath();
  ctx.arc(x, y, r, a + 0.35, a - 0.35 + Math.PI * 2);
  ctx.lineTo(lerp(x, tail[0], s), lerp(y, tail[1], s));
  ctx.closePath();
  paint(ctx, COLOR.bubble);
  icon(ctx, name, x, y, s * 0.95);
}

/** A soft ink line from (x1, y1) to (x2, y2) that sags by `sag` pixels, like yarn. */
export function yarn(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, sag: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag * 2, x2, y2);
  ctx.strokeStyle = COLOR.accent;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** The point at u (0..1) along the yarn of `yarn`, for things that travel on it. */
export function alongYarn(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sag: number,
  u: number,
): [number, number] {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + sag * 2;
  const v = 1 - u;
  return [v * v * x1 + 2 * v * u * cx + u * u * x2, v * v * y1 + 2 * v * u * cy + u * u * y2];
}

/** A dashed ink line; `offset` moves the dashes along it. */
export function dashed(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, offset = 0): void {
  ctx.save();
  ctx.setLineDash([2, 7]);
  ctx.lineDashOffset = -offset;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  stroke(ctx, 2.4);
  ctx.restore();
}
