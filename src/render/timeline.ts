import type { Graphics } from 'pixi.js';
import type { WorldLite } from '../sim-host/protocol.ts';
import { inkStroke } from './ink.ts';
import type { Palette } from './palette.ts';
import { tieKind } from './ties.ts';

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
  tieKind(t.ab, t.ba, threshold) === 'friend';

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

/** The population line, the thinner trust line, and the break marks, in pixels. */
const POPULATION_WIDTH = 2.5;
const TRUST_WIDTH = 1.5;
const BREAK_WIDTH = 2;
const BREAK_HEIGHT = 6;
/** Each series fills the strip over its run's range, widened to at least these spans. */
const POPULATION_SPAN = 2;
const TRUST_SPAN = 0.2;
/** Each range is padded by this share of its span on both sides, so the lines clear the edges. */
const PAD = 0.1;

/**
 * The range a series is drawn over: its values' lowest to highest, widened about the middle to at
 * least `minSpan`, then padded. Real movement fills the strip; noise under `minSpan` stays small.
 */
export function seriesRange(values: readonly number[], minSpan: number): [number, number] {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < minSpan) {
    const mid = (lo + hi) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * PAD;
  return [lo - pad, hi + pad];
}

/**
 * The thin timeline strip in `box` (screen pixels): the bolder population line in the top half and
 * the thinner trust line in the bottom half, each scaled to its own run's range (`seriesRange`), so
 * a flat run does not lay one line on the other, and a short tick on the bottom
 * edge at each break. Time runs left to right from the first point to the last point or break.
 * Breaks share the run's ticks, so none comes before the first point. `widthScale` thickens the
 * lines in high contrast.
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
  const bottom = box.y + box.h;
  const half = box.h / 2;
  /** A series drawn in the half of the strip whose bottom edge is `base`. */
  const series = (
    value: (p: TimelinePoint) => number,
    minSpan: number,
    width: number,
    base: number,
  ): void => {
    const [lo, hi] = seriesRange(points.map(value), minSpan);
    points.forEach((p, i) => {
      const y = base - (half * (value(p) - lo)) / (hi - lo);
      if (i === 0) g.moveTo(xOf(p.tick), y);
      else g.lineTo(xOf(p.tick), y);
    });
    g.stroke(inkStroke(palette, width * widthScale));
  };
  series((p) => p.population, POPULATION_SPAN, POPULATION_WIDTH, box.y + half);
  series((p) => p.trust, TRUST_SPAN, TRUST_WIDTH, bottom);
  if (breaks.length === 0) return;
  for (const tick of breaks) g.moveTo(xOf(tick), bottom).lineTo(xOf(tick), bottom - BREAK_HEIGHT);
  g.stroke(inkStroke(palette, BREAK_WIDTH * widthScale));
}
