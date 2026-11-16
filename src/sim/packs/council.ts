// Toadstool Council (ADR 0015 item 4): toadstools stand where they are, vote at each dusk under the
// council's rule, and the rain cloud goes to the winner. The hero may vote, and may propose a new
// rule once; the council remembers who asked. Nothing here draws.
import type { CouncilState, Creature, SimEvent, VotingRule, World } from '../types.ts';
import { HERO } from '../types.ts';
import type { Tuning } from '../tuning.ts';
import { clamp } from '../math.ts';
import { rain } from '../rain.ts';
import { heroSide, isHero } from './hero-tie.ts';
import type { RulePack } from './index.ts';

/** The toadstools' species: they never walk. */
export const TOADSTOOL = 'toadstool';

/** The rules the hero may propose (ADR 0015 item 4). */
const PROPOSALS: readonly VotingRule[] = ['approval', 'runoff', 'score'];

function councilOf(world: World): CouncilState | undefined {
  return world.pack?.id === 'council' ? world.pack : undefined;
}

/** A voter's utility for each spot, in spot order: 1 − d / √2, d the distance on the preference map. */
function utilities(c: CouncilState, pref: { wet: number; far: number }): number[] {
  return c.spots.map((s) => {
    const dw = s.wet - pref.wet;
    const df = s.far - pref.far;
    return 1 - Math.sqrt(dw * dw + df * df) / Math.sqrt(2);
  });
}

const mean = (u: readonly number[]): number => u.reduce((a, b) => a + b, 0) / u.length;

/** The index of the highest value among `among` (all by default); a tie goes to the earlier index. */
function top(values: readonly number[], among: readonly number[] = values.map((_, i) => i)): number {
  let best = among[0] ?? 0;
  for (const i of among) if ((values[i] ?? 0) > (values[best] ?? 0)) best = i;
  return best;
}

/**
 * The winning spot's index under `rule` for `ballots` (each voter's utilities, in spot order), as
 * ADR 0015 item 4 counts it. A voter's utility tie ranks the earlier spot first; a count tie goes to
 * the earlier spot, and a runoff round's tie for fewest removes the later.
 */
export function elect(rule: VotingRule, ballots: readonly number[][], spots: number): number {
  const counts = new Array<number>(spots).fill(0);
  switch (rule) {
    case 'plurality':
      for (const u of ballots) counts[top(u)] = (counts[top(u)] ?? 0) + 1;
      return top(counts);
    case 'approval':
      for (const u of ballots) {
        const m = mean(u);
        u.forEach((v, i) => {
          if (v >= m) counts[i] = (counts[i] ?? 0) + 1;
        });
      }
      return top(counts);
    case 'score':
      for (const u of ballots) u.forEach((v, i) => (counts[i] = (counts[i] ?? 0) + v));
      return top(counts);
    case 'runoff': {
      let left = counts.map((_, i) => i);
      while (left.length > 1) {
        const firsts = new Array<number>(spots).fill(0);
        for (const u of ballots) {
          const first = top(u, left);
          firsts[first] = (firsts[first] ?? 0) + 1;
        }
        let fewest = left[0] ?? 0;
        for (const i of left) if ((firsts[i] ?? 0) <= (firsts[fewest] ?? 0)) fewest = i;
        left = left.filter((i) => i !== fewest);
      }
      return left[0] ?? 0;
    }
  }
}

/** The voters, not away, in creature order: the creatures with a preference. */
function voters(world: World, c: CouncilState): Creature[] {
  return world.creatures.filter((x) => x.state !== 'away' && c.prefs[x.id] !== undefined);
}

/** True in the council for a toadstool: it stands where it is (ADR 0015 item 2). */
export function steersToadstool(world: World, c: Creature): boolean {
  return councilOf(world) !== undefined && c.speciesId === TOADSTOOL;
}

/**
 * The tally (ADR 0015 item 4): the voters' ballots and the hero's, the winner under the council's
 * rule, the rain at its spot, and the voters glad of it; at the first tally under the hero's rule,
 * each voter's warmth toward the hero rises when its winner gladdens more voters than plurality's
 * would, else falls.
 */
function tally(world: World, c: CouncilState, t: Tuning): SimEvent[] {
  const who = voters(world, c);
  const own = who.map((x) => utilities(c, c.prefs[x.id] ?? { wet: 0, far: 0 }));
  const heroSpot = c.spots.find((s) => s.id === c.heroVote);
  const ballots = heroSpot ? [...own, utilities(c, heroSpot)] : own;
  const glad = (i: number) => own.filter((u) => (u[i] ?? 0) > mean(u)).length;
  const won = elect(c.rule, ballots, c.spots.length);
  const spot = c.spots[won];
  if (!spot) return [];
  c.winner = spot.id;
  rain(world, spot.x, spot.y, t);
  const events: SimEvent[] = [{ t: 'tally', rule: c.rule, winner: spot.id, glad: glad(won) }];
  const hero = world.creatures.find((x) => isHero(world, x));
  if (c.proposed === null || c.heard || !hero) return events;
  c.heard = true;
  const better = glad(won) > glad(elect('plurality', ballots, c.spots.length));
  const glass = world.hero?.kind === 'glassling' ? t.knack.glassWarmth : 1;
  const change = (better ? t.council.warmth : -t.council.warmth) * glass;
  events.push({ t: 'heard', rule: c.rule, change });
  for (const x of who) {
    const s = heroSide(world, x, hero, t);
    s.warmth = clamp(s.warmth + change, -1, 1);
    x.opinions[HERO] = s.warmth;
    events.push({ t: 'opinion', holder: x.id, about: HERO, value: s.warmth });
  }
  return events;
}

export const council: RulePack = {
  id: 'council',

  /** Nothing to set up: createWorld copies the spots, the preferences, and the rule. No draws. */
  setup(): void {},

  /** On the last tick of each day, the council votes (tally). No draws. */
  step(world: World, events, t: Tuning) {
    const c = councilOf(world);
    if (!c || world.tick % world.ticksPerDay !== world.ticksPerDay - 1) return [];
    return tally(world, c, t);
  },

  /**
   * `vote` sets the hero's ballot to a spot's; `propose`, once, sets the rule the next tally uses.
   * Both need a hero. Other verbs do nothing here. No draws.
   */
  onVerb(world: World, verb) {
    const c = councilOf(world);
    if (!c || !world.hero) return [];
    if (verb.verb === 'vote' && c.spots.some((s) => s.id === verb.spot)) c.heroVote = verb.spot;
    if (verb.verb === 'propose' && c.proposed === null && PROPOSALS.includes(verb.rule)) {
      c.proposed = verb.rule;
      c.rule = verb.rule;
    }
    return [];
  },

  /** No numbers: the tally events carry them. */
  metrics() {
    return {};
  },
};
