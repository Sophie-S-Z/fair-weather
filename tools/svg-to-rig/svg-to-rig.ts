import { svgPathProperties } from 'svg-path-properties';
import { RIG_POINTS, RigSchema } from '../../src/render/line/rig.ts';
import type { Rig } from '../../src/render/line/rig.ts';

// The library's length-to-point lookup is not uniform near segment joins, and finer than
// about 2000 steps it only adds jitter. So the path is walked at this density and re-sampled
// by cumulative chord length.
const DENSE_SAMPLES = 1024;

type Pt = { x: number; y: number };

/** The opening tag of the element with this id, or null. */
function tagWithId(svg: string, id: string): string | null {
  const m = new RegExp(`<[a-z]+\\b[^>]*(?<![\\w-])id="${id}"[^>]*>`).exec(svg);
  return m ? m[0] : null;
}

function attr(tag: string, name: string, what: string): number {
  const m = new RegExp(`(?<![\\w-])${name}="([^"]+)"`).exec(tag);
  const v = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(v)) throw new Error(`svg-to-rig: ${what} has no numeric ${name}`);
  return v;
}

function required(svg: string, id: string): string {
  const tag = tagWithId(svg, id);
  if (tag === null) throw new Error(`svg-to-rig: missing marker ${id}`);
  return tag;
}

/** Round to 4 decimals, and never return -0. */
const r4 = (n: number): number => Math.round(n * 1e4) / 1e4 || 0;

/** The point at arc distance `target`, given the dense walk and its running length. */
function pointAtArc(dense: Pt[], cumulative: number[], target: number): Pt {
  let lo = 0;
  let hi = dense.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((cumulative[mid] ?? 0) < target) lo = mid;
    else hi = mid;
  }
  const a = dense[lo];
  const b = dense[hi];
  const c0 = cumulative[lo];
  const c1 = cumulative[hi];
  if (!a || !b || c0 === undefined || c1 === undefined) throw new Error('svg-to-rig: empty walk');
  const f = c1 > c0 ? Math.min(1, Math.max(0, (target - c0) / (c1 - c0))) : 0;
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export function svgToRig(svgText: string, id: string): Rig {
  const paths = [...svgText.matchAll(/<path\b[^>]*(?<![\w-])id="line"[^>]*>/g)];
  const d = paths.length === 1 ? /(?<![\w-])d="([^"]+)"/.exec(paths[0]?.[0] ?? '')?.[1] : undefined;
  if (paths.length !== 1) {
    throw new Error(`svg-to-rig: expected exactly one path#line, found ${String(paths.length)}`);
  }
  if (d === undefined) throw new Error('svg-to-rig: path#line has no d attribute');

  const eyeL = required(svgText, 'eye-l');
  const eyeR = required(svgText, 'eye-r');
  const blush = required(svgText, 'blush');
  const neck = required(svgText, 'neck');
  const base = required(svgText, 'base');
  const prop = tagWithId(svgText, 'prop');

  const props = new svgPathProperties(d);
  const total = props.getTotalLength();
  if (!(total > 0)) throw new Error('svg-to-rig: path#line has zero length');

  const dense: Pt[] = [];
  const cumulative: number[] = [];
  let arc = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i <= DENSE_SAMPLES; i++) {
    const p = props.getPointAtLength((total * i) / DENSE_SAMPLES);
    const prev = dense[i - 1];
    if (prev) arc += Math.hypot(p.x - prev.x, p.y - prev.y);
    cumulative.push(arc);
    dense.push(p);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const height = maxY - minY;
  if (!(height > 0)) throw new Error('svg-to-rig: path#line has no height');

  const neckY = attr(neck, 'y1', 'neck');
  const baseY = attr(base, 'y1', 'base');
  const cx = (minX + maxX) / 2;
  const toRig = (x: number, y: number): [number, number] => [r4((x - cx) / height), r4((baseY - y) / height)];
  const marker = (tag: string, name: string): [number, number] =>
    toRig(attr(tag, 'cx', name), attr(tag, 'cy', name));

  const points: number[] = [];
  const region: number[] = [];
  for (let i = 0; i < RIG_POINTS; i++) {
    const p = pointAtArc(dense, cumulative, (arc * i) / (RIG_POINTS - 1));
    points.push(...toRig(p.x, p.y));
    region.push(p.y < neckY ? 0 : p.y > baseY ? 2 : 1);
  }

  const markers: Rig['markers'] = {
    eyeL: marker(eyeL, 'eye-l'),
    eyeR: marker(eyeR, 'eye-r'),
    blush: marker(blush, 'blush'),
  };
  if (prop !== null) markers.prop = marker(prop, 'prop');

  return RigSchema.parse({ id, points, region, markers, length: r4(arc / height) });
}

/** Stable JSON: fixed key order (the schema's), 2-space indent, trailing newline. */
export function rigToJson(rig: Rig): string {
  return JSON.stringify(rig, null, 2) + '\n';
}
