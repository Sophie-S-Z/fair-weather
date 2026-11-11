import { Container, Graphics, Mesh, MeshGeometry, Texture } from 'pixi.js';
import type { Shell } from '../../sim/types.ts';
import { boilFrameAt, deform } from './deform.ts';
import { fillOutline } from './fill.ts';
import { RIG_POINTS, type Rig } from './rig.ts';
import { buildStrip, stripIndices, taperedWidth } from './strip.ts';

/** Ink line width in rig units. */
const INK_WIDTH = 0.025;
/** Body fill alpha at shell color 1 (spec 5.2: the accent fills the body). */
const ACCENT_ALPHA = 0.6;
/** Eye and blush radii in rig units (spec 5.1: two dot eyes, one small blush mark). */
const EYE_RADIUS = 0.026;
const BLUSH_RADIUS = 0.038;
const BLUSH_COLOR = 0xf2a39b;
const BLUSH_ALPHA = 0.8;
/**
 * The dots are drawn this many times larger and scaled back down: Pixi picks a circle's segment
 * count from its local radius, so this keeps them round. It also keeps the dots under Pixi's
 * 200-vertex limit for batched Graphics.
 */
const DOT_UNITS = 300;

const VERTICES = RIG_POINTS * 2;

/**
 * One creature: the accent body fill, the ink line, then the eyes and blush. Rig units are scaled
 * to `scale` pixels and y is flipped, so the container origin is the rig's base center. All three
 * parts batch, so a whole scene of creatures takes few draw calls. The body fill is rebuilt only
 * when the shell changes, and it leaves out bristle and boil so it never folds over itself.
 */
export function createLineView(
  rig: Rig,
  ink: number,
  accent: number,
  scale = 120,
): { container: Container; update(shell: Shell, seconds: number, reducedMotion: boolean): void } {
  const container = new Container();
  container.scale.set(scale, -scale);

  const body = new Graphics();
  const line = new Mesh({
    geometry: new MeshGeometry({
      positions: new Float32Array(VERTICES * 2),
      uvs: new Float32Array(VERTICES * 2),
      indices: stripIndices(VERTICES),
    }),
    texture: Texture.WHITE,
  });
  line.tint = ink;
  line.geometry.batchMode = 'batch';

  const dots = new Graphics();
  dots.scale.set(1 / DOT_UNITS);
  const u = DOT_UNITS;
  const { eyeL, eyeR, blush } = rig.markers;
  dots.circle(blush[0] * u, blush[1] * u, BLUSH_RADIUS * u).fill({ color: BLUSH_COLOR, alpha: BLUSH_ALPHA });
  dots
    .circle(eyeL[0] * u, eyeL[1] * u, EYE_RADIUS * u)
    .circle(eyeR[0] * u, eyeR[1] * u, EYE_RADIUS * u)
    .fill(ink);
  container.addChild(body, line, dots);

  const points = new Float32Array(RIG_POINTS * 2);
  const outline = new Float32Array(RIG_POINTS * 2);
  const width = taperedWidth(INK_WIDTH, RIG_POINTS);
  let bodyShell = '';

  return {
    container,
    update(shell, seconds, reducedMotion) {
      deform(rig, shell, boilFrameAt(seconds, reducedMotion), points);
      buildStrip(points, width, line.geometry.positions);
      line.geometry.getBuffer('aPosition').update();
      const key = `${String(shell.tightness)},${String(shell.color)},${String(shell.softness)}`;
      if (key !== bodyShell) {
        bodyShell = key;
        body.clear();
        if (shell.color > 0) {
          deform(rig, { ...shell, bristle: 0 }, 0, outline);
          body.poly(fillOutline(outline), true).fill({ color: accent, alpha: shell.color * ACCENT_ALPHA });
        }
      }
    },
  };
}
