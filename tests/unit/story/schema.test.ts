import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { FLAG_KEYS, FlagsSchema, parseFlags } from '../../../src/story/flags.ts';
import { ChapterSchema } from '../../../src/story/schema.ts';

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../content/${name}.json`, import.meta.url), 'utf8'));
const ids = ['ch0', 'ch1', 'ch2', 'ch3'];

describe('ChapterSchema', () => {
  test.each(ids)('%s parses', (id) => {
    const ch = ChapterSchema.parse(load(`chapters/${id}`));
    expect(ch.id).toBe(id);
    expect(ch.notes.length).toBeGreaterThanOrEqual(2);
  });

  test('new verbs follow spec 6.2 and each chapter unlocks one more', () => {
    const chs = ids.map((id) => ChapterSchema.parse(load(`chapters/${id}`)));
    expect(chs.map((c) => c.newVerb)).toEqual(['wake', 'respond', 'bet', 'place']);
    expect(chs.map((c) => c.verbs)).toEqual([
      ['wake'],
      ['wake', 'respond'],
      ['wake', 'respond', 'bet', 'peek', 'zoom'], // spec 8 teaches peek and zoom in chapter 2
      ['wake', 'respond', 'bet', 'place', 'peek', 'zoom'],
    ]);
    expect(chs.map((c) => c.carry)).toEqual([false, false, false, false]);
    expect(chs[2]?.twist?.id).toBe('kritExploitsPim');
    expect(chs[3]?.twist?.id).toBe('benchWarmsVillage');
  });

  test('a chapter with 3 variants fails', () => {
    const ch = load('chapters/ch3') as { variants: unknown[] };
    const v = ch.variants[0];
    expect(ChapterSchema.safeParse({ ...ch, variants: [v, v, v] }).success).toBe(false);
    expect(ChapterSchema.safeParse({ ...ch, variants: [v, v] }).success).toBe(true);
  });

  test('a beat with an unknown action fails', () => {
    const ch = load('chapters/ch0') as { beats: { actions: unknown[] }[] };
    const beats = [{ ...ch.beats[0], actions: [{ teleport: true }] }];
    expect(ChapterSchema.safeParse({ ...ch, beats }).success).toBe(false);
  });

  test('a chapter listing four world verbs fails the schema', () => {
    const ch = load('chapters/ch3') as object;
    const verbs = ['wake', 'respond', 'place', 'shine'];
    expect(ChapterSchema.safeParse({ ...ch, verbs }).success).toBe(false);
    expect(
      ChapterSchema.safeParse({ ...ch, verbs: [...verbs.slice(1), 'bet', 'listen', 'rewind'] }).success,
    ).toBe(true);
  });

  test('a danceThreshold must be a positive integer', () => {
    const ch = load('chapters/ch3') as object;
    const with_ = (n: number) => ({ ...ch, overrides: { danceThreshold: { bell: n } } });
    expect(ChapterSchema.safeParse(with_(3)).success).toBe(true);
    expect(ChapterSchema.safeParse(with_(0)).success).toBe(false);
    expect(ChapterSchema.safeParse(with_(1.5)).success).toBe(false);
  });

  test('a chapter with a twist fails unless a beat tells it on the twist trigger', () => {
    const ch = load('chapters/ch3') as { beats: { trigger: object }[] };
    const beats = ch.beats.map((b) => ('twist' in b.trigger ? { ...b, trigger: { at: 30 } } : b));
    expect(ChapterSchema.safeParse({ ...ch, beats }).success).toBe(false);
  });

  test('titles are the spec 6.2 names', () => {
    expect(ids.map((id) => ChapterSchema.parse(load(`chapters/${id}`)).title)).toEqual([
      'First Light',
      'The Wave',
      'Five Neighbors',
      'The Bench',
    ]);
  });

  test('notes outside 2 to 4 fail', () => {
    const ch = load('chapters/ch0') as { notes: unknown[] };
    expect(ChapterSchema.safeParse({ ...ch, notes: ch.notes.slice(0, 1) }).success).toBe(false);
  });

  test('a note without a source fails the schema; an interlude with no notes passes', () => {
    const ch = load('chapters/ch0') as { notes: object[] };
    const [first, second] = ch.notes;
    expect(ChapterSchema.safeParse({ ...ch, notes: [first, { ...second, sources: [] }] }).success).toBe(
      false,
    );
    const interlude = { ...ch, kind: 'interlude', activity: 'rhythm', notes: [] };
    expect(ChapterSchema.safeParse(interlude).success).toBe(true);
    expect(ChapterSchema.safeParse({ ...interlude, kind: 'chapter' }).success).toBe(false);
    expect(ChapterSchema.safeParse({ ...interlude, activity: undefined }).success).toBe(false); // ADR 0012 item 9
  });

  test('a numeric bet needs one bucket fewer than its options, low to high; a who bet takes none', () => {
    const ch = load('chapters/ch2') as { bet: object };
    const bet = (b: object) => ({ ...ch, bet: { ...ch.bet, ...b } });
    const rumor = { metric: { kind: 'rumorShare' }, options: ['few', 'half', 'most'] };
    expect(ChapterSchema.safeParse(bet({ ...rumor, buckets: [0.25, 0.5] })).success).toBe(true);
    expect(ChapterSchema.safeParse(bet(rumor)).success).toBe(false);
    expect(ChapterSchema.safeParse(bet({ ...rumor, buckets: [0.25] })).success).toBe(false);
    expect(ChapterSchema.safeParse(bet({ ...rumor, buckets: [0.5, 0.25] })).success).toBe(false);
    expect(ChapterSchema.safeParse(bet({ buckets: [1, 2, 3, 4, 5] })).success).toBe(false); // maxBerries
    const pairs = { metric: { kind: 'friendPairs' }, options: ['few', 'many'] };
    expect(ChapterSchema.safeParse(bet(pairs)).success).toBe(false); // every number needs buckets
    expect(ChapterSchema.safeParse(bet({ ...pairs, buckets: [3] })).success).toBe(true);
    const thorns = { metric: { kind: 'maxShell', shell: 'tightness' } };
    expect(ChapterSchema.safeParse(bet(thorns)).success).toBe(true);
    expect(ChapterSchema.safeParse(bet({ ...thorns, buckets: [1, 2, 3, 4, 5] })).success).toBe(false);
  });
});

describe('valleys', () => {
  const ch = load('chapters/ch3') as { twist: object; beats: object[]; writes: string[] };
  const card = { id: 'card', trigger: { at: 5 }, actions: [{ postcard: true }] };
  const block = {
    pack: 'fen',
    guide: 'pim',
    postcards: ['generosity', 'wandering'],
    keepsake: { id: 'starling-feather', label: 'a starling feather' },
    locals: ['[PLACEHOLDER] A local line.'],
  };
  const valley = {
    ...ch,
    kind: 'valley',
    scenario: 'fen',
    palette: 'fen',
    valley: block,
    beats: [...ch.beats, card],
  };

  test('a valley without its valley block, or a chapter with one, fails the schema', () => {
    expect(ChapterSchema.safeParse(valley).success).toBe(true);
    expect(ChapterSchema.safeParse({ ...valley, valley: undefined }).success).toBe(false);
    expect(ChapterSchema.safeParse({ ...ch, valley: block }).success).toBe(false);
  });

  test('a valley with postcards needs a beat that opens the card', () => {
    expect(ChapterSchema.safeParse({ ...valley, beats: ch.beats }).success).toBe(false);
  });

  test('no config may write kithHeld, which only the game sets', () => {
    expect(ChapterSchema.safeParse({ ...valley, writes: [...ch.writes, 'toveFlew'] }).success).toBe(true);
    expect(ChapterSchema.safeParse({ ...valley, writes: [...ch.writes, 'kithHeld'] }).success).toBe(false);
  });

  test('a Part 1 chapter takes scenario m0 and no palette by default', () => {
    const parsed = ChapterSchema.parse(ch);
    expect(parsed.scenario).toBe('m0');
    expect(parsed.palette).toBeUndefined();
    expect(parsed.valley).toBeUndefined();
  });

  test('a valley offers two or three postcards, or none for the homecoming (pack null)', () => {
    const cards = (postcards: string[]) => ({ ...valley, valley: { ...block, postcards } });
    expect(ChapterSchema.safeParse(cards([])).success).toBe(false);
    const home = { ...valley, beats: ch.beats, valley: { ...block, pack: null, postcards: [] } };
    expect(ChapterSchema.safeParse(home).success).toBe(true);
    expect(ChapterSchema.safeParse(cards(['patience', 'remembering', 'listening'])).success).toBe(true);
    expect(ChapterSchema.safeParse(cards(['patience'])).success).toBe(false);
    expect(ChapterSchema.safeParse(cards(['patience', 'patience'])).success).toBe(false);
    expect(
      ChapterSchema.safeParse(cards(['patience', 'remembering', 'listening', 'wandering'])).success,
    ).toBe(false);
    expect(ChapterSchema.safeParse(cards(['kindness', 'patience'])).success).toBe(false);
  });

  test('a valley has 2 to 4 notes, and a twist retry may not name the hero', () => {
    const notes = (valley as unknown as { notes: unknown[] }).notes;
    expect(ChapterSchema.safeParse({ ...valley, notes: notes.slice(0, 1) }).success).toBe(false);
    const retry = (pair: string[]) => ({ ...valley, twist: { ...ch.twist, retryArrange: pair } });
    expect(ChapterSchema.safeParse(retry(['tove', 'starling-1'])).success).toBe(true);
    expect(ChapterSchema.safeParse(retry(['tove', 'hero'])).success).toBe(false);
  });

  test('the postcard trigger and action, and the hero activity, parse', () => {
    const beats = [...valley.beats, { id: 'sent', trigger: { postcard: true }, actions: [] }];
    expect(ChapterSchema.safeParse({ ...valley, beats, exit: { onBeat: 'sent' } }).success).toBe(true);
    const bridge = { ...ch, kind: 'interlude', activity: 'hero', notes: [], twist: undefined };
    expect(ChapterSchema.safeParse(bridge).success).toBe(true);
  });
});

describe('exit.onBeat', () => {
  test('must name a beat in the chapter', () => {
    const ch = load('chapters/ch0') as object;
    expect(ChapterSchema.safeParse({ ...ch, exit: { onBeat: 'nope' } }).success).toBe(false);
    expect(ChapterSchema.safeParse({ ...ch, exit: { onBeat: 'dawn' } }).success).toBe(true);
  });
  test('ch2 bet offers all six cast members', () => {
    expect(ChapterSchema.parse(load('chapters/ch2')).bet?.options).toHaveLength(6);
  });
});

describe('flags.json', () => {
  test('holds the gentle defaults', () => {
    expect(parseFlags(load('flags'))).toEqual({
      pimSkyBond: 0.5,
      pimSkyOpinion: 1,
      pimScar: false,
      benchPlaced: true,
      friendThreads: 3,
      litConflict: 0.3,
      rumorStuck: false,
      echoForgiveness: 0.5,
      wispPushed: true,
      mossShared: true,
      winterLeft: 0,
      bellDanced: true,
      festivalShare: 0.6,
      greetingSong: 0,
      toveFlew: true,
      heroFamous: false,
      wispHome: false,
      kithHeld: true,
    });
  });
  test('rejects an unknown key', () => {
    expect(() => parseFlags({ ...(load('flags') as object), extra: 1 })).toThrow();
  });
});

test('FLAG_KEYS lists every flag in the schema', () => {
  expect([...FLAG_KEYS].sort()).toEqual(Object.keys(FlagsSchema.shape).sort());
});
