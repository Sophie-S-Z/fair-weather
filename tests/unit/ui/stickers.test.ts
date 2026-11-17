import { expect, it } from 'vitest';
import { BOOK } from '../../../src/ui/stickers.ts';
import { STICKER_IDS } from '../../../src/toy/types.ts';

it('has one sticker per id, three per theme, and no em dashes', () => {
  expect(BOOK.stickers.map((s) => s.id).sort()).toEqual([...STICKER_IDS].sort());
  for (const theme of BOOK.themes) expect(BOOK.stickers.filter((s) => s.theme === theme.id)).toHaveLength(3);
  expect(JSON.stringify(BOOK)).not.toMatch(/—/);
});

it('keeps each lesson sentence short', () => {
  for (const s of BOOK.stickers)
    for (const line of s.lesson) expect(line.split(' ').length).toBeLessThanOrEqual(30);
});
