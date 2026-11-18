// The page around one snippet: the looping canvas, its caption, and the save buttons.
import { COLOR } from './draw.ts';
import { buildPalette, createGif, indexFrame } from './gif.ts';

export interface Scene {
  /** File name for downloads. */
  id: string;
  /** The idea, shown small in the corner. */
  tag: string;
  /** One short sentence that the loop acts out. */
  caption: string;
  /** Loop length; the drawing at `seconds` matches the drawing at 0. */
  seconds: number;
  /** The best still frame, for reduced motion. */
  still: number;
  /** Draws the art area (WIDTH by ART_HEIGHT) at time t, over the sky and the floor. */
  draw(ctx: CanvasRenderingContext2D, t: number): void;
}

export const WIDTH = 480;
export const HEIGHT = 360;
export const ART_HEIGHT = 300;
export const FLOOR = 238;
const GIF_FPS = 25;
const SCALE = 2;
const FONT = '"Atkinson Hyperlegible", system-ui, sans-serif';

/** One full frame at time t, in logical pixels times `scale`. */
export function render(ctx: CanvasRenderingContext2D, scene: Scene, t: number, scale: number): void {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = COLOR.page;
  ctx.fillRect(0, 0, WIDTH, FLOOR);
  ctx.fillStyle = COLOR.floor;
  ctx.fillRect(0, FLOOR, WIDTH, ART_HEIGHT - FLOOR);
  ctx.beginPath();
  ctx.moveTo(0, FLOOR);
  ctx.lineTo(WIDTH, FLOOR);
  ctx.strokeStyle = COLOR.ink;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, WIDTH, ART_HEIGHT);
  ctx.clip();
  scene.draw(ctx, t);
  ctx.restore();

  ctx.fillStyle = COLOR.paper;
  ctx.fillRect(0, ART_HEIGHT, WIDTH, HEIGHT - ART_HEIGHT);
  ctx.fillStyle = COLOR.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `19px ${FONT}`;
  ctx.fillText(scene.caption, WIDTH / 2, (ART_HEIGHT + HEIGHT) / 2, WIDTH - 32);
  ctx.textAlign = 'left';
  ctx.font = `bold 11px ${FONT}`;
  ctx.globalAlpha = 0.55;
  ctx.fillText(scene.tag.toUpperCase(), 16, 20);
  ctx.globalAlpha = 1;
}

const save = (parts: BlobPart[], type: string, name: string): void => {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

const nextTask = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

/** Any looping drawing that the page can play and save: one snippet, or a whole comic page. */
export interface Loop {
  /** File name for downloads. */
  id: string;
  /** The text alternative of the drawing. */
  label: string;
  /** Size in logical pixels. */
  width: number;
  height: number;
  /** Loop length; the drawing at `seconds` matches the drawing at 0. */
  seconds: number;
  /** The best still frame, for reduced motion. */
  still: number;
  /** GIF frames per second; 25 by default. */
  gifFps?: number;
  /** Draws the whole frame at time t, in logical pixels times `scale`. */
  render(ctx: CanvasRenderingContext2D, t: number, scale: number): void;
}

/** The GIF of one loop at 1x size. */
export async function makeGif(loop: Loop): Promise<Uint8Array<ArrayBuffer>[]> {
  const { width, height } = loop;
  const fps = loop.gifFps ?? GIF_FPS;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No 2D canvas.');
  const frames = Math.round(loop.seconds * fps);
  const pixels = (i: number): Uint8ClampedArray => {
    loop.render(ctx, i / fps, 1);
    return ctx.getImageData(0, 0, width, height).data;
  };
  const samples: Uint8ClampedArray[] = [];
  for (let i = 0; i < frames; i += 5) samples.push(pixels(i));
  const palette = buildPalette(samples);
  const gif = createGif(width, height, palette, Math.round(100 / fps));
  for (let i = 0; i < frames; i++) {
    gif.add(indexFrame(pixels(i), palette));
    if (i % 10 === 9) await nextTask();
  }
  return gif.finish();
}

/** Builds the page for one snippet: the loop over the sky and floor, with its caption. */
export function mount(scene: Scene): void {
  play({
    id: scene.id,
    label: scene.caption,
    width: WIDTH,
    height: HEIGHT,
    seconds: scene.seconds,
    still: scene.still,
    render: (ctx, t, scale) => {
      render(ctx, scene, t, scale);
    },
  });
}

/** Plays a loop on a canvas, with buttons that pause it or save it. */
export function play(loop: Loop): void {
  const canvas = document.createElement('canvas');
  canvas.width = loop.width * SCALE;
  canvas.height = loop.height * SCALE;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', loop.label);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas.');

  const bar = document.createElement('div');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const button = (label: string, act: () => void | Promise<void>): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => {
      void act();
    });
    bar.append(b);
    return b;
  };

  // `?t=2` opens the snippet paused at 2 seconds; reduced motion opens it paused at its still.
  const fixed = Number.parseFloat(new URLSearchParams(location.search).get('t') ?? '');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let playing = !reduced && Number.isNaN(fixed);
  let t = Number.isNaN(fixed) ? (reduced ? loop.still : 0) : fixed % loop.seconds;
  let last = performance.now();
  const play = button(playing ? 'Pause' : 'Play', () => {
    playing = !playing;
    play.textContent = playing ? 'Pause' : 'Play';
  });
  button('Save PNG', () => {
    canvas.toBlob((blob) => {
      if (blob) save([blob], 'image/png', `${loop.id}.png`);
    });
  });
  const gifButton = button('Save GIF', async () => {
    gifButton.disabled = true;
    status.textContent = 'Making the GIF…';
    save(await makeGif(loop), 'image/gif', `${loop.id}.gif`);
    status.textContent = 'GIF saved.';
    gifButton.disabled = false;
  });
  const type = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find(
    (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
  );
  if (type) {
    const videoButton = button('Save video', () => {
      videoButton.disabled = true;
      status.textContent = 'Recording one loop…';
      const recorder = new MediaRecorder(canvas.captureStream(60), {
        mimeType: type,
        videoBitsPerSecond: 6e6,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        save(chunks, type, `${loop.id}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`);
        status.textContent = 'Video saved.';
        videoButton.disabled = false;
      };
      t = 0;
      playing = true;
      play.textContent = 'Pause';
      recorder.start();
      setTimeout(() => {
        recorder.stop();
      }, loop.seconds * 1000);
    });
  }

  document.body.append(canvas, bar, status);
  const frame = (now: number): void => {
    if (playing) t = (t + (now - last) / 1000) % loop.seconds;
    last = now;
    loop.render(ctx, t, SCALE);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
