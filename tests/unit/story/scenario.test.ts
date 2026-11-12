import { describe, expect, test } from 'vitest';
import ch0Json from '../../../content/chapters/ch0.json';
import ch2Json from '../../../content/chapters/ch2.json';
import ch3Json from '../../../content/chapters/ch3.json';
import flagsJson from '../../../content/flags.json';
import scenarioJson from '../../../content/scenarios/m0.json';
import type { Scenario } from '../../../src/sim/types.ts';
import { parseFlags } from '../../../src/story/flags.ts';
import type { Flags } from '../../../src/story/flags.ts';
import type { Carry } from '../../../src/story/carry.ts';
import { buildScenario, chapterTicksPerDay, matches } from '../../../src/story/scenario.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';
import type { Chapter, Overrides } from '../../../src/story/schema.ts';

const ch0 = ChapterSchema.parse(ch0Json);
const ch2 = ChapterSchema.parse(ch2Json);
const ch3 = ChapterSchema.parse(ch3Json);
const base = scenarioJson as Scenario;
const flags: Flags = parseFlags(flagsJson); // the gentle defaults
const pimOf = (s: Scenario) => s.creatures.find((c) => c.id === 'pim');

describe('chapterTicksPerDay', () => {
  test('is stepsPerSecond × dayLengthSeconds', () => {
    expect(chapterTicksPerDay(ch2)).toBe(450);
    expect(chapterTicksPerDay(ch0)).toBe(600);
  });
  test('throws when a day is not a whole number of ticks', () => {
    expect(() => chapterTicksPerDay({ dayLengthSeconds: 4.55 })).toThrow('ticks per day');
  });
});

describe('matches', () => {
  test('eq, gte, and lte', () => {
    expect(matches({ flag: 'pimScar', op: 'eq', value: false }, flags)).toBe(true);
    expect(matches({ flag: 'pimScar', op: 'eq', value: true }, flags)).toBe(false);
    expect(matches({ flag: 'friendThreads', op: 'gte', value: 3 }, flags)).toBe(true);
    expect(matches({ flag: 'friendThreads', op: 'gte', value: 4 }, flags)).toBe(false);
    expect(matches({ flag: 'pimSkyBond', op: 'lte', value: 0.5 }, flags)).toBe(true);
    expect(matches({ flag: 'pimSkyBond', op: 'lte', value: 0.4 }, flags)).toBe(false);
  });
  test('gte on a boolean flag throws', () => {
    expect(() => matches({ flag: 'pimScar', op: 'gte', value: 1 }, flags)).toThrow(
      "'gte' needs a numeric flag",
    );
  });
});

