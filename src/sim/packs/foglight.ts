// Foglight Heights (ADR 0015 item 3): snails climb to the highest cell within sight and stop, fog
// lies on low ground, the hero may walk down only while it steps down, and Brume, the guide,
// follows a hero it trusts into the fog at half the hero's speed. Nothing here draws.
import type { Creature, FoglightState, World } from '../types.ts';
import type { Tuning } from '../tuning.ts';
import { clamp, dist2 } from '../math.ts';
import { isHero, warmthTowardHero } from './hero-tie.ts';
import type { RulePack } from './index.ts';

/** The snails' species: the climbers. */
export const SNAIL = 'snail';

/**
 * Where on a cell each snail stands, by its index among the snails mod 9, so the snails on one
 * peak stand apart (scene units from the cell's center).
 */
const OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-28, -14],
  [28, -14],
  [-28, 14],
  [28, 14],
  [0, -28],
  [0, 28],
  [-42, 0],
  [42, 0],
];

function foglightOf(world: World): FoglightState | undefined {
  return world.pack?.id === 'foglight' ? world.pack : undefined;
}

/** The row count of the map: the scene's height in cells, rounded up. */
const rowsOf = (t: Tuning): number => Math.ceil(t.scene.height / t.foglight.cell);

/** The row-major index of the cell under (x, y), clamped to the map. */
function cellAt(f: FoglightState, x: number, y: number, t: Tuning): number {
  const col = clamp(Math.floor(x / t.foglight.cell), 0, f.cols - 1);
  const row = clamp(Math.floor(y / t.foglight.cell), 0, rowsOf(t) - 1);
  return row * f.cols + col;
}

/** The height under (x, y). */
export function heightAt(f: FoglightState, x: number, y: number, t: Tuning): number {
  return f.heights[cellAt(f, x, y, t)] ?? 0;
}

/**
 * The cell within foglight.sight steps of `from` (scene cells only) with the highest height: its
 * own on a tie, then the lowest index.
 */
function bestCell(f: FoglightState, from: number, t: Tuning): number {
  const rows = rowsOf(t);
  const col = from % f.cols;
  const row = Math.floor(from / f.cols);
  const s = t.foglight.sight;
  let best = from;
  for (let r = Math.max(0, row - s); r <= Math.min(rows - 1, row + s); r++) {
    for (let k = Math.max(0, col - s); k <= Math.min(f.cols - 1, col + s); k++) {
      const i = r * f.cols + k;
      if ((f.heights[i] ?? 0) > (f.heights[best] ?? 0)) best = i;
    }
  }
  return best;
}

/** True in Foglight for a snail: the pack sets its goal (ADR 0015 item 2). */
export function steersSnail(world: World, c: Creature): boolean {
  return foglightOf(world) !== undefined && c.speciesId === SNAIL;
}

/** False in Foglight for the hero's step that ends in a lower cell while it does not step down. */
export function climbAllows(
  world: World,
  c: Creature,
  x: number,
  y: number,
  nx: number,
  ny: number,
  t: Tuning,
): boolean {
  const f = foglightOf(world);
  if (!f || f.stepDown || !isHero(world, c)) return true;
  return heightAt(f, nx, ny, t) >= heightAt(f, x, y, t);
}

/** True when the guide follows the hero and walks within foglight.followRadii meeting radii of it. */
function guideBeside(world: World, f: FoglightState, hero: Creature, t: Tuning): boolean {
  const guide = world.creatures.find((c) => c.id === f.guide && c.state !== 'away');
  const reach = t.foglight.followRadii * t.meet.radius;
  return f.following && guide !== undefined && dist2(guide.x, guide.y, hero.x, hero.y) <= reach * reach;
}

/** The hero's speed factor in Foglight: foglight.carrySpeed while the guide walks beside it, else 1. */
export function carryFactor(world: World, c: Creature, t: Tuning): number {
  const f = foglightOf(world);
  return f && isHero(world, c) && guideBeside(world, f, c, t) ? t.foglight.carrySpeed : 1;
}

export const foglight: RulePack = {
  id: 'foglight',

  /**
   * Each fog cell takes at least clamp((foglight.fogBelow − h) / fogBelow, 0, 1), h the height under
   * its center. Throws when the map is not one height per cell. No draws.
   */
  setup(world: World, t: Tuning): void {
    const f = foglightOf(world);
    if (!f) return;
    if (f.heights.length !== f.cols * rowsOf(t))
      throw new Error(`The height map needs ${String(f.cols * rowsOf(t))} heights`);
    const { fog, fogW } = world.fields;
    const size = t.fog.cellSize;
    for (let i = 0; i < fog.length; i++) {
      const h = heightAt(f, ((i % fogW) + 0.5) * size, (Math.floor(i / fogW) + 0.5) * size, t);
      const low = clamp((t.foglight.fogBelow - h) / t.foglight.fogBelow, 0, 1);
      fog[i] = Math.max(fog[i] ?? 0, low);
    }
  },

  /**
   * Each tick: when the hero steps down within reach of a guide that trusts it, the guide follows
   * (event `follow`), and a following guide heads for the hero. Every foglight.everyTicks ticks, each
   * other snail heads for its spot on the best cell in sight, and stops on a peak. No draws.
   */
  step(world: World, events, t: Tuning) {
    const f = foglightOf(world);
    if (!f) return [];
    const out: { t: 'follow'; who: string }[] = [];
    const hero = world.hero ? world.creatures.find((c) => isHero(world, c)) : undefined;
    const guide = world.creatures.find((c) => c.id === f.guide && c.state !== 'away');
    if (hero && guide && !f.following && f.stepDown) {
      const reach = t.foglight.followRadii * t.meet.radius;
      const near = dist2(guide.x, guide.y, hero.x, hero.y) <= reach * reach;
      if (near && warmthTowardHero(world, guide.id) >= t.friend.threshold) {
        f.following = true;
        out.push({ t: 'follow', who: guide.id });
      }
    }
    if (hero && guide && f.following) {
      guide.goalX = hero.x;
      guide.goalY = hero.y;
    }
    if (world.tick % t.foglight.everyTicks !== 0) return out;
    let i = -1;
    for (const c of world.creatures) {
      if (c.speciesId !== SNAIL) continue;
      i += 1;
      if (c.state === 'away' || (f.following && c.id === f.guide)) continue;
      const best = bestCell(f, cellAt(f, c.x, c.y, t), t);
      const [dx, dy] = OFFSETS[i % OFFSETS.length] ?? [0, 0];
      c.goalX = clamp(((best % f.cols) + 0.5) * t.foglight.cell + dx, 0, t.scene.width);
      c.goalY = clamp((Math.floor(best / f.cols) + 0.5) * t.foglight.cell + dy, 0, t.scene.height);
    }
    return out;
  },

  /** `stepDown` lets the hero walk down, or stops it; other verbs do nothing here. No draws. */
  onVerb(world: World, verb) {
    const f = foglightOf(world);
    if (f && world.hero && verb.verb === 'stepDown' && typeof verb.on === 'boolean') f.stepDown = verb.on;
    return [];
  },

  /** The heights under the guide and the hero; 0 for one not here. */
  metrics(world: World, t: Tuning) {
    const f = foglightOf(world);
    const at = (c: Creature | undefined) => (f && c && c.state !== 'away' ? heightAt(f, c.x, c.y, t) : 0);
    return {
      guideHeight: at(world.creatures.find((c) => f && c.id === f.guide)),
      heroHeight: at(world.creatures.find((c) => isHero(world, c))),
    };
  },
};
