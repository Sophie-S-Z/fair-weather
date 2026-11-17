import { clampToFloor } from './geometry.ts';
import { BUBBLE_SECONDS, chirp, critter, prop, say } from './table.ts';
import type { Action, Beat, Discovery, RunningScene, Scene, Table } from './types.ts';

/** Seconds before a discovery can fire again. */
export const COOLDOWN = 12;

/** Adds a beat to a running scene `offset` seconds from now, in time order. */
export function schedule(t: Table, s: RunningScene, offset: number, action: Action): void {
  const at = t.time - s.start + offset;
  const full: Beat = { ...action, at };
  let i = s.next;
  while (i < s.beats.length && (s.beats[i] as Beat).at <= at) i++;
  s.beats.splice(i, 0, full);
  s.length = Math.max(s.length, at + 0.5);
}

function apply(t: Table, s: RunningScene, b: Beat): void {
  switch (b.do) {
    case 'walk': {
      const c = critter(t, b.who);
      if (!c) break;
      const [x, y] = clampToFloor(b.x, b.y);
      c.goal = { x, y };
      break;
    }
    case 'face': {
      const c = critter(t, b.who);
      const x = typeof b.to === 'number' ? b.to : critter(t, b.to)?.x;
      if (c && x !== undefined && x !== c.x) c.face = x > c.x ? 1 : -1;
      break;
    }
    case 'say': {
      const c = critter(t, b.who);
      if (c) say(t, c, b.icon, b.for ?? BUBBLE_SECONDS, b.n ?? 0);
      break;
    }
    case 'feel': {
      const c = critter(t, b.who);
      if (!c) break;
      Object.assign(c.mood, b.mood);
      if (b.chirp) chirp(t, c, b.chirp);
      break;
    }
    case 'hop': {
      const c = critter(t, b.who);
      if (c && !t.calm) c.hop = 0.01;
      break;
    }
    case 'look': {
      const c = critter(t, b.who);
      if (c) c.lookUp = b.up;
      break;
    }
    case 'free': {
      const c = critter(t, b.who);
      if (c) c.stuck = false;
      break;
    }
    case 'clean': {
      const c = critter(t, b.who);
      if (c) c.smudge = false;
      break;
    }
    case 'prop': {
      const p = prop(t, b.kind);
      if (p) Object.assign(p, b.patch);
      break;
    }
    case 'take':
      t.props = t.props.filter((p) => p.kind !== b.kind);
      if (s.needs === b.kind) s.needs = null;
      break;
    case 'spawn': {
      const c = { ...b.critter };
      [c.x, c.y] = clampToFloor(c.x, c.y);
      t.critters.push(c);
      break;
    }
    case 'remove':
      t.critters = t.critters.filter((c) => c.id !== b.who);
      break;
    case 'line':
      t.events.push({ kind: 'line', text: b.text });
      break;
    case 'run':
      b.fn(t, s);
      break;
  }
}

function end(t: Table, s: RunningScene, finished: boolean): void {
  for (const id of s.actors) {
    const c = critter(t, id);
    if (!c) continue;
    c.busy = false;
    c.goal = null;
    c.lookUp = false;
  }
  t.critters = t.critters.filter((c) => !c.id.endsWith('+copy'));
  t.cool[s.id] = t.time + COOLDOWN;
  t.scene = null;
  if (finished) for (const id of s.unlock) t.events.push({ kind: 'found', id });
}

function begin(t: Table, scene: Scene): void {
  t.scene = { ...scene, beats: [...scene.beats].sort((a, b) => a.at - b.at), start: t.time, next: 0 };
  for (const id of scene.actors) {
    const c = critter(t, id);
    if (c) {
      c.busy = true;
      c.goal = null;
    }
  }
}

/**
 * Plays the running scene's due beats and ends it when done or when its prop is gone. With no scene,
 * starts the first discovery that fires, is not cooling down, and needs no held creature.
 */
export function direct(t: Table, discoveries: readonly Discovery[]): void {
  const s = t.scene;
  if (s) {
    const elapsed = t.time - s.start;
    while (s.next < s.beats.length && (s.beats[s.next] as Beat).at <= elapsed) {
      apply(t, s, s.beats[s.next++] as Beat);
    }
    if (s.next >= s.beats.length && elapsed >= s.length) end(t, s, true);
    else if (s.needs && !prop(t, s.needs)) end(t, s, false);
    return;
  }
  for (const d of discoveries) {
    if ((t.cool[d.id] ?? -Infinity) > t.time) continue;
    const scene = d.detect(t);
    if (!scene || scene.actors.some((id) => critter(t, id)?.held)) continue;
    begin(t, scene);
    return;
  }
}
