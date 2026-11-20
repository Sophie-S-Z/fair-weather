// A short vertical clip for Reels, TikTok, and Shorts: full acting, burned-in captions, and sound.
// The captions sit above the bottom fifth of the frame, where the apps put their own buttons.
import { COLOR, seg } from './draw.ts';
import { wrap } from './page.ts';
import { cues, type Cue } from './sound.ts';
import { FONT, play } from './stage.ts';

type Ctx = CanvasRenderingContext2D;

export interface Line {
  from: number;
  to: number;
  text: string;
}

export interface Clip {
  id: string;
  series: string;
  title: string;
  /** The text alternative: the whole clip in plain words. */
  label: string;
  seconds: number;
  /** The best still frame, for reduced motion and the cover. It must carry the punch line. */
  still: number;
  /** Draws the art at time t over the whole frame, `w` by `h`. */
  draw(ctx: Ctx, t: number, w: number, h: number): void;
  /** Burned-in narration. One line at a time, ten words or fewer. */
  lines: readonly Line[];
  sounds: readonly Cue[];
}

export const CLIP_WIDTH = 540;
export const CLIP_HEIGHT = 960;
/** The middle of the caption box. */
const CAPTION_Y = 700;

function line(ctx: Ctx, text: string, alpha: number): void {
  ctx.font = `bold 26px ${FONT}`;
  const lines = wrap(ctx, text, CLIP_WIDTH - 120);
  const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36;
  const height = lines.length * 32 + 20;
  const x = (CLIP_WIDTH - width) / 2;
  const y = CAPTION_Y - height / 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLOR.glow;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = COLOR.ink;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => {
    ctx.fillText(l, CLIP_WIDTH / 2, y + 12 + i * 32);
  });
  ctx.globalAlpha = 1;
}

function render(ctx: Ctx, clip: Clip, t: number, scale: number): void {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, CLIP_WIDTH, CLIP_HEIGHT);
  ctx.clip();
  clip.draw(ctx, t, CLIP_WIDTH, CLIP_HEIGHT);
  ctx.restore();

  // The title sits on a paper card, so it reads on any sky.
  ctx.font = `bold 24px ${FONT}`;
  const titleWidth = ctx.measureText(clip.title).width;
  ctx.font = `bold 13px ${FONT}`;
  const card = Math.max(titleWidth, ctx.measureText(clip.series.toUpperCase()).width) + 28;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = COLOR.paper;
  ctx.beginPath();
  ctx.roundRect(12, 22, card, 64, 10);
  ctx.fill();
  ctx.fillStyle = COLOR.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `bold 13px ${FONT}`;
  ctx.globalAlpha = 0.6;
  ctx.fillText(clip.series.toUpperCase(), 24, 44);
  ctx.globalAlpha = 1;
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText(clip.title, 24, 74);

  for (const l of clip.lines) {
    const alpha = seg(t, l.from, l.from + 0.2) * (1 - seg(t, l.to - 0.2, l.to));
    if (alpha > 0) line(ctx, l.text, alpha);
  }
}

/** Plays the clip, with a Sound button and the save buttons. */
export function mountClip(clip: Clip): void {
  play({
    id: clip.id,
    label: clip.label,
    width: CLIP_WIDTH,
    height: CLIP_HEIGHT,
    seconds: clip.seconds,
    still: clip.still,
    gifFps: 12.5,
    sound: cues(clip.sounds),
    render: (ctx, t, scale) => {
      render(ctx, clip, t, scale);
    },
  });
}
