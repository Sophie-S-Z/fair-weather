// A tap-to-reveal carousel in a 4:5 frame: one beat per slide, and the reader sets the pace.
// Each slide acts out its beat and then holds. The punch line is on the last slide.
import { COLOR } from './draw.ts';
import { FONT, play } from './stage.ts';

type Ctx = CanvasRenderingContext2D;

export interface Slide {
  /** One short line under the art. */
  caption: string;
  /** Seconds of action; the slide then holds its last frame. */
  seconds: number;
  /** Draws the art at slide time t. The art box is `w` by `h`, from (0, 0). */
  draw(ctx: Ctx, t: number, w: number, h: number): void;
}

export interface Carousel {
  id: string;
  series: string;
  title: string;
  /** The text alternative: every slide in plain words. */
  label: string;
  slides: readonly Slide[];
}

export const SLIDE_WIDTH = 540;
export const SLIDE_HEIGHT = 675;
/** The art box: the slide less the band for the caption. */
export const ART_W = SLIDE_WIDTH;
export const ART_H = 575;

function render(ctx: Ctx, show: Carousel, starts: readonly number[], t: number, scale: number): void {
  const i = starts.findLastIndex((s) => s <= t);
  const slide = show.slides[i];
  if (!slide) return;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ART_W, ART_H);
  ctx.clip();
  slide.draw(ctx, t - (starts[i] ?? 0), ART_W, ART_H);
  ctx.restore();

  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(0, ART_H, SLIDE_WIDTH, SLIDE_HEIGHT - ART_H);
  ctx.beginPath();
  ctx.moveTo(0, ART_H);
  ctx.lineTo(SLIDE_WIDTH, ART_H);
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `22px ${FONT}`;
  ctx.fillText(slide.caption, SLIDE_WIDTH / 2, ART_H + 42, SLIDE_WIDTH - 40);

  // The series and the slide count, small at the top.
  ctx.font = `bold 11px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 0.55;
  ctx.textAlign = 'left';
  ctx.fillText(`${show.series} · ${show.title}`.toUpperCase(), 18, 26);
  ctx.textAlign = 'right';
  ctx.fillText(`${String(i + 1)} / ${String(show.slides.length)}`, SLIDE_WIDTH - 18, 26);
  ctx.globalAlpha = 1;
  // Dots under the caption show where the reader is.
  const n = show.slides.length;
  for (let k = 0; k < n; k++) {
    ctx.beginPath();
    ctx.arc(SLIDE_WIDTH / 2 + (k - (n - 1) / 2) * 14, ART_H + 80, k === i ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = k === i ? COLOR.accent : '#d6d4cf';
    ctx.fill();
  }
}

/** Plays the carousel: a tap, Next, or the arrow keys go to the next slide. */
export function mountCarousel(show: Carousel): void {
  const starts: number[] = [];
  let seconds = 0;
  for (const slide of show.slides) {
    starts.push(seconds);
    seconds += slide.seconds;
  }
  play({
    id: show.id,
    label: show.label,
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    seconds,
    // With reduced motion, the carousel opens on the last frame of slide 1, and Next steps on.
    still: (starts[1] ?? seconds) - 0.05,
    gifFps: 12.5,
    chapters: starts,
    render: (ctx, t, scale) => {
      render(ctx, show, starts, t, scale);
    },
  });
}
