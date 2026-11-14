// Player and story commands (spec 9, ADR 0002 items 7 and 8, ADR 0004 item 12, ADR 0005 item 4,
// ADR 0013 items 1 to 4 and 10).
import type { BidReply, Command, Creature, GiftMove, Season, SimEvent, World } from './types.ts';
import { DIAL_KEYS, HERO, SEASONS } from './types.ts';
import type { Rng } from './rng.ts';
import type { Tuning } from './tuning.ts';
import { clamp, dist2 } from './math.ts';
import { isHero, plantGift } from './hero.ts';
import { inWater } from './land.ts';
import { PACKS } from './packs/index.ts';
import { byId, ensureTie, side } from './world.ts';

const REPLIES: readonly BidReply[] = ['toward', 'away', 'against'];
const GIFT_MOVES: readonly GiftMove[] = ['give', 'keep'];
const PLACE_KINDS: readonly string[] = ['bench', 'bush', 'bridge', 'lantern'];

/** The creature with `id` when it exists and is not away. */
function present(world: World, id: unknown): Creature | undefined {
  if (typeof id !== 'string') return undefined;
  const c = byId(world, id);
  return c && c.state !== 'away' ? c : undefined;
}

function finite(...xs: unknown[]): boolean {
  return xs.every((x) => typeof x === 'number' && Number.isFinite(x));
}

/** True when (x, y) is a finite point inside the scene, edges included. */
function onScene(x: number, y: number, t: Tuning): boolean {
  return finite(x, y) && x >= 0 && x <= t.scene.width && y >= 0 && y <= t.scene.height;
}

function thread(world: World, a: Creature, b: Creature, on: boolean, t: Tuning): SimEvent[] {
  const tie = ensureTie(world, a, b, t);
  const events: SimEvent[] = [];
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    const s = side(tie, from.id);
    s.warmth = on ? Math.max(s.warmth, t.thread.warmth) : Math.min(s.warmth, 0);
    from.opinions[to.id] = s.warmth;
    events.push({ t: 'opinion', holder: from.id, about: to.id, value: s.warmth });
  }
  return events;
}

function paintFog(world: World, x: number, y: number, r: number, amount: number, t: Tuning): void {
  const { fog, fogW, fogH } = world.fields;
  const cs = t.fog.cellSize;
  for (let row = 0; row < fogH; row++) {
    for (let col = 0; col < fogW; col++) {
      const d = Math.sqrt(dist2((col + 0.5) * cs, (row + 0.5) * cs, x, y));
      if (d > r) continue;
      const i = row * fogW + col;
      fog[i] = clamp((fog[i] ?? 0) + amount * (1 - d / r), 0, 1);
    }
  }
}

/**
 * Adds a gust and pushes every active creature within wind.width / 2 of the segment from
 * (x, y) to (x + dx, y + dy) by wind.push along it.
 *
 * PRNG draws, per pushed creature in `world.creatures` order: the shift chance (shift when below
 * wind.dialShiftChance); on a shift, a dial pick over [opener, forgiveness, memory, ear,
 * wanderlust], then the amount draw: the dial moves by (2 x draw - 1) x wind.spread, clamped to [0, 1].
 * With a ridge, each pushed creature also walks to the gust's end, clamped to the scene (ADR 0012
 * item 3).
 */
function blow(world: World, x: number, y: number, dx: number, dy: number, t: Tuning, rng: Rng): void {
  world.fields.gusts.push({ x, y, dx, dy, untilTick: world.tick + t.wind.gustTicks });
  const len2 = dx * dx + dy * dy;
  const len = Math.sqrt(len2);
  const half = t.wind.width / 2;
  for (const c of world.creatures) {
    if (c.state === 'away') continue;
    const u = clamp(((c.x - x) * dx + (c.y - y) * dy) / len2, 0, 1);
    if (dist2(c.x, c.y, x + u * dx, y + u * dy) > half * half) continue;
    c.vx += (dx / len) * t.wind.push;
    c.vy += (dy / len) * t.wind.push;
    if (world.ridgeX !== undefined) {
      c.goalX = clamp(x + dx, 0, t.scene.width);
      c.goalY = clamp(y + dy, 0, t.scene.height);
    }
    if (rng.next() >= t.wind.dialShiftChance) continue;
    const dial = rng.pick(DIAL_KEYS);
    c.dials[dial] = clamp(c.dials[dial] + (2 * rng.next() - 1) * t.wind.spread, 0, 1);
  }
}

