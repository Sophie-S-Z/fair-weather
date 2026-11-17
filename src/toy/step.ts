import { CAST } from './cast.ts';
import { direct } from './director.ts';
import { clampToFloor, depthScale, dist } from './geometry.ts';
import { bump, isFree, say } from './table.ts';
import type { Critter, Discovery, Table } from './types.ts';

/** The fixed step, in seconds. */
export const DT = 1 / 30;
/** Hops per second while walking. */
const HOP_RATE = 2.6;
/** Squash spring stiffness and damping. */
const SPRING_K = 180;
const SPRING_D = 12;
/** Creatures closer than this (table units, at depth scale 1) push apart. */
const PERSONAL_SPACE = 64;
/** How fast a mood eases back to rest, per second. */
const MOOD_EASE = 0.6;
/** Seconds a wilted bush rests before it grows again, and seconds per new berry. */
const BUSH_REST = 20;
const BERRY_SECONDS = 5;
const MAX_BERRIES = 6;

function idle(t: Table, c: Critter): void {
  const r = t.rng.next();
  const temper = CAST[c.cast];
  if (r < 0.55) {
    const [x, y] = clampToFloor(c.x + (t.rng.next() - 0.5) * 320, c.y + (t.rng.next() - 0.5) * 160);
    c.goal = { x, y };
  } else if (r < 0.75) {
    const other = t.critters
      .filter((k) => k !== c)
      .sort((a, b) => dist(a.x, a.y, c.x, c.y) - dist(b.x, b.y, c.x, c.y))[0];
    if (other && other.x !== c.x) c.face = other.x > c.x ? 1 : -1;
  } else if (r < 0.9) {
    say(t, c, temper.idle, 1.4);
  } else {
    c.hop = 0.01;
  }
  c.nextIdle = t.time + 2 + t.rng.next() * 4;
}

function walk(t: Table, c: Critter, dt: number): void {
  const goal = c.goal;
  if (!goal) return;
  const d = dist(c.x, c.y, goal.x, goal.y);
  const stepLen = CAST[c.cast].speed * dt;
  if (goal.x !== c.x) c.face = goal.x > c.x ? 1 : -1;
  if (t.calm || d <= stepLen) {
    c.x = goal.x;
    c.y = goal.y;
    c.goal = null;
    if (!t.calm) bump(c, 3);
    return;
  }
  c.x += ((goal.x - c.x) / d) * stepLen;
  c.y += ((goal.y - c.y) / d) * stepLen;
  if (c.hop === 0) c.hop = 0.01;
}

/** Pushes apart creatures that stand too close, unless held or directed. */
function spread(t: Table): void {
  const cs = t.critters;
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i] as Critter;
      const b = cs[j] as Critter;
      const movable = [a, b].filter((c) => !c.held && !c.busy && !c.stuck);
      if (movable.length === 0) continue;
      const min = PERSONAL_SPACE * (depthScale(a.y) + depthScale(b.y)) * 0.5;
      const dx = b.x - a.x;
      const dy = (b.y - a.y) * 2;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      const push = ((min - d) / movable.length) * 0.2;
      const [ux, uy] = d === 0 ? [1, 0] : [dx / d, dy / d];
      for (const c of movable) {
        const sign = c === a ? -1 : 1;
        [c.x, c.y] = clampToFloor(c.x + sign * ux * push, c.y + sign * uy * push * 0.5);
      }
    }
  }
}

function growBushes(t: Table): void {
  for (const p of t.props) {
    if (p.kind !== 'bush' || t.scene?.needs === 'bush') continue;
    if (!p.on) {
      if (t.time - p.since > BUSH_REST) Object.assign(p, { on: true, count: 1, since: t.time });
    } else if (p.count < MAX_BERRIES && t.time - p.since > BERRY_SECONDS) {
      p.count += 1;
      p.since = t.time;
    }
  }
}

/** One fixed step of the table: motion, springs, moods, bubbles, props, then the director. */
export function step(t: Table, discoveries: readonly Discovery[], dt = DT): void {
  t.time += dt;
  const ease = Math.min(1, MOOD_EASE * dt);
  for (const c of t.critters) {
    if (!c.held && !c.stuck) {
      if (c.goal) walk(t, c, dt);
      else if (t.wander && !t.calm && isFree(c) && t.time >= c.nextIdle) idle(t, c);
    }
    if (c.hop > 0) {
      c.hop += HOP_RATE * dt;
      if (c.hop >= 1) c.hop = c.goal && !t.calm ? c.hop - 1 : 0;
    }
    if (t.calm) {
      c.squash = 0;
      c.squashV = 0;
    } else {
      c.squashV += (-SPRING_K * c.squash - SPRING_D * c.squashV) * dt;
      c.squash += c.squashV * dt;
    }
    if (!c.busy) {
      const rest = CAST[c.cast].rest;
      for (const k of ['tightness', 'bristle', 'color', 'softness'] as const) {
        c.mood[k] += (rest[k] + (c.stuck && k === 'tightness' ? 0.6 : 0) - c.mood[k]) * ease;
      }
    }
    if (c.bubble && c.bubble.until <= t.time) c.bubble = null;
  }
  spread(t);
  growBushes(t);
  direct(t, discoveries);
}
