// A journal page or a Book of Skies year page as an image (ADR 0014 item 8): the layout only,
// with no DOM, so main.ts draws it into a canvas. The image is a file; on screen the text stays HTML.
import { characters } from '../story/journey.ts';

export type PageBlock =
  | { kind: 'title' | 'heading' | 'text' | 'note'; text: string }
  | { kind: 'image'; src: string; width: number; height: number };

/** A line of text, with `y` at the middle of its line box, or an image with its top-left corner. */
export type DrawOp =
  | { op: 'text'; font: string; text: string; x: number; y: number }
  | { op: 'image'; src: string; x: number; y: number; w: number; h: number };

export const PAGE_WIDTH = 1080;
const MARGIN = 72;
/** The line's room: the page less its two margins. */
const LINE_WIDTH = PAGE_WIDTH - 2 * MARGIN;
/** The page's face (ADR 0014 item 14), as a CSS font family. */
export const ATKINSON = '"Atkinson Hyperlegible"';
/** Each kind of text: its CSS font style and weight, and its size in pixels. */
const TYPE = {
  title: { style: 'bold ', size: 48 },
  heading: { style: 'bold ', size: 32 },
  text: { style: '', size: 28 },
  note: { style: 'italic ', size: 24 },
} as const;

/**
 * The lines of `text` in `font`: it wraps at spaces, and a word wider than the line breaks between
 * graphemes. Runs of white space read as one space, as in the HTML.
 */
function wrap(text: string, font: string, measure: (font: string, text: string) => number): string[] {
  const fits = (s: string): boolean => measure(font, s) <= LINE_WIDTH;
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    const joined = line === '' ? word : `${line} ${word}`;
    if (fits(joined)) {
      line = joined;
      continue;
    }
    if (line !== '') lines.push(line);
    line = '';
    for (const g of characters(word)) {
      if (line !== '' && !fits(line + g)) {
        lines.push(line);
        line = '';
      }
      line += g;
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Lays out `blocks` from the top of a PAGE_WIDTH page with 72-pixel margins: each line of text is
 * 1.4 times its size, and an image wider than the line is set to the line width. A text block with
 * only white space, and an image with no width or height, take no room. `measure` gives the width
 * of a text in a CSS font.
 */
export function layoutPage(
  blocks: readonly PageBlock[],
  measure: (font: string, text: string) => number,
): { height: number; ops: DrawOp[] } {
  const ops: DrawOp[] = [];
  let y = MARGIN;
  for (const b of blocks) {
    if (b.kind === 'image') {
      if (b.width <= 0 || b.height <= 0) continue;
      const w = Math.min(b.width, LINE_WIDTH);
      const h = (b.height * w) / b.width;
      ops.push({ op: 'image', src: b.src, x: MARGIN, y, w, h });
      y += h;
      continue;
    }
    if (b.text.trim() === '') continue;
    const { style, size } = TYPE[b.kind];
    // The page's own font (App.svelte) while the face is not there.
    const font = `${style}${String(size)}px ${ATKINSON}, system-ui, sans-serif`;
    const lineHeight = size * 1.4;
    for (const text of wrap(b.text, font, measure)) {
      ops.push({ op: 'text', font, text, x: MARGIN, y: y + lineHeight / 2 });
      y += lineHeight;
    }
  }
  return { height: y + MARGIN, ops };
}