/**
 * Sends the hero to a point, clamped to the scene, or to follow a present creature (ADR 0013
 * item 2). Changes nothing without a present hero, or for a non-finite point or a creature that is
 * the hero, unknown, or away.
 */
function walk(world: World, cmd: Extract<Command, { t: 'walk' }>, t: Tuning): void {
  const hero = present(world, HERO);
  if (!world.hero || !hero) return;
  if ('to' in cmd) {
    const to = present(world, cmd.to);
    if (to && to !== hero) world.hero.waveTo = to.id;
  } else if (finite(cmd.x, cmd.y)) {
    hero.goalX = clamp(cmd.x, 0, t.scene.width);
    hero.goalY = clamp(cmd.y, 0, t.scene.height);
    world.hero.waveTo = null;
  }
}

/**
 * Applies one command. Returns [] and changes nothing for a command that is not an object, an
 * unknown or away creature id, a non-finite number, a shine, fog, gust start, or place point
 * outside the scene, a bridge outside water, an unknown tag or value, a pair naming one creature
 * twice, a fog radius of 0 or less, a gust whose length squared is 0 or overflows, a `walk` or
 * `manner` in a world without a hero, a `plant` by a hero that cannot (plantGift), or a `local` in a
 * world without a rule pack. Only `blow`, and a `local` as its pack's onVerb says, draw from the
 * PRNG.
 */
