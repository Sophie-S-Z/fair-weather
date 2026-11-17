import { expect, test } from 'vitest';
import { buildPalette, createGif, indexFrame } from '../../../snippets/kit/gif.ts';

/** RGBA pixels from RGB triples. */
const rgba = (...colors: [number, number, number][]): Uint8ClampedArray =>
  Uint8ClampedArray.from(colors.flatMap((c) => [...c, 255]));

test('buildPalette keeps each color of a flat drawing exactly', () => {
  const ink: [number, number, number] = [43, 42, 40];
  const paper: [number, number, number] = [255, 253, 248];
  const palette = buildPalette([rgba(ink, paper, paper, paper)]);
  const [i, p] = [palette.index(...ink), palette.index(...paper)];
  expect([...palette.colors.slice(i * 3, i * 3 + 3)]).toEqual(ink);
  expect([...palette.colors.slice(p * 3, p * 3 + 3)]).toEqual(paper);
  // The most common color comes first.
  expect(p).toBe(0);
});

test('a color missing from the palette maps to the nearest one', () => {
  const palette = buildPalette([rgba([0, 0, 0], [250, 250, 250])]);
  const frame = indexFrame(rgba([30, 20, 10], [200, 220, 230]), palette);
  expect([...frame]).toEqual([palette.index(0, 0, 0), palette.index(250, 250, 250)]);
});

test('createGif writes a looping GIF89a with one image per frame and a trailer', () => {
  const palette = buildPalette([rgba([0, 0, 0], [255, 255, 255])]);
  const gif = createGif(2, 2, palette, 4);
  gif.add(Uint8Array.of(0, 1, 1, 0));
  gif.add(Uint8Array.of(1, 1, 1, 1));
  const parts = gif.finish();
  const bytes = Uint8Array.from(parts.flatMap((p) => [...p]));
  expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe('GIF89a');
  expect(new TextDecoder().decode(bytes)).toContain('NETSCAPE2.0');
  expect(parts).toHaveLength(4);
  expect(bytes.at(-1)).toBe(0x3b);
});
