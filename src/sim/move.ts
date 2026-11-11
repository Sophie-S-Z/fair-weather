// Steering, goal choice, foraging, and visit counts (ADR 0005, ADR 0004 item 2, ADR 0003 item 9).
// Velocity is in world units per second; position advances by velocity / stepsPerSecond per tick.
import type { Creature, Structure, World } from './types.ts';
import type { Rng } from './rng.ts';
import type { Tuning } from './tuning.ts';
import { clamp, dist2 } from './math.ts';
import { avoidsLens, inLens } from './light.ts';
import { benchesOf, friendsOf } from './world.ts';

const COLS = 8;
const ROWS = 4;

function visitCell(c: Creature, tuning: Tuning): number {
  const col = clamp(Math.floor((c.x / tuning.scene.width) * COLS), 0, COLS - 1);
  const row = clamp(Math.floor((c.y / tuning.scene.height) * ROWS), 0, ROWS - 1);
  return row * COLS + col;
}

function pickGoal(c: Creature, world: World, tuning: Tuning, rng: Rng): void {
  // 1. A bench (ADR 0003 item 9).
  const benches = benchesOf(world);
  if (benches.length > 0) {
    const mem = c.benchMemory;
    let remembered: Structure | undefined;
    if (mem && mem.day === world.day - 1) remembered = benches.find((b) => b.id === mem.benchId);
    if (remembered) {
      if (rng.next() < tuning.goal.benchChance * tuning.meet.benchRepeatMultiplier) {
        c.goalX = remembered.x;
        c.goalY = remembered.y;
        return;
      }
    } else if (rng.next() < tuning.goal.benchChance) {
      const b = rng.pick(benches);
      c.goalX = b.x;
      c.goalY = b.y;
      return;
    }
  }
  // 2. The nearest bush with berries, when hungry.
  if (c.berries < 1) {
    let best: (typeof world.bushes)[number] | undefined;
    let bestD = Infinity;
    for (const b of world.bushes) {
      if (b.berries < 1) continue;
      const d = dist2(c.x, c.y, b.x, b.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best) {
      c.goalX = best.x;
      c.goalY = best.y;
      return;
    }
  }
  // 3. A random friend, with chance 1 - wanderlust.
  const friends = friendsOf(world, c, tuning);
  if (friends.length > 0 && rng.next() < 1 - c.dials.wanderlust) {
    const f = rng.pick(friends);
    c.goalX = f.x;
    c.goalY = f.y;
    return;
  }
  // 4. A random point in a least-visited cell.
  let least = Infinity;
  for (const v of c.visits) least = Math.min(least, v);
  const cells: number[] = [];
  c.visits.forEach((v, i) => {
    if (v === least) cells.push(i);
  });
  const cell = rng.pick(cells);
  const cw = tuning.scene.width / COLS;
  const ch = tuning.scene.height / ROWS;
  c.goalX = ((cell % COLS) + rng.next()) * cw;
  c.goalY = (Math.floor(cell / COLS) + rng.next()) * ch;
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

function steer(c: Creature, tuning: Tuning): void {
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
  c.x = clamp(c.x + c.vx / sps, 0, tuning.scene.width);
  c.y = clamp(c.y + c.vy / sps, 0, tuning.scene.height);
}

/** An avoiding creature inside the lens heads for the point just outside it, straight from the centre. */
function leaveLens(c: Creature, world: World, tuning: Tuning): void {
  const light = world.fields.light;
  if (!light || !avoidsLens(world, c) || !inLens(world, c.x, c.y, tuning)) return;
  const dx = c.x - light.x;
  const dy = c.y - light.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const r = tuning.light.lensRadius * 1.1;
  c.goalX = clamp(light.x + (len > 0 ? (dx / len) * r : r), 0, tuning.scene.width);
  c.goalY = clamp(light.y + (len > 0 ? (dy / len) * r : 0), 0, tuning.scene.height);
}

/** One movement step for every creature, in array order. Only `wander` creatures move or forage. */
export function moveCreatures(world: World, tuning: Tuning, rng: Rng): void {
  const arrive2 = tuning.move.arriveRadius * tuning.move.arriveRadius;
  for (const c of world.creatures) {
    if (c.state === 'meet' && world.tick >= c.stateUntilTick) c.state = 'wander';
    if (c.state !== 'wander') {
      c.vx = 0;
      c.vy = 0;
      continue;
    }
    forage(c, world, tuning);
    if (dist2(c.x, c.y, c.goalX, c.goalY) <= arrive2) pickGoal(c, world, tuning, rng);
    leaveLens(c, world, tuning);
    steer(c, tuning);
    c.visits[visitCell(c, tuning)] = (c.visits[visitCell(c, tuning)] ?? 0) + 1;
  }
}
