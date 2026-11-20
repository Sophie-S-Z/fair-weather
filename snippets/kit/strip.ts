// A four-panel strip in a 4:5 frame, for image feeds. The panels open one after another:
// setup, development, turn, and result. The strip holds on the full grid, then fades and loops.
import { COLOR, easeBack, seg } from './draw.ts';
import { caption } from './page.ts';
import { FONT, play } from './stage.ts';

type Ctx = CanvasRenderingContext2D;

export interface StripPanel {
  /** Narration at the top left of the panel. Keep it short: ten words or fewer. */
  caption?: string;
  /** Seconds before the next panel opens. Give the turn (panel 3) the longest beat. */
  beat: number;
  /**
   * Draws the panel art. `lt` counts from the moment the panel opens and keeps counting to the end of
   * the loop, so a panel can act in its beat and then hold. `t` is the strip time, for the ink boil.
   * (0, 0) is the top left of the panel, which is `w` by `h`.
   */
  draw(ctx: Ctx, lt: number, t: number, w: number, h: number): void;
}

export interface Strip {
  id: string;
  /** The series, shown small over the title. */
  series: string;
  title: string;
  /** The text alternative: the whole joke in plain words. */
  label: string;
  panels: readonly [StripPanel, StripPanel, StripPanel, StripPanel];
  /** Seconds that the full grid holds before the fade. 3 by default. */
  hold?: number;
}

export const STRIP_WIDTH = 540;
export const STRIP_HEIGHT = 675;
const MARGIN = 20;
const GAP = 12;
const TOP = 74;
const BOTTOM = 30;
/** The size of each panel. */
export const PANEL_W = (STRIP_WIDTH - 2 * MARGIN - GAP) / 2;
export const PANEL_H = (STRIP_HEIGHT - TOP - BOTTOM - GAP) / 2;
const FADE = 0.5;

function render(ctx: Ctx, strip: Strip, seconds: number, t: number, scale: number): void {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);

  ctx.fillStyle = COLOR.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `bold 11px ${FONT}`;
  ctx.globalAlpha = 0.55;
  ctx.fillText(strip.series.toUpperCase(), MARGIN, 30);
  ctx.globalAlpha = 1;
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(strip.title, MARGIN, 60);
  ctx.textAlign = 'right';
  ctx.font = `bold 11px ${FONT}`;
  ctx.globalAlpha = 0.55;
  ctx.fillText('FAIR WEATHER', STRIP_WIDTH - MARGIN, STRIP_HEIGHT - 11);
  ctx.globalAlpha = 1;

  const fade = 1 - seg(t, seconds - FADE, seconds);
  let start = 0;
  strip.panels.forEach((panel, i) => {
    const x = MARGIN + (i % 2) * (PANEL_W + GAP);
    const y = TOP + Math.floor(i / 2) * (PANEL_H + GAP);
    const open = easeBack(seg(t, start, start + 0.3));
    if (open > 0 && fade > 0) {
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x + PANEL_W / 2, y + PANEL_H / 2);
      ctx.scale(open, open);
      ctx.translate(-PANEL_W / 2, -PANEL_H / 2);
      ctx.beginPath();
      ctx.rect(0, 0, PANEL_W, PANEL_H);
      ctx.save();
      ctx.clip();
      panel.draw(ctx, t - start, t, PANEL_W, PANEL_H);
      ctx.restore();
      if (panel.caption) caption(ctx, { text: panel.caption, x: 0, y: 0, width: PANEL_W * 0.78 }, 14);
      ctx.restore();
    }
    // The frame shows before the panel opens, so the reader sees the grid that is coming.
    ctx.beginPath();
    ctx.rect(x, y, PANEL_W, PANEL_H);
    ctx.strokeStyle = COLOR.ink;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    start += panel.beat;
  });
}

/** Plays the strip, with the same buttons as a snippet. */
export function mountStrip(strip: Strip): void {
  const seconds = strip.panels.reduce((s, p) => s + p.beat, 0) + (strip.hold ?? 3) + FADE;
  play({
    id: strip.id,
    label: strip.label,
    width: STRIP_WIDTH,
    height: STRIP_HEIGHT,
    seconds,
    // The full grid, just before the fade: the still must carry the punch line.
    still: seconds - FADE - 0.1,
    gifFps: 12.5,
    render: (ctx, t, scale) => {
      render(ctx, strip, seconds, t, scale);
    },
  });
}
