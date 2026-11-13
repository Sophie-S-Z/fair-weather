// Steering, goal choice, foraging, dew drops, and visit counts (ADR 0005, ADR 0004 item 2,
// ADR 0003 item 9, ADR 0012 item 5, ADR 0013 item 1).
// Velocity is in world units per second; position advances by velocity / stepsPerSecond per tick.
import type { Creature, Rect, Structure, World } from './types.ts';
import type { Rng } from './rng.ts';
import type { Tuning } from './tuning.ts';
import { clamp, dist2 } from './math.ts';
import { aimHero, isHero, stopHero } from './hero.ts';
import { inRect, landOf, nearestDeckOn, waterBlocking, type Land } from './land.ts';
import { avoidsLens, inLens } from './light.ts';
import { benchesOf, friendCount, friendsOf } from './world.ts';

const COLS = 8;
const ROWS = 4;

function visitCell(x: number, y: number, tuning: Tuning): number {
  const col = clamp(Math.floor((x / tuning.scene.width) * COLS), 0, COLS - 1);
  const row = clamp(Math.floor((y / tuning.scene.height) * ROWS), 0, ROWS - 1);
  return row * COLS + col;
}

function pickGoal(c: Creature, world: World, land: Land, tuning: Tuning, rng: Rng): void {
  // 1. A bench (ADR 0003 item 9).
  const benches = benchesOf(world);
  if (benches.length > 0) {
    const mem = c.benchMemory;
    let remembered: Structure | undefined;
    if (mem && mem.day === world.day - 1) remembered = benches.find((b) => b.id === mem.benchId);
    if (remembered) {
      if (rng.next() < tuning.goal.benchChance * tuning.meet.benchRepeatMultiplier) {
        setGoal(c, remembered.x, remembered.y, world, land, tuning);
        return;
      }
    } else if (rng.next() < tuning.goal.benchChance) {
      const b = rng.pick(benches);
      setGoal(c, b.x, b.y, world, land, tuning);
      return;
    }
  }
  // 2. The nearest bush with berries, or the mushroom with a drop for it, when hungry.
  if (c.berries < 1) {
    let best: { x: number; y: number } | undefined;
    let bestD = Infinity;
    for (const b of world.bushes) {
      if (b.berries < 1) continue;
      const d = dist2(c.x, c.y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    const m = world.mushroom;
    if (m && dropFor(c, m, world.day) && dist2(c.x, c.y, m.x, m.y) < bestD) best = m;
    if (best) {
      setGoal(c, best.x, best.y, world, land, tuning);
      return;
    }
  }
  // 3. A random friend, with chance 1 - wanderlust.
  const friends = friendsOf(world, c, tuning);
  if (friends.length > 0 && rng.next() < 1 - c.dials.wanderlust) {
    const f = rng.pick(friends);
    setGoal(c, f.x, f.y, world, land, tuning);
    return;
  }
  // 4. A random point in a least-visited cell.
  pickRandomGoal(c, world, land, tuning, rng);
}

/** A random point in one of the creature's least-visited cells (ADR 0005). */
function pickRandomGoal(c: Creature, world: World, land: Land, tuning: Tuning, rng: Rng): void {
  let least = Infinity;
  for (const v of c.visits) least = Math.min(least, v);
  const cells: number[] = [];
  c.visits.forEach((v, i) => {
    if (v === least) cells.push(i);
  });
  const cell = rng.pick(cells);
  const cw = tuning.scene.width / COLS;
  const ch = tuning.scene.height / ROWS;
  const x = ((cell % COLS) + rng.next()) * cw;
  setGoal(c, x, (Math.floor(cell / COLS) + rng.next()) * ch, world, land, tuning);
}

/**
 * Sets the goal. A creature on an islet (one of `land.islets`) keeps its goal on the islet, the
 * margin in from the water where the islet is wide enough (its middle where not), so it walks the
 * islet instead of stopping at the water. Then, with a ridge, the goal stays west of it by the
 * arrival radius plus the distance a creature at full speed needs to stop (the margin), so only a
 * gust sends anyone over (ADR 0012 item 3).
 */
function setGoal(c: Creature, x: number, y: number, world: World, land: Land, t: Tuning): void {
  const margin = t.move.arriveRadius + (t.move.speed * t.move.speed) / (2 * t.move.accel);
  const isle = land.islets.find((r) => inRect(r, c.x, c.y));
  const keep = (v: number, lo: number, size: number): number =>
    size > 2 * margin ? clamp(v, lo + margin, lo + size - margin) : lo + size / 2;
  const gx = isle ? keep(x, isle.x, isle.w) : x;
  c.goalX = world.ridgeX === undefined ? gx : Math.min(gx, Math.max(0, world.ridgeX - margin));
  c.goalY = isle ? keep(y, isle.y, isle.h) : y;
}

function forage(c: Creature, world: World, tuning: Tuning): void {
  if (c.berries >= tuning.forage.carryMax || world.tick < c.forageReadyTick) return;
  const r2 = tuning.meet.radius * tuning.meet.radius;
  let best: (typeof world.bushes)[number] | undefined;
  let bestD = Infinity;
  for (const b of world.bushes) {
    if (b.berries < 1) continue;
    const d = dist2(c.x, c.y, b.x, b.y);
    if (d <= r2 && d < bestD) {
      bestD = d;
      best = b;
    }
  }
  if (!best) return;
  best.berries -= 1;
  c.berries += 1;
  c.forageReadyTick = world.tick + tuning.forage.cooldownTicks;
}

/** True when the mushroom has a drop left today and `c` has not taken one today. */
function dropFor(c: Creature, m: NonNullable<World['mushroom']>, day: number): boolean {
  return m.taken < m.drops && c.mushroomDay !== day;
}

/**
 * Within meet.radius of the mushroom, as for a bush, `c` takes one drop (one berry) a day when it
 * carries fewer than mushroom.takeBelowBerries, or fewer than forage.carryMax while it has fewer
 * than mushroom.trustFriends friends (ADR 0012 item 5).
 */
function takeDrop(c: Creature, world: World, tuning: Tuning): void {
  const m = world.mushroom;
  if (!m || !dropFor(c, m, world.day)) return;
  if (dist2(c.x, c.y, m.x, m.y) > tuning.meet.radius * tuning.meet.radius) return;
  const { takeBelowBerries, trustFriends } = tuning.mushroom;
  const hoards = c.berries < tuning.forage.carryMax && friendCount(world, c, tuning) < trustFriends;
  if (c.berries >= takeBelowBerries && !hoards) return;
  m.taken += 1;
  c.berries += 1;
  c.mushroomDay = world.day;
}

/**
 * A refused step into `water` or its bank (ADR 0012 item 3). The creature stops and heads for a
 * deck foot, just past the bank: of the deck it stands on, toward its goal's side, or else of the
 * deck on that water nearest it, on its own side. When no deck can help (none on that water, or
 * it already heads for the foot or stands within move.arriveRadius of it), it counts its goal's
 * cell as visited as often as its most visited cell and picks a random least-visited cell, so the
 * refused goal cannot come straight back. The hero just stops (stopHero).
 */
function turnFromWater(c: Creature, water: Rect, land: Land, world: World, tuning: Tuning, rng: Rng): void {
  c.vx = 0;
  c.vy = 0;
  if (isHero(world, c)) {
    stopHero(world, c);
    return;
  }
  const on = land.decks.find((d) => inRect(d, c.x, c.y));
  const deck = on ?? nearestDeckOn(land, water, c.x, c.y);
  if (deck) {
    const [sx, sy] = on ? [c.goalX, c.goalY] : [c.x, c.y];
    const [mx, my] = [deck.x + deck.w / 2, deck.y + deck.h / 2];
    const [fx, fy] = deck.eastWest
      ? [sx < mx ? deck.x : deck.x + deck.w, my]
      : [mx, sy < my ? deck.y : deck.y + deck.h];
    const arrive2 = tuning.move.arriveRadius * tuning.move.arriveRadius;
    if ((fx !== c.goalX || fy !== c.goalY) && dist2(c.x, c.y, fx, fy) > arrive2) {
      setGoal(c, fx, fy, world, land, tuning);
      return;
    }
  }
  c.visits[visitCell(c.goalX, c.goalY, tuning)] = Math.max(...c.visits);
  pickRandomGoal(c, world, land, tuning, rng);
}

function steer(c: Creature, land: Land, world: World, tuning: Tuning, rng: Rng): void {
  const sps = tuning.sim.stepsPerSecond;
  const maxSpeed = tuning.move.speed;
  const maxDv = tuning.move.accel / sps;
  const gx = c.goalX - c.x;
  const gy = c.goalY - c.y;
  const gl = Math.sqrt(gx * gx + gy * gy);
  const wantX = gl > 0 ? (gx / gl) * maxSpeed : 0;
  const wantY = gl > 0 ? (gy / gl) * maxSpeed : 0;
  let dvx = wantX - c.vx;
  let dvy = wantY - c.vy;
  const dl = Math.sqrt(dvx * dvx + dvy * dvy);
  if (dl > maxDv) {
    dvx = (dvx / dl) * maxDv;
    dvy = (dvy / dl) * maxDv;
  }
  c.vx += dvx;
  c.vy += dvy;
  const sp = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
  if (sp > maxSpeed) {
    c.vx = (c.vx / sp) * maxSpeed;
    c.vy = (c.vy / sp) * maxSpeed;
  }
  const nx = clamp(c.x + c.vx / sps, 0, tuning.scene.width);
  const ny = clamp(c.y + c.vy / sps, 0, tuning.scene.height);
  const water = waterBlocking(land, c.x, c.y, nx, ny);
  if (water) {
    turnFromWater(c, water, land, world, tuning, rng);
    return;
  }
  c.x = nx;
  c.y = ny;
}

/** An avoiding creature inside the lens heads for the point just outside it, straight from the centre. */
function leaveLens(c: Creature, world: World, land: Land, tuning: Tuning): void {
  const light = world.fields.light;
  if (!light || !avoidsLens(world, c) || !inLens(world, c.x, c.y, tuning)) return;
  const dx = c.x - light.x;
  const dy = c.y - light.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const r = tuning.light.lensRadius * 1.1;
  const x = clamp(light.x + (len > 0 ? (dx / len) * r : r), 0, tuning.scene.width);
  setGoal(c, x, clamp(light.y + (len > 0 ? (dy / len) * r : 0), 0, tuning.scene.height), world, land, tuning);
}

/**
 * One movement step for every creature, in array order. Only `wander` creatures move, forage, or
 * take drops. The hero picks no goal of its own and avoids no lens: it heads where the player sent
 * it (aimHero) and waits once it arrives.
 */
export function moveCreatures(world: World, tuning: Tuning, rng: Rng): void {
  const arrive2 = tuning.move.arriveRadius * tuning.move.arriveRadius;
  const land = landOf(world, tuning);
  for (const c of world.creatures) {
    if (c.state === 'meet' && world.tick >= c.stateUntilTick) c.state = 'wander';
    if (c.state !== 'wander') {
      c.vx = 0;
      c.vy = 0;
      continue;
    }
    forage(c, world, tuning);
    takeDrop(c, world, tuning);
    if (isHero(world, c)) {
      if (aimHero(world, c, tuning)) steer(c, land, world, tuning, rng);
    } else {
      if (dist2(c.x, c.y, c.goalX, c.goalY) <= arrive2) pickGoal(c, world, land, tuning, rng);
      leaveLens(c, world, land, tuning);
      steer(c, land, world, tuning, rng);
    }
    const cell = visitCell(c.x, c.y, tuning);
    c.visits[cell] = (c.visits[cell] ?? 0) + 1;
  }
}
