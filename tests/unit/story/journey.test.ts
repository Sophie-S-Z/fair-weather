import { describe, expect, test } from 'vitest';
import ch0Json from '../../../content/chapters/ch0.json';
import type { WorldLite } from '../../../src/sim-host/protocol.ts';
import type { GiftMove, HeroKind } from '../../../src/sim/types.ts';
import type { ActionLog } from '../../../src/story/action-log.ts';
import type { Carry } from '../../../src/story/carry.ts';
import {
  CAPTION_LENGTH,
  JourneySchema,
  characters,
  heroResult,
  journeyStart,
  kithDays,
  kithLeg,
  leaveValley,
  newJourney,
  parseHero,
  rumorValue,
  saying,
  setCaption,
} from '../../../src/story/journey.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';
import type { Chapter } from '../../../src/story/schema.ts';

const ch0 = ChapterSchema.parse(ch0Json);
const valleyOf = (
  id: 'fen' | 'hollow' | 'halcyon',
  keepsake: { id: string; label: string } | null = null,
): Chapter => ({
  ...ch0,
  id,
  kind: 'valley',
  valley: { pack: id, guide: 'tove', postcards: ['generosity', 'wandering'], keepsake, locals: [] },
});
const fen = valleyOf('fen', { id: 'starling-feather', label: 'A starling feather' });

const dials = { opener: 0.5, forgiveness: 0.5, memory: 0.5, ear: 0.5, wanderlust: 0.5 };
const shell = { tightness: 0, bristle: 0, color: 0, softness: 0 };
const creature = (id: string, state: 'wander' | 'away' = 'wander'): WorldLite['creatures'][number] => ({
  id,
  speciesId: 'kith',
  x: 0,
  y: 0,
  state,
  shell,
  berries: 0,
  skyWarmth: 0,
  dials,
  dancing: false,
  gone: false,
});
/** A valley at its exit: `locals` wander and `away` are away, beside the hero. */
function liteOf(
  o: {
    locals?: string[];
    away?: string[];
    opinions?: Record<string, number>;
    ties?: WorldLite['ties'];
    kind?: HeroKind;
  } = {},
): WorldLite {
  const { locals = ['a'], away = [], opinions = {}, ties = [], kind = 'lantern' } = o;
  return {
    creatures: [
      creature('hero'),
      ...locals.map((id) => creature(id)),
      ...away.map((id) => creature(id, 'away')),
    ],
    ties,
    rumor: null,
    hero: { kind, name: 'Rook', reply: 'toward', gift: 'give', keepsakes: [], opinions },
    pack: null,
    light: null,
    fog: { w: 0, h: 0, cells: new Float32Array(0) },
    metrics: { averageWarmth: 0, friendPairs: 0 },
    structures: [],
    bushes: [],
    water: [],
    banks: [],
    decks: [],
    islets: [],
    mushroom: null,
  };
}
const gift = (move: GiftMove): ActionLog[number] => ({
  kind: 'hero',
  tick: 1,
  e: { t: 'gift', from: 'hero', to: 'a', move, seenAs: move },
});
const answer = (reply: 'toward' | 'against'): ActionLog[number] => ({
  kind: 'hero',
  tick: 1,
  e: { t: 'bid', from: 'a', to: 'hero', reply, seenAs: reply },
});
const start = newJourney('lantern', 'Rook', null, 1);

