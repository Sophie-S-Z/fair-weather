import { describe, expect, test } from 'vitest';
import { layoutPage, PAGE_WIDTH } from '../../../src/persist/page-image.ts';
import type { DrawOp, PageBlock } from '../../../src/persist/page-image.ts';
import { characters } from '../../../src/story/journey.ts';

/** A fake measure: 14 px per character (grapheme), whatever the font. */
const measure = (_font: string, text: string): number => characters(text).length * 14;
/** The line's room: the page less its two 72-pixel margins. */
const LINE = PAGE_WIDTH - 2 * 72;
const texts = (ops: readonly DrawOp[]): string[] => ops.flatMap((o) => (o.op === 'text' ? [o.text] : []));

describe('layoutPage', () => {
  test('the page is 1080 pixels wide, so a line has 936 pixels', () => {
    expect(PAGE_WIDTH).toBe(1080);
    expect(LINE).toBe(936);
  });

  test('a 200-character text wraps at spaces within 936 px', () => {
    // 40 words of 4 characters, a space after each but the last, which has a fifth.
    const text = `${Array.from({ length: 39 }, (_, i) => `w${String(i % 10)}rd `).join('')}w9rds`;
    expect(characters(text)).toHaveLength(200);
    const lines = texts(layoutPage([{ kind: 'text', text }], measure).ops);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measure('', line)).toBeLessThanOrEqual(LINE);
      expect(line.startsWith(' ') || line.endsWith(' ')).toBe(false);
    }
    // Only spaces break: the words read the same, in the same order.
    expect(lines.join(' ')).toBe(text);
  });

  test('one 80-character word breaks between graphemes and keeps an emoji whole', () => {
    // 66 graphemes fit (924 px). The emoji with its skin tone is the 66th: four UTF-16 units, one grapheme.
    const word = `${'a'.repeat(65)}👍🏽${'b'.repeat(14)}`;
    expect(characters(word)).toHaveLength(80);
    const lines = texts(layoutPage([{ kind: 'title', text: word }], measure).ops);
    expect(lines).toEqual([`${'a'.repeat(65)}👍🏽`, 'b'.repeat(14)]);
  });

  test('each kind of text has its size, weight, and style, and a line is 1.4 times its size', () => {
    for (const [kind, font, size] of [
      ['title', /^bold 48px /, 48],
      ['heading', /^bold 32px /, 32],
      ['text', /^28px /, 28],
      ['note', /^italic 24px /, 24],
    ] as const) {
      const one = layoutPage([{ kind, text: 'x' }], measure);
      const two = layoutPage(
        [
          { kind, text: 'x' },
          { kind, text: 'y' },
        ],
        measure,
      );
      const [op] = one.ops;
      expect(op?.op === 'text' && op.font).toMatch(font);
      expect(op?.op === 'text' && op.font).toContain('Atkinson Hyperlegible');
      expect(op).toMatchObject({ x: 72 });
      expect(two.height - one.height).toBeCloseTo(size * 1.4);
    }
  });

  test('the height grows with each block, and the page has 72-pixel margins', () => {
    const blocks: PageBlock[] = [
      { kind: 'title', text: 'Murmuration Fen' },
      { kind: 'image', src: '/fen.svg', width: 320, height: 200 },
      { kind: 'heading', text: 'What they say about you' },
      { kind: 'text', text: 'They say you share.' },
      { kind: 'note', text: 'A note.' },
    ];
    let last = layoutPage([], measure).height;
    expect(last).toBe(2 * 72);
    for (let n = 1; n <= blocks.length; n += 1) {
      const { height } = layoutPage(blocks.slice(0, n), measure);
      expect(height).toBeGreaterThan(last);
      last = height;
    }
    const { ops } = layoutPage(blocks, measure);
    expect(ops[1]).toEqual({ op: 'image', src: '/fen.svg', x: 72, y: 72 + 48 * 1.4, w: 320, h: 200 });
  });

  test('an image wider than the line is set to the line width, with its aspect kept', () => {
    const { ops } = layoutPage([{ kind: 'image', src: '/a.svg', width: 1872, height: 1000 }], measure);
    expect(ops).toEqual([{ op: 'image', src: '/a.svg', x: 72, y: 72, w: 936, h: 500 }]);
  });

  test('a text block that is empty or only white space takes no room and draws nothing', () => {
    const one = layoutPage([{ kind: 'text', text: 'Reeds' }], measure);
    const blanks: PageBlock[] = [
      { kind: 'text', text: '' },
      { kind: 'note', text: '   ' },
      { kind: 'heading', text: ' \n\t ' },
    ];
    expect(layoutPage([...blanks, { kind: 'text', text: 'Reeds' }], measure)).toEqual(one);
  });

  test('an image block with no width or no height takes no room and draws nothing', () => {
    const one = layoutPage([{ kind: 'text', text: 'Reeds' }], measure);
    const flat: PageBlock[] = [
      { kind: 'image', src: '/a.svg', width: 0, height: 200 },
      { kind: 'image', src: '/b.svg', width: 320, height: 0 },
    ];
    expect(layoutPage([...flat, { kind: 'text', text: 'Reeds' }], measure)).toEqual(one);
  });
});
