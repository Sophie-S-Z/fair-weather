import { expect, test } from 'vitest';
import { ZodError } from 'zod';
import tuningJson from '../../../content/tuning.json';
import { parseTuning, ticksPerDay } from '../../../src/sim/tuning.ts';

function clone(): Record<string, Record<string, unknown>> {
  return JSON.parse(JSON.stringify(tuningJson)) as Record<string, Record<string, unknown>>;
}

test('the shipped file parses', () => {
  expect(() => parseTuning(tuningJson)).not.toThrow();
});

test('defaults equal the handoff and ADR values', () => {
  const t = parseTuning(tuningJson);
  expect(t.sim).toEqual({ stepsPerSecond: 10 });
  expect(t.story).toEqual({
    dayLengthSeconds: 40,
    honestyRetries: 3,
    skyBidReplySeconds: 6,
    skyBidRepeatSeconds: 4,
  });
  expect(t.scene).toEqual({ width: 1600, height: 900, gateX: 40, gateY: 450 });
  expect(t.move).toEqual({ speed: 40, accel: 80, arriveRadius: 8 });
  expect(t.meet).toEqual({ radius: 24, benchRepeatMultiplier: 2, durationTicks: 20 });
  expect(t.goal).toEqual({ benchChance: 0.25 });
  expect(t.forage).toEqual({ carryMax: 5, cooldownTicks: 50 });
  expect(t.eat).toEqual({ perDusk: 1 });
  expect(t.bush).toEqual({ limit: 10, growth: 0.2, base: 0.5 });
  expect(t.opinion).toEqual({ holdAt: 0.3, weight: 0.5 });
  expect(t.rumor).toEqual({ whisperStrength: 0.6 });
  expect(t.thread).toEqual({ warmth: 0.4 });
  expect(t.light).toEqual({ lensRadius: 120, boost: 0.15, radius: 300, cap: 0.3, days: 1 });
  expect(t.sky).toEqual({
    toward: 0.1,
    still: -0.03,
    rumble: -0.15,
    lightPerSecond: 0.01,
    lightDailyCap: 0.1,
    ambientBidChance: 0.5,
  });
  expect(t.overPoke).toEqual({ count: 8, windowSeconds: 30, skyWarmth: -0.05 });
  expect(t.shell).toEqual({
    colorRate: 0.2,
    colorFullAt: 5,
    relaxRate: 0.05,
    betrayalTightness: 0.1,
    hungerBristle: 0.05,
    giftSoftness: 0.05,
  });
  expect(t.wind).toEqual({ width: 80, push: 60, dialShiftChance: 0.2, spread: 0.15, gustTicks: 10 });
  expect(t.fog).toEqual({
    cellSize: 40,
    bidFlipFactor: 0.5,
    giftMisreadFactor: 0.5,
    brushRadius: 120,
    brushAmount: 0.3,
  });
  expect(t.population).toEqual({
    returnEveryDays: 7,
    newcomerSparePerCreature: 3,
    leaveHungryDusks: 4,
    leaveMinFriends: 2,
    returnChanceWeekly: 0.25,
    returnMinAvgWarmth: 0.2,
    newcomerSpecies: 'kith',
    newcomerDial: 0.5,
  });
  expect(t.bid).toEqual({ gain: 4, openerWeight: 0.5, hungerWeight: 0.3, againstBelowWarmth: -0.4 });
  expect(t.gift).toEqual({ cost: 1, value: 3, valueWinter: 2, maxSlightsPerForgiveness: 3 });
  expect(t.memory).toEqual({ halfLifeMinDays: 1, halfLifeSpanDays: 29 });
  expect(t.warmth).toEqual({
    toward: 0.1,
    away: -0.05,
    against: -0.15,
    giftReceived: 0.15,
    keepAfterGift: -0.2,
    dailyDrift: 0.02,
  });
  expect(t.friend).toEqual({ threshold: 0.3 });
  expect(t.gossip).toEqual({ simpleEarBelow: 0.1, simpleChance: 0.3 });
  expect(t.imitation).toEqual({ everyDays: 3, radius: 200, rate: 0.3, friendWeight: 2 });
  expect(t.art).toEqual({ minWarmth: 0.4, minBerries: 1.5, days: 2 });
  expect(t.cap).toEqual({ story: 30, sandbox: 60 });
  expect(t.mushroom).toEqual({
    drops: 10,
    doubleAtMost: 6,
    witherAtLeast: 9,
    witherDays: 3,
    takeBelowBerries: 1,
    trustFriends: 2,
  });
  expect(t.festival).toEqual({ threshold: 1, everyTicks: 10 });
  expect(t.postcard).toEqual({ nudge: 0.1 });
  expect(t.wisp).toEqual({ minWarmth: 0.6, minKithWarmth: 0.2 });
  expect(t.halcyon).toEqual({ giftWarmthMultiplier: 0.2, keepsakeWarmth: 0.6, chooseByDay: 3 });
  expect(t.kith).toEqual({ days: 20 });
  expect(t.bet).toEqual({ revealSpeed: 8 });
  expect(t.bridge).toEqual({ radius: 32, landing: 14 });
  expect(t.bank).toEqual({ side: 53, below: 123 });
  expect(t.lantern).toEqual({ radius: 120, fogFactor: 0.5 });
  expect(t.knack).toEqual({
    lanternFog: 0.5,
    kiteSpeed: 1.5,
    mossMemory: 2,
    mossDrift: 0.5,
    glassWarmth: 1.5,
    seedCost: 1,
    seedBerries: 3,
    seedDays: 2,
    seedWarmth: 0.1,
    bellRadius: 72,
    lanternSky: 2,
    bellPrints: 2,
  });
  expect(t.fen).toEqual({
    everyTicks: 10,
    duskAt: 0.75,
    duskLift: 0.15,
    neighbors: 7,
    thresholdMin: 0.2,
    thresholdSpan: 0.6,
  });
  expect(t.hollow).toEqual({
    skySpeed: 120,
    fameStep: 0.2,
    fameFade: 0.1,
    fearAt: 0.5,
    drama: { against: 3, keep: 2, away: 1, pose: 3 },
  });
});

test('ticksPerDay is 400 for the defaults', () => {
  expect(ticksPerDay(parseTuning(tuningJson))).toBe(400);
});

test('a missing key is rejected', () => {
  const j = clone();
  delete j['bid']?.['gain'];
  expect(() => parseTuning(j)).toThrow(ZodError);
  const k = clone();
  delete k['gift'];
  expect(() => parseTuning(k)).toThrow(ZodError);
});

test('an unknown key is rejected', () => {
  const j = clone();
  (j['bid'] as Record<string, unknown>)['extra'] = 1;
  expect(() => parseTuning(j)).toThrow(ZodError);
  expect(() => parseTuning({ ...clone(), surprise: {} })).toThrow(ZodError);
});

test('a probability above 1 is rejected', () => {
  const j = clone();
  (j['goal'] as Record<string, unknown>)['benchChance'] = 1.5;
  expect(() => parseTuning(j)).toThrow(ZodError);
});

test('a signed value outside -1..1 is rejected, and negatives are accepted', () => {
  const j = clone();
  (j['warmth'] as Record<string, unknown>)['against'] = -1.5;
  expect(() => parseTuning(j)).toThrow(ZodError);
  expect(parseTuning(tuningJson).warmth.against).toBe(-0.15);
});

test('a string in place of a number is rejected', () => {
  const j = clone();
  (j['sim'] as Record<string, unknown>)['stepsPerSecond'] = '10';
  expect(() => parseTuning(j)).toThrow(ZodError);
});
