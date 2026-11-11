import { describe, expect, test } from 'vitest';
import ch0Json from '../../../content/chapters/ch0.json';
import ch2Json from '../../../content/chapters/ch2.json';
import ch3Json from '../../../content/chapters/ch3.json';
import scenarioJson from '../../../content/scenarios/m0.json';
import type { Scenario } from '../../../src/sim/types.ts';
import type { Flags } from '../../../src/story/flags.ts';
import { buildScenario, chapterTicksPerDay, matches } from '../../../src/story/scenario.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';
import type { Chapter } from '../../../src/story/schema.ts';

const ch0 = ChapterSchema.parse(ch0Json);
const ch2 = ChapterSchema.parse(ch2Json);
const ch3 = ChapterSchema.parse(ch3Json);
const base = scenarioJson as Scenario;
const flags: Flags = {
  pimSkyBond: 0.5,
  pimSkyOpinion: 1,
  pimScar: false,
  benchPlaced: true,
  friendThreads: 3,
};
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
});