describe('reputation (ADR 0013 item 8)', () => {
  test.each([
    [[], 0, 0, 0],
    [['give', 'give'], 2, 0, 1],
    [['keep'], 1, 0, -1],
    [['give', 'keep'], 2, 1, -0.5],
  ] as [GiftMove[], number, number, number][])(
    'moves %o with %i answered and %i against give rumor value %d',
    (moves, answered, against, value) => {
      expect(rumorValue({ moves, answered, against })).toBe(value);
    },
  );

  test('the record keeps the last 20 moves', () => {
    const log = [...Array.from({ length: 15 }, () => gift('keep')), answer('against'), answer('toward')];
    const once = leaveValley(start, fen, liteOf(), log);
    const twice = leaveValley(
      once,
      valleyOf('hollow'),
      liteOf(),
      Array.from({ length: 10 }, () => gift('give')),
    );
    expect(twice.record).toEqual({
      moves: [...Array<GiftMove>(10).fill('keep'), ...Array<GiftMove>(10).fill('give')],
      answered: 2,
      against: 1,
    });
    // A Bellchime's wave is the hero's bid: the locals answer it, not the hero.
    const wave: ActionLog = [
      { kind: 'hero', tick: 1, e: { t: 'bid', from: 'hero', to: 'a', reply: 'against', seenAs: 'against' } },
    ];
    expect(leaveValley(start, fen, liteOf(), wave).record).toEqual({ moves: [], answered: 0, against: 0 });
  });

  test('rumor strength is the share of locals holding an opinion of the hero of at least 0.3', () => {
    const lite = liteOf({
      locals: ['a', 'b', 'c', 'd'],
      away: ['e'],
      opinions: { a: 0.3, b: -0.5, c: 0.29, e: 0.9 },
    });
    const j = leaveValley(start, fen, lite, [gift('give')]);
    expect(j.rumor).toEqual({ value: 1, strength: 0.5 });
    expect(j.pages[0]?.said).toEqual({ value: 1, strength: 0.5 });
  });

  test("leaving the Fen as a Kite-rider leaves the rumor as it was; the record still takes the Fen's moves", () => {
    const kite = newJourney('kite', 'Rook', null, 1);
    const lite = liteOf({ opinions: { a: 0.8 }, kind: 'kite' });
    const j = leaveValley(kite, fen, lite, [gift('keep')]);
    expect(j.rumor).toBeNull();
    expect(j.record.moves).toEqual(['keep']);
    expect(j.pages[0]?.said).toEqual({ value: -1, strength: 1 });
    expect(leaveValley(kite, valleyOf('hollow'), lite, [gift('keep')]).rumor).toEqual({
      value: -1,
      strength: 1,
    });
  });

  test.each([
    [0.3, 'welcomed'],
    [0, 'forgiven'],
    [-0.01, 'avoided'],
  ] as const)('mean warmth %d stamps %s', (warmth, stamp) => {
    // The locals' sides toward the hero, whichever end of the tie the hero is; the away creature is no local.
    const ties = [
      { a: 'a', b: 'hero', ab: warmth + 0.1, ba: 0.9 },
      { a: 'b', b: 'hero', ab: -0.9, ba: -0.9 },
      { a: 'a', b: 'b', ab: -0.9, ba: -0.9 },
      { a: 'hero', b: 'c', ab: -0.9, ba: warmth - 0.1 },
    ];
    const lite = liteOf({ locals: ['a', 'c'], away: ['b'], ties });
    expect(leaveValley(start, fen, lite, []).pages[0]?.stamp).toBe(stamp);
  });

  test('a valley with no locals gives strength 0 and stamps avoided', () => {
    const j = leaveValley(start, fen, liteOf({ locals: [], away: ['a'], opinions: { a: 0.9 } }), []);
    expect(j.rumor).toEqual({ value: 0, strength: 0 });
    expect(j.pages[0]?.stamp).toBe('avoided');
  });

  test('a valley with no tie to the hero stamps avoided', () => {
    const lite = liteOf({ locals: ['a', 'b'], ties: [{ a: 'a', b: 'b', ab: 0.9, ba: 0.9 }] });
    expect(leaveValley(start, fen, lite, []).pages[0]?.stamp).toBe('avoided');
  });
});

