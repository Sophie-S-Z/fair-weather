import { Container, Graphics, Mesh, MeshGeometry, Texture } from 'pixi.js';
import type { Shell } from '../../sim/types.ts';
import { bodyCenter, boilFrameAt, deform, tighten } from './deform.ts';
import { bodyColor, fillOutline } from './fill.ts';
import { RIG_POINTS, type Rig } from './rig.ts';
import { buildStrip, dashMask, stripIndices, taperedWidth } from './strip.ts';

/** Ink line width in rig units. */
export const INK_WIDTH = 0.05;
/** How far the body moves from paper toward the accent at shell color 1 (spec 5.2). */
const ACCENT_MIX = 0.6;
/** Eye and blush radii in rig units (spec 5.1: two dot eyes, two blush marks). */
const EYE_RADIUS = 0.026;
const BLUSH_RADIUS = 0.038;
const BLUSH_COLOR = 0xf2a39b;
const BLUSH_ALPHA = 0.8;
/** How much of the blush fades at bristle 1: a hungry creature looks pale. */
const BLUSH_HUNGER_FADE = 0.7;
/**
 * The dots are drawn this many times larger and scaled back down: Pixi picks a circle's segment
 * count from its local radius, so this keeps them round. It also keeps the dots under Pixi's
 * 200-vertex limit for batched Graphics.
 */
const DOT_UNITS = 300;

const VERTICES = RIG_POINTS * 2;

/**
 * One creature: a solid body fill, the ink line, then the eyes and blushes. Rig units are scaled
 * to `scale` pixels and y is flipped, so the container origin is the rig's base center. All three
 * parts batch, so a whole scene of creatures takes few draw calls. The body is opaque paper tinted
 * toward the accent by shell color, so a creature in front hides the one behind. It is rebuilt only
 * when the shell or the accent changes, and it leaves out bristle and boil so it never folds over
 * itself. The face moves with the tightness pull, and the second blush mirrors the first across the eyes.
 *
 * `fog` is the fog over the creature: thick fog breaks its line into dashes (spec 11.3).
 * `look` lets a view set the body color (paper tinted by shell color toward the accent by default)
 * and scale the ink width (high contrast thickens it). Both are plain per-frame values, so batching
 * is unchanged.
 */
export function createLineView(
  rig: Rig,
  colors: { ink: number; accent: number; paper: number },
  scale = 120,
): {
  container: Container;
  update(
    shell: Shell,
    seconds: number,
    reducedMotion: boolean,
    fog: number,
    look?: { body: number; widthScale: number },
  ): void;
} {
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
  const { ink, accent, paper } = colors;
  line.tint = ink;
  line.geometry.batchMode = 'batch';

  const dots = new Graphics();
  dots.scale.set(1 / DOT_UNITS);
  container.addChild(body, line, dots);

  const points = new Float32Array(RIG_POINTS * 2);
  const outline = new Float32Array(RIG_POINTS * 2);
  const taper = taperedWidth(INK_WIDTH, RIG_POINTS);
  let widthScale = 1;
  let fogHere = 0;
  const width = (i: number): number => taper(i) * widthScale * dashMask(i, fogHere);
  const [cx, cy] = bodyCenter(rig);
  const { eyeL, eyeR, blush } = rig.markers;
  const blushR: [number, number] = [eyeL[0] + eyeR[0] - blush[0], blush[1]];
  let bodyShell = '';

  /** The eyes and blushes, pulled in with the body and paler when hungry. */
  function drawDots(shell: Shell): void {
    const u = DOT_UNITS;
    const at = (p: readonly [number, number]): [number, number] => {
      const [x, y] = tighten(cx, cy, shell.tightness, p[0], p[1]);
      return [x * u, y * u];
    };
    const alpha = BLUSH_ALPHA * (1 - BLUSH_HUNGER_FADE * shell.bristle);
    dots.clear();
    for (const b of [blush, blushR]) dots.circle(...at(b), BLUSH_RADIUS * u);
    dots.fill({ color: BLUSH_COLOR, alpha });
    for (const e of [eyeL, eyeR]) dots.circle(...at(e), EYE_RADIUS * u);
    dots.fill(ink);
  }

  return {
    container,
    update(shell, seconds, reducedMotion, fog, look) {
      widthScale = look?.widthScale ?? 1;
      fogHere = fog;
      const fill = look?.body ?? bodyColor(paper, accent, shell.color * ACCENT_MIX);
      deform(rig, shell, boilFrameAt(seconds, reducedMotion), points);
      buildStrip(points, width, line.geometry.positions);
      line.geometry.getBuffer('aPosition').update();
      const key = `${String(shell.tightness)},${String(shell.bristle)},${String(shell.color)},${String(shell.softness)},${String(fill)}`;
      if (key !== bodyShell) {
        bodyShell = key;
        drawDots(shell);
        deform(rig, { ...shell, bristle: 0 }, 0, outline);
        body.clear().poly(fillOutline(outline), true).fill(fill);
      }
    },
  };
}
