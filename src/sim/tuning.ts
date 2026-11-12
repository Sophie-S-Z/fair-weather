// Tuning schema (spec 9, ADRs 0002 to 0005). Sim files import `Tuning` as a type only,
// so Zod stays out of the step code path.
import { z } from 'zod';

const prob = z.number().min(0).max(1); // probabilities and dial-like values
const signed = z.number().min(-1).max(1); // signed deltas and warmth thresholds
const count = z.number().int().positive();
const pos = z.number().positive();
const nonNeg = z.number().nonnegative();

const obj = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const TuningSchema = obj({
  sim: obj({ stepsPerSecond: count }),
  story: obj({
    dayLengthSeconds: count,
    honestyRetries: count,
    skyBidReplySeconds: pos,
    skyBidRepeatSeconds: pos,
  }),
  scene: obj({ width: count, height: count, gateX: nonNeg, gateY: nonNeg }),
  move: obj({ speed: pos, accel: pos, arriveRadius: pos }),
  meet: obj({ radius: pos, benchRepeatMultiplier: pos, durationTicks: count }),
  goal: obj({ benchChance: prob }),
  forage: obj({ carryMax: count, cooldownTicks: count }),
  eat: obj({ perDusk: count }),
  bush: obj({ limit: count, growth: prob, base: nonNeg }),
  opinion: obj({ holdAt: prob, weight: prob }),
  rumor: obj({ whisperStrength: prob }),
  thread: obj({ warmth: prob }),
  light: obj({ lensRadius: pos, boost: prob, radius: pos, cap: prob, days: count }),
  sky: obj({
    toward: signed,
    still: signed,
    rumble: signed,
    lightPerSecond: signed,
    lightDailyCap: prob,
    ambientBidChance: prob,
  }),
  overPoke: obj({ count, windowSeconds: pos, skyWarmth: signed }),
  shell: obj({
    colorRate: prob,
    colorFullAt: count,
    relaxRate: prob,
    betrayalTightness: prob,
    hungerBristle: prob,
    giftSoftness: prob,
  }),
  wind: obj({ width: pos, push: pos, dialShiftChance: prob, spread: prob, gustTicks: count }),
  fog: obj({
    cellSize: count,
    bidFlipFactor: prob,
    giftMisreadFactor: prob,
    brushRadius: pos,
    brushAmount: prob,
  }),
  population: obj({
    returnEveryDays: count,
    newcomerSparePerCreature: pos,
    leaveHungryDusks: count,
    leaveMinFriends: count,
    returnChanceWeekly: prob,
    returnMinAvgWarmth: signed,
    newcomerSpecies: z.string().min(1),
    newcomerDial: prob,
  }),
  bid: obj({ gain: pos, openerWeight: prob, hungerWeight: prob, againstBelowWarmth: signed }),
  gift: obj({ cost: count, value: count, valueWinter: count, maxSlightsPerForgiveness: count }),
  memory: obj({ halfLifeMinDays: pos, halfLifeSpanDays: pos }),
  warmth: obj({
    toward: signed,
    away: signed,
    against: signed,
    giftReceived: signed,
    keepAfterGift: signed,
    dailyDrift: prob,
  }),
  friend: obj({ threshold: prob }),
  gossip: obj({ simpleEarBelow: prob, simpleChance: prob }),
  imitation: obj({ everyDays: count, radius: pos, rate: prob, friendWeight: nonNeg }),
  art: obj({ minWarmth: signed, minBerries: nonNeg, days: count }),
  cap: obj({ story: count, sandbox: count }),
  mushroom: obj({
    drops: count,
    doubleAtMost: count,
    witherAtLeast: count,
    witherDays: count,
    takeBelowBerries: count,
    trustFriends: count,
  }),
  festival: obj({ threshold: count, everyTicks: count }),
  postcard: obj({ nudge: signed }),
  wisp: obj({ minWarmth: signed, minKithWarmth: signed }),
  halcyon: obj({ giftWarmthMultiplier: prob, keepsakeWarmth: signed }),
  bet: obj({ revealSpeed: pos }),
  bridge: obj({ radius: pos, landing: pos }),
  /**
   * The bank round each water rectangle, in scene units (ADR 0012 item 3): feet stay out of it,
   * except on a bridge deck, so no drawn body covers water. A body stands on its feet at (x, y)
   * and covers about x ± its half-width and y − its height to y. The widest is Moss, 96 wide (half
   * 48) at cast scale 1.2; with half its high-contrast ink line (2.5) and the sway (1.3), half 52 is
   * `side`, which also keeps a feet shadow (at most 14 tall below the feet) off the water when the
   * bank grows the top. The tallest is 64 (a villager) × 1.5 (the largest area factor) × 1.2 (cast
   * scale) = 115.2, plus half its ink line (4.3) and a dancer's hop (7): 126.5, so `below` is 128.
   */
  bank: obj({ side: pos, below: pos }),
  lantern: obj({ radius: pos, fogFactor: prob }),
});

export type Tuning = z.infer<typeof TuningSchema>;

/** Throws a ZodError when `json` does not match the schema. */
export function parseTuning(json: unknown): Tuning {
  return TuningSchema.parse(json);
}

export function ticksPerDay(t: Tuning): number {
  return t.sim.stepsPerSecond * t.story.dayLengthSeconds;
}