describe('buildScenario', () => {
  test('sets the chapter season, day length, and overrides', () => {
    const s = buildScenario(ch2, flags, { ...base, season: 'winter' });
    expect(s.season).toBe('spring');
    expect(s.ticksPerDay).toBe(450);
    expect(pimOf(s)).toMatchObject({ x: 400, y: 130 });
    expect(s.creatures.find((c) => c.id === 'krit')).toMatchObject({ x: 440, y: 130 });
    const sleeping = buildScenario(ch0, flags, base).creatures.filter((c) => c.state === 'sleep');
    // Everyone sleeps at ch0's dawn (ch0_dawn says so), villagers too.
    expect(sleeping.map((c) => c.id)).toEqual(base.creatures.map((c) => c.id));
  });

  test("ch3's variant gives a scarred Pim opener 0.7, and leaves an unscarred Pim alone", () => {
    expect(pimOf(buildScenario(ch3, { ...flags, pimScar: true }, base))?.dials).toEqual({
      ...pimOf(base)?.dials,
      opener: 0.7,
    });
    expect(pimOf(buildScenario(ch3, { ...flags, pimScar: false }, base))?.dials).toEqual(pimOf(base)?.dials);
  });

  test('of two matching variants the first wins, and a variant beats the overrides', () => {
    const chapter: Chapter = {
      ...ch3,
      overrides: { dials: { pim: { opener: 0.1, ear: 0.2 } } },
      variants: [
        {
          when: { flag: 'benchPlaced', op: 'eq', value: true },
          overrides: { dials: { pim: { opener: 0.3 } } },
        },
        {
          when: { flag: 'friendThreads', op: 'gte', value: 1 },
          overrides: { dials: { pim: { opener: 0.9 } } },
        },
      ],
    };
    expect(pimOf(buildScenario(chapter, flags, base))?.dials).toMatchObject({ opener: 0.3, ear: 0.2 });
  });

  test('a weather season override beats the chapter season', () => {
    const chapter: Chapter = { ...ch2, overrides: { weather: { season: 'thaw' } } };
    expect(buildScenario(chapter, flags, base).season).toBe('thaw');
  });

  test('does not mutate the base', () => {
    const before = structuredClone(base);
    buildScenario(ch3, { ...flags, pimScar: true }, base);
    buildScenario(ch2, flags, base);
    expect(base).toEqual(before);
  });

  test('throws on an unknown id and on a light override', () => {
    const unknown: Chapter = { ...ch2, overrides: { positions: { nobody: { x: 1, y: 1 } } } };
    expect(() => buildScenario(unknown, flags, base)).toThrow('unknown creature "nobody"');
    const light: Chapter = { ...ch2, overrides: { weather: { light: { x: 1, y: 1 } } } };
    expect(() => buildScenario(light, flags, base)).toThrow('weather.light');
  });

  const shell = { tightness: 0.5, bristle: 0.1, color: 0.2, softness: 0.3 };
  const carried = (id: string, opener: number, away = false, gone = false): Carry['creatures'][number] => ({
    id,
    dials: { opener, forgiveness: 0.1, memory: 0.2, ear: 0.3, wanderlust: 0.4 },
    shell,
    skyWarmth: -0.25,
    away,
    gone,
    diary: [],
  });
  const carry: Carry = {
    creatures: [
      carried('pim', 0.2),
      carried('krit', 0.4, true),
      carried('wisp', 0.4, true, true),
      carried('kith-31', 0.5),
    ],
    ties: [
      { a: 'krit', b: 'moss', ab: 0.3, ba: -0.2 },
      { a: 'kith-31', b: 'pim', ab: 0.9, ba: 0.9 },
    ],
  };
  const carried4: Chapter = { ...ch3, carry: true, overrides: {}, variants: [] };

  test('buildScenario applies a carry to base creatures only, then overrides win', () => {
    const chapter: Chapter = { ...carried4, overrides: { dials: { pim: { opener: 0.9 } } } };
    const s = buildScenario(chapter, flags, base, carry);
    expect(pimOf(s)).toMatchObject({
      dials: { opener: 0.9, forgiveness: 0.1, memory: 0.2, ear: 0.3, wanderlust: 0.4 },
      shell,
      skyWarmth: -0.25,
    });
    expect(s.creatures.map((c) => c.id)).toEqual(base.creatures.map((c) => c.id));
    expect(s.ties).toEqual([
      { a: 'krit', b: 'moss', ab: { warmth: 0.3, slights: 0 }, ba: { warmth: -0.2, slights: 0 } },
    ]);
  });

  test('a carried chapter keeps Krit away; a fresh chapter does not', () => {
    const kritOf = (s: Scenario) => s.creatures.find((c) => c.id === 'krit');
    expect(kritOf(buildScenario(carried4, flags, base, carry))?.state).toBe('away');
    expect(kritOf(buildScenario(ch3, flags, base))?.state).toBeUndefined();
  });

  test("a carried leaver stays away under '*', and a carried gone creature stays gone", () => {
    const chapter: Chapter = { ...carried4, overrides: { state: { '*': 'sleep', wisp: 'wander' } } };
    const s = buildScenario(chapter, flags, base, carry);
    const of = (id: string) => s.creatures.find((c) => c.id === id);
    expect(of('krit')?.state).toBe('away');
    expect(of('wisp')).toMatchObject({ gone: true }); // the sim keeps a gone creature away
    expect(pimOf(s)?.state).toBe('sleep');
    expect(buildScenario(carried4, flags, base).creatures.some((c) => c.gone)).toBe(false);
  });

  test('grudges set the holder side slights on the carried tie', () => {
    const chapter: Chapter = {
      ...carried4,
      overrides: {
        grudges: [
          { holder: 'moss', against: 'krit', slights: 1 },
          { holder: 'bell', against: 'echo', slights: 2 },
        ],
      },
    };
    expect(buildScenario(chapter, flags, base, carry).ties).toEqual([
      { a: 'krit', b: 'moss', ab: { warmth: 0.3, slights: 0 }, ba: { warmth: -0.2, slights: 1 } },
      // A pair that never met starts a tie at warmth 0.
      { a: 'bell', b: 'echo', ab: { warmth: 0, slights: 2 }, ba: { warmth: 0, slights: 0 } },
    ]);
  });

  test("state '*' sets every creature; a named id wins", () => {
    const chapter: Chapter = { ...ch3, overrides: { state: { '*': 'sleep', pim: 'wander' } } };
    const s = buildScenario(chapter, flags, base);
    expect(s.creatures.filter((c) => c.state !== 'sleep').map((c) => c.id)).toEqual(['pim']);
    expect(pimOf(s)?.state).toBe('wander');
  });

  test('when [a, b] needs both conditions', () => {
    const chapter: Chapter = {
      ...ch3,
      overrides: {},
      variants: [
        {
          when: [
            { flag: 'benchPlaced', op: 'eq', value: true },
            { flag: 'friendThreads', op: 'gte', value: 4 },
          ],
          overrides: { dials: { pim: { opener: 0.1 } } },
        },
      ],
    };
    expect(pimOf(buildScenario(chapter, flags, base))?.dials.opener).toBe(pimOf(base)?.dials.opener);
    expect(pimOf(buildScenario(chapter, { ...flags, friendThreads: 4 }, base))?.dials.opener).toBe(0.1);
  });

  test('land, gone, festival, and mushroom overrides set the scenario', () => {
    const bushes = [{ id: 'bush-9', x: 300, y: 300, berries: 2 }];
    const chapter: Chapter = {
      ...ch3,
      overrides: {
        structures: [{ id: 'bridge-1', kind: 'bridge', x: 800, y: 500 }],
        bushes,
        water: [{ x: 780, y: 0, w: 40, h: 900 }],
        ridgeX: 1500,
        gone: ['wisp'],
        danceThreshold: { bell: 3 },
        mushroom: { x: 200, y: 600 },
        ambientSkyBids: true,
      },
    };
    const s = buildScenario(chapter, flags, base);
    expect(s).toMatchObject({
      structures: [{ id: 'bridge-1', kind: 'bridge', x: 800, y: 500 }],
      bushes,
      water: [{ x: 780, y: 0, w: 40, h: 900 }],
      ridgeX: 1500,
      mushroom: { x: 200, y: 600 },
      ambientSkyBids: true,
    });
    expect(s.creatures.find((c) => c.id === 'wisp')).toMatchObject({ gone: true, state: 'away' });
    expect(s.creatures.find((c) => c.id === 'bell')?.danceThreshold).toBe(3);
  });

  test('throws when a creature, a bush, a bench, or the gate stands in water or past the ridge', () => {
    const wetAt = (x: number, y: number): Overrides => ({ water: [{ x: x - 5, y: y - 5, w: 10, h: 10 }] });
    const build = (overrides: Overrides) => buildScenario({ ...ch3, overrides }, flags, base);
    expect(() => build(wetAt(160, 130))).toThrow('pim stands in water');
    expect(() => build(wetAt(240, 260))).toThrow('bush-1 stands in water');
    expect(() =>
      build({ ...wetAt(800, 500), structures: [{ id: 'bench-1', kind: 'bench', x: 800, y: 500 }] }),
    ).toThrow('bench-1 stands in water');
    expect(() =>
      build({ ...wetAt(800, 500), structures: [{ id: 'bridge-1', kind: 'bridge', x: 800, y: 500 }] }),
    ).not.toThrow();
    expect(() => build({ structures: [{ id: 'bridge-1', kind: 'bridge', x: 800, y: 500 }] })).toThrow(
      'bridge-1 stands on dry land',
    );
    expect(() => build(wetAt(40, 450))).toThrow('the gate stands in water');
    expect(() => build({ ridgeX: 1440 })).toThrow('bell stands at or past the ridge');
    // A gone creature is over the ridge already, so it is not checked.
    const east = base.creatures.filter((c) => c.x >= 1440).map((c) => c.id);
    const bushes = base.bushes.filter((b) => b.x < 1440);
    expect(() => build({ ridgeX: 1440, gone: east, bushes })).not.toThrow();
  });
});
