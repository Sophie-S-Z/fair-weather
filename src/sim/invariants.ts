// World invariants checked every tick by the T2 property test. Returns one message per violation.
import type { World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { DIAL_KEYS, HERO } from './types.ts';
import { decksOf, inRect, inWater } from './land.ts';
import { tieKey } from './world.ts';

const SHELL_KEYS = ['tightness', 'bristle', 'color', 'softness'] as const;

/** Pushes a message for every non-finite number reachable from `v`. */
function findBadNumbers(v: unknown, path: string, out: string[]): void {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push(`${path} is ${String(v)}`);
  } else if (v instanceof Float32Array || Array.isArray(v)) {
    (v as ArrayLike<unknown>[] | Float32Array).forEach((x: unknown, i: number) => {
      findBadNumbers(x, `${path}[${String(i)}]`, out);
    });
  } else if (v instanceof Map) {
    for (const [k, x] of v as Map<string, unknown>) findBadNumbers(x, `${path}.get(${k})`, out);
  } else if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) findBadNumbers(x, `${path}.${k}`, out);
  }
}

function inRange(x: number, lo: number, hi: number): boolean {
  return x >= lo && x <= hi;
}

/**
 * Every number finite; berries >= 0; warmth, opinions, and sky warmth in [-1, 1]; light sky
 * warmth in [0, sky.lightDailyCap]; dials and shells in [0, 1]; fog in [0, 1]; creatures inside
 * the scene; no creature, unless away, in water off a bridge deck; population <= cap.sandbox;
 * unique creature ids; each tie stored under tieKey(a, b); mushroom drops taken in [0, drops]; with
 * `world.hero`, a hero creature that waves at no one or at another creature; a gift bush with at
 * most knack.seedBerries and no finder twice (ADR 0013 item 3); with a Fen (ADR 0013 item 5),
 * thresholds in [0, 1], each flier and restless starling one with a threshold, no flier twice, every
 * restless starling in flight, and a hero in flight only in a world with a hero; with a Hollow
 * (ADR 0013 item 6), the lens at the sky, every fame and drama score at least 0, and no drama
 * subject twice. The hero is a creature, so every creature limit holds for it too.
 */
export function checkInvariants(world: World, t: Tuning): string[] {
  const out: string[] = [];
  findBadNumbers(world, 'world', out);
  if (world.creatures.length > t.cap.sandbox) {
    out.push(`population ${String(world.creatures.length)} > cap.sandbox ${String(t.cap.sandbox)}`);
  }
  const ids = new Set<string>();
  const decks = decksOf(world, t);
  for (const c of world.creatures) {
    if (ids.has(c.id)) out.push(`duplicate creature id ${c.id}`);
    ids.add(c.id);
    if (!(c.berries >= 0)) out.push(`${c.id}.berries ${String(c.berries)} < 0`);
    if (!inRange(c.x, 0, t.scene.width) || !inRange(c.y, 0, t.scene.height)) {
      out.push(`${c.id} at (${String(c.x)}, ${String(c.y)}) is outside the scene`);
    }
    if (c.state !== 'away' && inWater(world, c.x, c.y) && !decks.some((d) => inRect(d, c.x, c.y))) {
      out.push(`${c.id} at (${String(c.x)}, ${String(c.y)}) is in water off a bridge deck`);
    }
    if (!inRange(c.skyWarmth, -1, 1)) out.push(`${c.id}.skyWarmth ${String(c.skyWarmth)}`);
    if (!inRange(c.skyLightToday, 0, t.sky.lightDailyCap)) {
      out.push(`${c.id}.skyLightToday ${String(c.skyLightToday)}`);
    }
    for (const k of DIAL_KEYS)
      if (!inRange(c.dials[k], 0, 1)) out.push(`${c.id}.dials.${k} ${String(c.dials[k])}`);
    for (const k of SHELL_KEYS) {
      if (!inRange(c.shell[k], 0, 1)) out.push(`${c.id}.shell.${k} ${String(c.shell[k])}`);
      if (!inRange(c.restShell[k], 0, 1)) out.push(`${c.id}.restShell.${k} ${String(c.restShell[k])}`);
    }
    for (const [about, v] of Object.entries(c.opinions)) {
      if (!inRange(v, -1, 1)) out.push(`${c.id}.opinions.${about} ${String(v)}`);
    }
  }
  for (const b of world.bushes) {
    if (!(b.berries >= 0)) out.push(`${b.id}.berries ${String(b.berries)} < 0`);
    if (!b.gift) continue;
    if (b.berries > t.knack.seedBerries) out.push(`gift ${b.id} holds ${String(b.berries)} berries`);
    if (new Set(b.gift.found).size !== b.gift.found.length) out.push(`gift ${b.id} has a finder twice`);
  }
  for (const [key, tie] of world.ties) {
    if (key !== tieKey(tie.a, tie.b)) out.push(`tie ${key} holds ${tie.a} and ${tie.b}`);
    if (!inRange(tie.ab.warmth, -1, 1)) out.push(`tie ${key} ab.warmth ${String(tie.ab.warmth)}`);
    if (!inRange(tie.ba.warmth, -1, 1)) out.push(`tie ${key} ba.warmth ${String(tie.ba.warmth)}`);
  }
  if (world.hero && !ids.has(HERO)) out.push('world.hero is set without a hero creature');
  if (world.hero?.waveTo === HERO) out.push('the hero waves at itself');
  const fen = world.pack;
  if (fen?.id === 'fen') {
    for (const [id, v] of Object.entries(fen.thresholds)) {
      if (!inRange(v, 0, 1)) out.push(`fen threshold ${id} ${String(v)}`);
    }
    for (const id of [...fen.flying, ...fen.restless]) {
      if (fen.thresholds[id] === undefined) out.push(`fen ${id} has no threshold`);
    }
    if (new Set(fen.flying).size !== fen.flying.length) out.push('a starling flies twice');
    if (!fen.restless.every((id) => fen.flying.includes(id))) out.push('a restless starling landed');
    if (fen.heroFlying && !world.hero) out.push('the hero flies in a world without a hero');
  }
  const hollow = world.pack;
  if (hollow?.id === 'hollow') {
    const light = world.fields.light;
    if (light?.x !== hollow.sky.x || light.y !== hollow.sky.y) out.push('the lens is off the drama sky');
    for (const [id, v] of Object.entries(hollow.fame)) if (!(v >= 0)) out.push(`fame ${id} ${String(v)}`);
    for (const d of hollow.drama) if (!(d.score >= 0)) out.push(`drama ${d.subject} ${String(d.score)}`);
    const subjects = hollow.drama.map((d) => d.subject);
    if (new Set(subjects).size !== subjects.length) out.push('a drama subject twice');
  }
  const m = world.mushroom;
  if (m && !inRange(m.taken, 0, m.drops)) out.push(`mushroom taken ${String(m.taken)} of ${String(m.drops)}`);
  world.fields.fog.forEach((f, i) => {
    if (!inRange(f, 0, 1)) out.push(`fog[${String(i)}] ${String(f)}`);
  });
  return out;
}
