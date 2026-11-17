import { describe, expect, it } from 'vitest';
import { loadFound, saveFound, type StickerStorage } from '../../../src/persist/stickers.ts';

const memory = (): StickerStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
};

const known = ['standoff', 'copycat', 'lever'];

describe('sticker store', () => {
  it('saves and loads found ids in the known order', () => {
    const s = memory();
    saveFound(s, ['lever', 'standoff']);
    expect(loadFound(s, known)).toEqual(['standoff', 'lever']);
  });

  it('drops unknown ids and reads bad data as none', () => {
    const s = memory();
    s.setItem('fair-weather.stickers', '["ghost","copycat"]');
    expect(loadFound(s, known)).toEqual(['copycat']);
    s.setItem('fair-weather.stickers', '{oops');
    expect(loadFound(s, known)).toEqual([]);
  });

  it('clears the key when nothing is found', () => {
    const s = memory();
    saveFound(s, ['lever']);
    saveFound(s, []);
    expect(s.data.size).toBe(0);
  });

  it('survives blocked storage', () => {
    const blocked: StickerStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadFound(blocked, known)).toEqual([]);
    expect(() => {
      saveFound(blocked, ['lever']);
    }).not.toThrow();
    expect(loadFound(null, known)).toEqual([]);
  });
});
