import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseFlags } from '../../../src/story/flags.ts';
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
    expect(chs.map((c) => c.verbs.length)).toEqual([1, 2, 3, 4]);
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
    const beats = [{ ...ch.beats[0], actions: [{ dance: true }] }];
    expect(ChapterSchema.safeParse({ ...ch, beats }).success).toBe(false);
  });

  test('notes outside 2 to 4 fail', () => {
    const ch = load('chapters/ch0');
    expect(ChapterSchema.safeParse({ ...(ch as object), notes: ['one'] }).success).toBe(false);
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
    });
  });
  test('rejects an unknown key', () => {
    expect(() => parseFlags({ ...(load('flags') as object), extra: 1 })).toThrow();
  });
});