export function applyCommand(world: World, cmd: Command, t: Tuning, rng: Rng): SimEvent[] {
  const raw: unknown = cmd; // commands cross the worker boundary, so check at runtime
  if (typeof raw !== 'object' || raw === null) return [];
  switch (cmd.t) {
    case 'shine':
      if (!onScene(cmd.x, cmd.y, t)) return [];
      world.fields.light = { x: cmd.x, y: cmd.y };
      return [];
    case 'paintFog':
      if (!onScene(cmd.x, cmd.y, t) || !finite(cmd.r, cmd.amount) || cmd.r <= 0) return [];
      paintFog(world, cmd.x, cmd.y, cmd.r, cmd.amount, t);
      return [];
    case 'blow': {
      // A length squared of 0 (also by underflow) or Infinity gives no direction to push along.
      const len2 = cmd.dx * cmd.dx + cmd.dy * cmd.dy;
      if (!onScene(cmd.x, cmd.y, t) || !finite(cmd.dx, cmd.dy, len2) || len2 === 0) return [];
      blow(world, cmd.x, cmd.y, cmd.dx, cmd.dy, t, rng);
      return [];
    }
    case 'place': {
      if (!onScene(cmd.x, cmd.y, t)) return [];
      const kind: string = cmd.kind; // commands cross the worker boundary, so check at runtime
      if (!PLACE_KINDS.includes(kind)) return [];
      if (cmd.kind === 'bridge' && !inWater(world, cmd.x, cmd.y)) return [];
      const id = `${cmd.kind}-${String(world.nextId)}`;
      world.nextId += 1;
      if (cmd.kind === 'bush') world.bushes.push({ id, x: cmd.x, y: cmd.y, berries: 0 });
      else world.structures.push({ id, kind: cmd.kind, x: cmd.x, y: cmd.y });
      return [];
    }
    case 'thread': {
      const a = present(world, cmd.a);
      const b = present(world, cmd.b);
      if (!a || !b || a === b || typeof cmd.on !== 'boolean') return [];
      return thread(world, a, b, cmd.on, t);
    }
    case 'whisper': {
      const target = present(world, cmd.target);
      const about = present(world, cmd.about);
      const sign: number = cmd.sign; // checked at runtime, as above
      if (!target || !about || target === about || (sign !== 1 && sign !== -1)) return [];
      const value = cmd.sign * t.rumor.whisperStrength;
      target.opinions[about.id] = value;
      world.rumors.push({
        about: about.id,
        sign: cmd.sign,
        strength: t.rumor.whisperStrength,
        origin: target.id,
        tick: world.tick,
      });
      return [{ t: 'opinion', holder: target.id, about: about.id, value }];
    }
    case 'respond': {
      const c = present(world, cmd.to);
      if (!c || !REPLIES.includes(cmd.reply)) return [];
      const d = cmd.reply === 'toward' ? t.sky.toward : cmd.reply === 'away' ? t.sky.still : t.sky.rumble;
      c.skyWarmth = clamp(c.skyWarmth + d, -1, 1);
      return [];
    }
    case 'arrangeMeeting': {
      const a = present(world, cmd.a);
      const b = present(world, cmd.b);
      if (!a || !b || a === b) return [];
      // Only the player moves the hero, so the other creature comes to it (ADR 0013 item 1).
      const hero = [a, b].find((c) => isHero(world, c));
      const [mx, my] = hero ? [hero.x, hero.y] : [(a.x + b.x) / 2, (a.y + b.y) / 2];
      for (const c of [a, b]) {
        if (c === hero) continue;
        c.goalX = mx;
        c.goalY = my;
      }
      return [];
    }
    case 'setSeason':
      if (!(SEASONS as readonly Season[]).includes(cmd.season)) return [];
      world.season = cmd.season;
      return [];
    case 'wake': {
      // The event marks a real change: waking a creature that is not asleep does nothing.
      const c = present(world, cmd.who);
      if (c?.state !== 'sleep') return [];
      c.state = 'wander';
      return [{ t: 'wake', who: c.id }];
    }
    case 'promptSkyBid': {
      // The 6-second auto-respond with `away` is the story director's job, not the sim's.
      const c = present(world, cmd.who);
      return c ? [{ t: 'skyBid', who: c.id }] : [];
    }
    case 'dance': {
      // The event marks a real change, as for wake.
      const c = present(world, cmd.who);
      if (!c || c.dancing) return [];
      c.dancing = true;
      return [{ t: 'dance', who: c.id }];
    }
    case 'walk':
      walk(world, cmd, t);
      return [];
    case 'manner': {
      const { reply, gift } = cmd;
      if (!world.hero || !REPLIES.includes(reply) || !GIFT_MOVES.includes(gift)) return [];
      world.hero.reply = reply;
      world.hero.gift = gift;
      return [];
    }
    case 'plant':
      plantGift(world, t);
      return [];
    case 'local': {
      // The player's local verb goes to the valley's rule pack (ADR 0013 item 4).
      const verb: unknown = cmd.verb; // checked at runtime, as above
      if (!world.pack || typeof verb !== 'object' || verb === null) return [];
      return PACKS[world.pack.id].onVerb(world, cmd.verb, t, rng);
    }
    case 'nudge': {
      // A postcard nudges one dial of every creature not gone (ADR 0013 item 10), but the hero's,
      // which only the player moves (item 1).
      const { dial, amount } = cmd;
      if (!DIAL_KEYS.includes(dial) || !finite(amount)) return [];
      for (const c of world.creatures) {
        if (!c.gone && !isHero(world, c)) c.dials[dial] = clamp(c.dials[dial] + amount, 0, 1);
      }
      return [];
    }
    case 'overPoke':
      for (const c of world.creatures) {
        if (c.state === 'away') continue;
        c.skyWarmth = clamp(c.skyWarmth + t.overPoke.skyWarmth, -1, 1);
        c.lensAvoidUntilDay = world.day + t.light.days;
      }
      return [];
    default:
      return [];
  }
}
