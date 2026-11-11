// World setup and tie helpers (ADRs 0002, 0004, 0005).
import type { Creature, Scenario, Shell, Side, Tie, World } from './types.ts';
import type { Tuning } from './tuning.ts';
import { ticksPerDay } from './tuning.ts';
import { clamp } from './math.ts';

const VISIT_CELLS = 32; // 8 columns by 4 rows (ADR 0005)

function zeroShell(): Shell {
  return { tightness: 0, bristle: 0, color: 0, softness: 0 };
}

export function createWorld(seed: number, tuning: Tuning, scenario: Scenario): World {
  const fogW = Math.ceil(tuning.scene.width / tuning.fog.cellSize);
  const fogH = Math.ceil(tuning.scene.height / tuning.fog.cellSize);
  const creatures: Creature[] = scenario.creatures.map((s) => {
    const shell = s.shell ? { ...s.shell } : zeroShell();
    return {
      id: s.id,
      speciesId: s.speciesId,
      name: s.name,
      x: s.x,
      y: s.y,
      vx: 0,
      vy: 0,
      goalX: s.x,
      goalY: s.y,
      berries: s.berries,
      state: 'wander',
      stateUntilTick: 0,
      forageReadyTick: 0,
      dials: { ...s.dials },
      shell,
      restShell: { ...shell },
      skyWarmth: 0,
      skyLightToday: 0,
      opinions: {},
      hungryDusks: 0,
      visits: new Array<number>(VISIT_CELLS).fill(0),
      benchMemory: null,
      diary: [],
    };
  });
  return {
    seed,
    rngState: seed >>> 0,
    tick: 0,
    day: 0,
    ticksPerDay: scenario.ticksPerDay ?? ticksPerDay(tuning),
    season: scenario.season,
    valleyId: scenario.valleyId,
    nextId: 1,
    artStreak: 0,
    creatures,
    ties: new Map(),
    fields: { light: null, fog: new Float32Array(fogW * fogH), fogW, fogH, gusts: [] },
    bushes: scenario.bushes.map((b) => ({ ...b })),
    structures: scenario.structures.map((s) => ({ ...s })),
    rumors: [],
    boosts: [],
  };
}

/** The two ids sorted by code unit and joined with `|` (ADR 0002). */
export function tieKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function getTie(world: World, a: string, b: string): Tie | undefined {
  return world.ties.get(tieKey(a, b));
}

/** Returns the tie, creating it on first meeting: each side starts at opinion x opinion.weight. */
export function ensureTie(world: World, a: Creature, b: Creature, tuning: Tuning): Tie {
  const key = tieKey(a.id, b.id);
  const found = world.ties.get(key);
  if (found) return found;
  const w = tuning.opinion.weight;
  const tie: Tie = {
    a: a.id,
    b: b.id,
    ab: { warmth: clamp((a.opinions[b.id] ?? 0) * w, -1, 1), slights: 0 },
    ba: { warmth: clamp((b.opinions[a.id] ?? 0) * w, -1, 1), slights: 0 },
    meetings: 0,
    lastDay: -1,
  };
  world.ties.set(key, tie);
  return tie;
}

/** The side that belongs to `from` (how `from` feels about the other creature). */
export function side(tie: Tie, from: string): Side {
  return tie.a === from ? tie.ab : tie.ba;
}

export function byId(world: World, id: string): Creature | undefined {
  return world.creatures.find((c) => c.id === id);
}

export function activeCreatures(world: World): Creature[] {
  return world.creatures.filter((c) => c.state !== 'away');
}

/** Creatures, not away, that `c` counts as friends (warmth above friend.threshold, ADR 0002). */
export function friendsOf(world: World, c: Creature, tuning: Tuning): Creature[] {
  const out: Creature[] = [];
  for (const tie of world.ties.values()) {
    if (tie.a !== c.id && tie.b !== c.id) continue;
    if (side(tie, c.id).warmth <= tuning.friend.threshold) continue;
    const other = byId(world, tie.a === c.id ? tie.b : tie.a);
    if (other && other.state !== 'away') out.push(other);
  }
  return out;
}

export function friendCount(world: World, c: Creature, tuning: Tuning): number {
  return friendsOf(world, c, tuning).length;
}

/** Mean warmth over tie sides whose two creatures are not away (ADR 0004 item 6). */
export function averageWarmth(world: World): number {
  let sum = 0;
  let n = 0;
  for (const tie of world.ties.values()) {
    const a = byId(world, tie.a);
    const b = byId(world, tie.b);
    if (!a || !b || a.state === 'away' || b.state === 'away') continue;
    sum += tie.ab.warmth + tie.ba.warmth;
    n += 2;
  }
  return n === 0 ? 0 : sum / n;
}
