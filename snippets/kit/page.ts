// A comic page: panels of any shape on one sheet. Each panel plays its own short loop,
// and the page loop is a whole number of each panel's loops, so the page loops too.
import { COLOR } from './draw.ts';
import { play } from './stage.ts';

type Ctx = CanvasRenderingContext2D;
export type Point = readonly [number, number];

export interface Panel {
  /** The corners in page pixels, clockwise, or a circle [x, y, r] for an inset. */
  shape: readonly Point[] | { circle: readonly [number, number, number] };
  /** Loop length; it must divide the page loop. */
  seconds: number;
  /** Narration in a box at (x, y) in page pixels, `width` wide. */
  caption?: { text: string; x: number; y: number; width: number };
  /** Draws the art at panel time t. (0, 0) is the top left of the panel's box, which is w by h. */
  draw(ctx: Ctx, t: number, w: number, h: number): void;
  /** Draws over all frames in page pixels, for things that break out of the panel. */
  over?(ctx: Ctx, t: number): void;
}

export interface Page {
  id: string;
  title: string;
  /** The text alternative: the whole story in plain words. */
  label: string;
  width: number;
  height: number;
  seconds: number;
  still: number;
  gifFps: number;
  panels: readonly Panel[];
}

const FONT = '"Atkinson Hyperlegible", system-ui, sans-serif';
/** The paper ring around each panel; it cuts a gutter where an inset lies over another panel. */
const RING = 14;

/** The panel's box: left, top, width, and height in page pixels. */
function box(panel: Panel): [number, number, number, number] {
  if ('circle' in panel.shape) {
    const [x, y, r] = panel.shape.circle;
    return [x - r, y - r, 2 * r, 2 * r];
  }
  const xs = panel.shape.map((p) => p[0]);
  const ys = panel.shape.map((p) => p[1]);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return [x, y, Math.max(...xs) - x, Math.max(...ys) - y];
}

function outline(ctx: Ctx, panel: Panel): void {
  ctx.beginPath();
  if ('circle' in panel.shape) {
    const [x, y, r] = panel.shape.circle;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    return;
  }
  for (const [x, y] of panel.shape) ctx.lineTo(x, y);
  ctx.closePath();
}

/** Lines of `text` that fit in `width` pixels with the font that is set now. */
function wrap(ctx: Ctx, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  return [...lines, line];
}

/** A narration box: ink text on yellow, with a thin ink edge. */
function caption(ctx: Ctx, { text, x, y, width }: NonNullable<Panel['caption']>): void {
  ctx.font = `13px ${FONT}`;
  const lines = wrap(ctx, text, width - 14);
  const height = lines.length * 16 + 10;
  ctx.fillStyle = COLOR.glow;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => {
    ctx.fillText(l, x + 7, y + 7 + i * 16);
  });
}

function render(ctx: Ctx, page: Page, t: number, scale: number): void {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(0, 0, page.width, page.height);

  ctx.fillStyle = COLOR.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillText(page.title, 20, 50);
  ctx.textAlign = 'right';
  ctx.font = `bold 11px ${FONT}`;
  ctx.globalAlpha = 0.55;
  ctx.fillText('FAIR WEATHER · PAGE 1', page.width - 20, 48);
  ctx.globalAlpha = 1;

  for (const panel of page.panels) {
    const [x, y, w, h] = box(panel);
    outline(ctx, panel);
    ctx.strokeStyle = COLOR.paper;
    ctx.lineWidth = RING;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.translate(x, y);
    panel.draw(ctx, t % panel.seconds, w, h);
    ctx.restore();
    outline(ctx, panel);
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (panel.caption) caption(ctx, panel.caption);
  }
  for (const panel of page.panels) panel.over?.(ctx, t % panel.seconds);
}

/** Plays the page, with the same buttons as a snippet. */
export function mountPage(page: Page): void {
  for (const panel of page.panels) {
    const loops = page.seconds / panel.seconds;
    if (Math.abs(loops - Math.round(loops)) > 1e-9)
      throw new Error(`A panel loop does not divide ${page.id}.`);
  }
  play({
    ...page,
    render: (ctx, t, scale) => {
      render(ctx, page, t, scale);
    },
  });
}