describe('the journey between valleys', () => {
  test('a valley adds its keepsake, a keepsake event marks one given, and the page takes the postcard', () => {
    const j = leaveValley(start, fen, liteOf(), [{ kind: 'postcard', tick: 9, type: 'wandering' }]);
    expect(j.keepsakes).toEqual([{ id: 'starling-feather', given: false }]);
    expect(j.pages).toEqual([
      {
        valley: 'fen',
        stamp: 'avoided',
        said: { value: 0, strength: 0 },
        keepsake: 'starling-feather',
        postcard: 'wandering',
        caption: '',
      },
    ]);
    const halcyon = valleyOf('halcyon');
    const given = leaveValley(j, halcyon, liteOf(), [
      { kind: 'event', tick: 5, e: { t: 'keepsake', to: 'wisp', item: 'starling-feather' } },
      { kind: 'event', tick: 6, e: { t: 'goHome', who: 'wisp' } },
    ]);
    expect(given.keepsakes).toEqual([{ id: 'starling-feather', given: true }]);
    expect(given.pages[1]).toMatchObject({ valley: 'halcyon', keepsake: null, postcard: null });
    expect(given.wisp).toBe('home');
    expect(journeyStart(given, 0.25)).toEqual({
      kind: 'lantern',
      name: 'Rook',
      keepsakes: [],
      rumor: { value: 0, strength: 0 },
      shell: { tightness: 0, bristle: 0, color: 0, softness: 0 },
      companion: 'wisp',
      kithWarmth: 0.25,
    });
    const stayed = leaveValley(j, halcyon, liteOf(), [
      { kind: 'event', tick: 6, e: { t: 'stay', who: 'wisp' } },
    ]);
    expect(journeyStart(stayed, 0)).toMatchObject({ keepsakes: ['starling-feather'], companion: 'seed' });
    expect(journeyStart(start, 0)).toMatchObject({ keepsakes: [], rumor: null, companion: null });
  });

  test("the hero's shell at a valley's exit carries into the next valley's start", () => {
    expect(start.shell).toBeNull();
    expect(journeyStart(start, 0).shell).toBeNull();
    const lite = liteOf();
    const line = { tightness: 0.1, bristle: 0, color: 0.2, softness: 0.3 };
    lite.creatures = lite.creatures.map((c) => (c.id === 'hero' ? { ...c, shell: line } : c));
    const j = leaveValley(start, fen, lite, []);
    expect(j.shell).toEqual(line);
    expect(journeyStart(j, 0).shell).toEqual(line);
    // A snapshot with no hero keeps the shell the journey had.
    lite.creatures = lite.creatures.filter((c) => c.id !== 'hero');
    expect(leaveValley(j, fen, lite, []).shell).toEqual(line);
  });

  test('kithDays gives 7, 7, 6, summing to 20', () => {
    expect([0, 1, 2].map(kithDays)).toEqual([7, 7, 6]);
    expect(() => kithDays(3)).toThrow();
  });

  test("kithLeg nudges by the sent postcard's dial, nothing after a skip, then runs the leg's days", () => {
    const home = { dayLengthSeconds: 40 }; // 400 ticks a day
    expect(kithLeg(0, 'patience', home)).toEqual({
      commands: [{ t: 'nudge', dial: 'forgiveness', amount: 0.1 }],
      ticks: 7 * 400,
    });
    expect(kithLeg(2, null, home)).toEqual({ commands: [], ticks: 6 * 400 });
  });

  test('parseHero keeps a name with a colon and gives the hero name for an empty one', () => {
    expect(parseHero(heroResult('glassling', 'Rook: of the Fen'))).toEqual({
      kind: 'glassling',
      name: 'Rook: of the Fen',
    });
    expect(parseHero('kite:   ')).toEqual({ kind: 'kite', name: 'Kite-rider' });
    expect(parseHero(`mosscoat:  ${'x'.repeat(30)}  `)).toEqual({ kind: 'mosscoat', name: 'x'.repeat(24) });
    // A space at the cut is trimmed, so heroResult and parseHero give the same name.
    const spaced = `${'a'.repeat(23)} bcd`;
    expect(heroResult('kite', spaced)).toBe(`kite:${'a'.repeat(23)}`);
    expect(parseHero(heroResult('kite', spaced))).toEqual(parseHero(`kite:${spaced}`));
    expect(() => parseHero('dragon:Rook')).toThrow();
    expect(() => parseHero('Rook')).toThrow();
  });

  test('saying reads the value and the strength', () => {
    expect(saying({ value: 0.3, strength: 0.5 })).toBe(
      '[PLACEHOLDER] Most here say [PLACEHOLDER] you share.',
    );
    expect(saying({ value: -0.3, strength: 0.2 })).toBe(
      '[PLACEHOLDER] Some here say [PLACEHOLDER] you keep what you have.',
    );
    expect(saying({ value: 0.29, strength: 0.19 })).toBe(
      '[PLACEHOLDER] A few here say [PLACEHOLDER] they cannot tell what you will do.',
    );
  });

  test('JourneySchema round-trips a journey', () => {
    const kithStart: Carry = {
      creatures: [{ id: 'pim', dials, shell, skyWarmth: 0.2, away: false, gone: false, diary: ['Danced.'] }],
      ties: [{ a: 'krit', b: 'pim', ab: 0.1, ba: -0.2 }],
    };
    const j = leaveValley(
      newJourney('bellchime', 'Rook', kithStart, 2),
      fen,
      liteOf({ opinions: { a: 0.5 } }),
      [gift('give'), answer('against'), { kind: 'postcard', tick: 9, type: 'generosity' }],
    );
    const saved: unknown = JSON.parse(JSON.stringify(j));
    expect(JourneySchema.parse(saved)).toEqual(j);
    expect(JourneySchema.parse(JSON.parse(JSON.stringify(start)))).toEqual(start);
    expect(() => JourneySchema.parse({ ...j, wisp: 'away' })).toThrow();
    // The caption counts characters as the name does: 80 emoji pass, 81 do not.
    const captioned = (caption: string): unknown => ({
      ...j,
      pages: j.pages.map((p) => ({ ...p, caption })),
    });
    expect(characters('🌧️'.repeat(80))).toHaveLength(80);
    expect(() => JourneySchema.parse(captioned('🌧️'.repeat(CAPTION_LENGTH)))).not.toThrow();
    expect(() => JourneySchema.parse(captioned('🌧️'.repeat(CAPTION_LENGTH + 1)))).toThrow();
  });

  test("setCaption keeps the player's line on the valley's page, cut to 80 characters", () => {
    const j = leaveValley(start, fen, liteOf(), []);
    setCaption(j, 'fen', 'Rain on the reeds');
    expect(j.pages[0]?.caption).toBe('Rain on the reeds');
    // Graphemes, as the name counts them: an emoji is one character.
    setCaption(j, 'fen', '🌧️'.repeat(CAPTION_LENGTH + 5));
    expect(characters(j.pages[0]?.caption ?? '')).toHaveLength(CAPTION_LENGTH);
    expect(() => JourneySchema.parse(j)).not.toThrow();
    setCaption(j, 'fen', '');
    expect(j.pages[0]?.caption).toBe('');
    // A valley without a page changes nothing.
    expect(() => {
      setCaption(j, 'hollow', 'x');
    }).not.toThrow();
    expect(j.pages).toHaveLength(1);
  });
});
