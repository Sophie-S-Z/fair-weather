// World setup and tie helpers (ADRs 0002, 0004, 0005, ADR 0013 items 1 and 8).
import type { Creature, Scenario, Shell, Side, Structure, Tie, World } from './types.ts';
import { HERO } from './types.ts';
import type { Tuning } from './tuning.ts';
import { ticksPerDay } from './tuning.ts';
import { byCodeUnit, clamp } from './math.ts';
import { clearOfBanks, landOf } from './land.ts';

const VISIT_CELLS = 32; // 8 columns by 4 rows (ADR 0005)

function zeroShell(): Shell {
  return { tightness: 0, bristle: 0, color: 0, softness: 0 };
}

/** A fresh creature from a scenario entry: at rest, no ties, opinions, or memories. */
export function newCreature(s: Scenario['creatures'][number]): Creature {
  const shell = s.shell ? { ...s.shell } : zeroShell();
  const c: Creature = {
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
    state: s.gone ? 'away' : (s.state ?? 'wander'),
    stateUntilTick: 0,
    forageReadyTick: 0,
    dials: { ...s.dials },
    shell,
    restShell: { ...shell },
    skyWarmth: clamp(s.skyWarmth ?? 0, -1, 1),
    skyLightToday: 0,
    opinions: {},
    hungryDusks: 0,
    visits: new Array<number>(VISIT_CELLS).fill(0),
    benchMemory: null,
    diary: [],
  };
  // Only when set, so other creatures keep the same keys (and hash).
  if (s.gone) c.gone = true;
  if (s.danceThreshold !== undefined) c.danceThreshold = s.danceThreshold;
  return c;
}

/**
 * The hero as a creature (ADR 0013 item 1): its kind as species, dials 0.5, no shell. Each other
 * creature with Ear at or below the rumor's strength starts with the rumor's value as its opinion
 * of the hero (ADR 0013 item 8).
 */
function addHero(creatures: Creature[], hero: NonNullable<Scenario['hero']>): void {
  const { rumor } = hero;
  for (const c of creatures) {
    if (rumor && c.dials.ear <= rumor.strength) c.opinions[HERO] = clamp(rumor.value, -1, 1);
  }
  const dial = 0.5;
  creatures.push(
    newCreature({
      id: HERO,
      speciesId: hero.kind,
      name: hero.name,
      x: hero.x,
      y: hero.y,
      berries: hero.berries,
      dials: { opener: dial, forgiveness: dial, memory: dial, ear: dial, wanderlust: dial },
    }),
  );
}

export function createWorld(seed: number, tuning: Tuning, scenario: Scenario): World {
  const fogW = Math.ceil(tuning.scene.width / tuning.fog.cellSize);
  const fogH = Math.ceil(tuning.scene.height / tuning.fog.cellSize);
  const creatures = scenario.creatures.map(newCreature);
  if (scenario.hero) addHero(creatures, scenario.hero);
  const ids = new Set(creatures.map((c) => c.id));
  const ties = new Map<string, Tie>();
  const clampSide = (s: Side): Side => ({ warmth: clamp(s.warmth, -1, 1), slights: s.slights });
  for (const { a, b, ab, ba } of scenario.ties ?? []) {
    if (a === b || !ids.has(a) || !ids.has(b)) continue;
    ties.set(tieKey(a, b), { a, b, ab: clampSide(ab), ba: clampSide(ba), meetings: 1, lastDay: -1 });
  }
  const world: World = {
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
    ties,
    fields: { light: null, fog: new Float32Array(fogW * fogH), fogW, fogH, gusts: [] },
    bushes: scenario.bushes.map((b) => ({ ...b })),
    structures: scenario.structures.map((s) => ({ ...s })),
    rumors: [],
    boosts: [],
  };
  // Only when set, so a world without land or a hero keeps the same keys (and hash).
  if (scenario.hero) {
    const { kind, keepsakes } = scenario.hero;
    world.hero = { kind, reply: 'toward', gift: 'give', waveTo: null, keepsakes: [...keepsakes] };
  }
  if (scenario.water) {
    world.water = scenario.water.map((r) => ({ ...r }));
    // No body starts over water: feet in a bank, off a deck and an islet, move just past it.
    const land = landOf(world, tuning);
    for (const c of world.creatures) {
      [c.x, c.y] = clearOfBanks(land, c.x, c.y, tuning);
      [c.goalX, c.goalY] = [c.x, c.y];
    }
  }
  if (scenario.ridgeX !== undefined) world.ridgeX = scenario.ridgeX;
  if (scenario.mushroom) {
    const { x, y } = scenario.mushroom;
    world.mushroom = { x, y, drops: tuning.mushroom.drops, taken: 0, witherDays: 0 };
  }
  if (scenario.ambientSkyBids) world.ambientSkyBids = true;
  if (scenario.rumorFirst) world.rumorFirst = true;
  if (scenario.friendsForgive) world.friendsForgive = true;
  return world;
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

/** The structures that count as benches (ADR 0003 item 9). */
export function benchesOf(world: World): Structure[] {
  return world.structures.filter((s) => s.kind === 'bench');
}

export function activeCreatures(world: World): Creature[] {
  return world.creatures.filter((c) => c.state !== 'away');
}

/**
 * Creatures, not away, that `c` counts as friends (warmth above friend.threshold, ADR 0002),
 * one-sided: only c's own warmth counts, unlike the Cosmos's mutual friendships (ADR 0012 item 6);
 * sorted by id in code-unit order so PRNG picks never depend on tie insertion order.
 */
export function friendsOf(world: World, c: Creature, tuning: Tuning): Creature[] {
  const out: Creature[] = [];
  for (const tie of world.ties.values()) {
    if (tie.a !== c.id && tie.b !== c.id) continue;
    if (side(tie, c.id).warmth <= tuning.friend.threshold) continue;
    const other = byId(world, tie.a === c.id ? tie.b : tie.a);
    if (other && other.state !== 'away') out.push(other);
  }
  return out.sort((x, y) => byCodeUnit(x.id, y.id));
}

export function friendCount(world: World, c: Creature, tuning: Tuning): number {
  return friendsOf(world, c, tuning).length;
}

/**
 * Mean warmth over tie sides whose two creatures are not away (ADR 0004 item 6). Summed in tie-key
 * order, as hash.ts does, so two worlds with the same hash give the same float.
 */
export function averageWarmth(world: World): number {
  let sum = 0;
  let n = 0;
  for (const [, tie] of [...world.ties].sort(([x], [y]) => byCodeUnit(x, y))) {
    const a = byId(world, tie.a);
    const b = byId(world, tie.b);
    if (!a || !b || a.state === 'away' || b.state === 'away') continue;
    sum += tie.ab.warmth + tie.ba.warmth;
    n += 2;
  }
  return n === 0 ? 0 : sum / n;
}
