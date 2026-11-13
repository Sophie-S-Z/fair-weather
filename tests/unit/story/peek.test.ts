import { expect, test } from 'vitest';
import ch6Json from '../../../content/chapters/ch6.json';
import ch8Json from '../../../content/chapters/ch8.json';
import flagsJson from '../../../content/flags.json';
import scenarioJson from '../../../content/scenarios/m0.json';
import type { Scenario } from '../../../src/sim/types.ts';
import { parseFlags } from '../../../src/story/flags.ts';
import { peekRule } from '../../../src/story/peek.ts';
import { buildScenario } from '../../../src/story/scenario.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';

const dials = { opener: 0.4, forgiveness: 0.5, memory: 0.5, ear: 0.2, wanderlust: 0.1 };

test('the payoff is cost 1 and value 3, or 2 in winter (spec 9.3)', () => {
  expect(peekRule(dials, 'spring', false).payoff).toEqual({ cost: 1, value: 3 });
  expect(peekRule(dials, 'winter', false).payoff).toEqual({ cost: 1, value: 2 });
});

test("three lines give the creature's own numbers: Opener, slights forgiven, slight half-life", () => {
  const { lines } = peekRule(dials, 'autumn', false);
  expect(lines).toHaveLength(3);
  expect(lines[0]).toContain('40%');
  expect(lines[1]).toContain('forgives 2 slights'); // round(3 × 0.5)
  expect(lines[2]).toContain('15.5 days'); // 1 + 29 × 0.5
});

test('a Grudger forgives no slights and remembers for 30 days', () => {
  const { lines } = peekRule({ ...dials, forgiveness: 0, memory: 1 }, 'spring', false);
  expect(lines[1]).toContain('forgives 0 slights');
  expect(lines[2]).toContain('30 days');
});

test('one slight is singular', () => {
  expect(peekRule({ ...dials, forgiveness: 0.3 }, 'spring', false).lines[1]).toContain(
    'forgives 1 slight from',
  );
});

test("ch8's scenario forgives as friends do, and peek says so; ch6's does not", () => {
  const flags = parseFlags(flagsJson);
  const rule = (json: unknown) => {
    const s = buildScenario(ChapterSchema.parse(json), flags, scenarioJson as Scenario);
    return peekRule({ ...dials, forgiveness: 0 }, s.season, s.friendsForgive === true).lines[1];
  };
  expect(rule(ch8Json)).toContain('forgives 0 slights');
  expect(rule(ch8Json)).toContain('friends who are friends back, it forgives as many as they do');
  expect(rule(ch6Json)).not.toContain('friends back');
});
