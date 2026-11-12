import type { Graphics } from 'pixi.js';
import type { WorldLite } from '../sim-host/protocol.ts';
import { inkStroke, TUFT_ALPHA } from './ink.ts';
import type { Palette } from './palette.ts';

/** One sample of the Cosmos timeline (spec 11.3): creatures not away, and the average warmth. */
export interface TimelinePoint {
  tick: number;
  population: number;
  trust: number;
}

export interface Timeline {
  points: readonly TimelinePoint[];
  /** The ticks at which a two-sided friendship ended. */
  breaks: readonly number[];
}

/** Adds a point for `lite` when `tick` is at least `every` ticks past the last point, or there is none. */
export function sampleTimeline(points: TimelinePoint[], tick: number, lite: WorldLite, every: number): void {
  const last = points.at(-1);
  if (last && tick - last.tick < every) return;
  points.push({
    tick,
    population: lite.creatures.filter((c) => c.state !== 'away').length,
    trust: lite.metrics.averageWarmth,
  });
}

const friends = (t: WorldLite['ties'][number], threshold: number): boolean =>
  t.ab > threshold && t.ba > threshold;

/** The ties that were friendships (both warmths above `threshold`) in `prev` and are not in `next`. */
export function friendshipBreaks(
  prev: WorldLite,
  next: WorldLite,
  threshold: number,
): { a: string; b: string }[] {
  const now = new Map(next.ties.map((t) => [`${t.a} ${t.b}`, t]));
  const out: { a: string; b: string }[] = [];
  for (const t of prev.ties) {
    const after = now.get(`${t.a} ${t.b}`);
    if (after && friends(t, threshold) && !friends(after, threshold)) out.push({ a: t.a, b: t.b });
  }
  return out;
}

/** The population line, the thinner trust line, and the break marks share these widths, in pixels. */
const POPULATION_WIDTH = 3;
const TRUST_WIDTH = 1.5;
const BREAK_WIDTH = 2;

/**
 * The thin timeline strip in `box` (screen pixels): a faint rule at no warmth, the trust line
 * from warmth -1 at the bottom to 1 at the top, the bolder population line from 0 up to the most
 * creatures seen, and a short upright mark at each break. Time runs left to right from the first
 * point to the last point or break. Breaks share the run's ticks, so none comes before the first
 * point. `widthScale` thickens the lines in high contrast.
 */
export function drawTimeline(
  g: Graphics,
  { points, breaks }: Timeline,
  box: { x: number; y: number; w: number; h: number },
  palette: Palette,
  widthScale: number,
): void {
  g.clear();
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) return;
  const span = Math.max(1, Math.max(last.tick, breaks.at(-1) ?? 0) - first.tick);
  const xOf = (tick: number): number => box.x + (box.w * (tick - first.tick)) / span;
  const most = Math.max(1, ...points.map((p) => p.population));
  const mid = box.y + box.h / 2;
  g.moveTo(box.x, mid)
    .lineTo(box.x + box.w, mid)
    .stroke(inkStroke(palette, TRUST_WIDTH * widthScale, TUFT_ALPHA));
  points.forEach((p, i) => {
    const y = mid - (box.h / 2) * p.trust;
    if (i === 0) g.moveTo(xOf(p.tick), y);
    else g.lineTo(xOf(p.tick), y);
  });
  g.stroke(inkStroke(palette, TRUST_WIDTH * widthScale));
  points.forEach((p, i) => {
    const y = box.y + box.h - (box.h * p.population) / most;
    if (i === 0) g.moveTo(xOf(p.tick), y);
    else g.lineTo(xOf(p.tick), y);
  });
  g.stroke(inkStroke(palette, POPULATION_WIDTH * widthScale));
  if (breaks.length === 0) return;
  for (const tick of breaks) g.moveTo(xOf(tick), box.y).lineTo(xOf(tick), box.y + box.h);
  g.stroke(inkStroke(palette, BREAK_WIDTH * widthScale));
}
