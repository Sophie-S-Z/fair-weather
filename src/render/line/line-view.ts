import { Container, Mesh, MeshGeometry, Texture } from 'pixi.js';
import type { Shell } from '../../sim/types.ts';
import { boilFrameAt, deform } from './deform.ts';
import { RIG_POINTS, type Rig } from './rig.ts';
import { buildStrip, stripIndices, taperedWidth } from './strip.ts';

/** Ink line width in rig units. */
const INK_WIDTH = 0.025;
/** Accent stroke width in rig units; drawn behind the ink line. */
const ACCENT_WIDTH = 0.12;
/** Accent alpha at shell color 1. */
const ACCENT_ALPHA = 0.6;

const VERTICES = RIG_POINTS * 2;

function stripMesh(color: number): Mesh {
  const geometry = new MeshGeometry({
    positions: new Float32Array(VERTICES * 2),
    uvs: new Float32Array(VERTICES * 2),
    indices: stripIndices(VERTICES),
  });
  const mesh = new Mesh({ geometry, texture: Texture.WHITE });
  mesh.tint = color;
  return mesh;
}

/**
 * One creature line: an accent stroke (alpha from shell color) behind the ink line. Rig units are
 * scaled to `scale` pixels and y is flipped, so the container origin is the rig's base center.
 * Two draw calls per rig.
 */
export function createLineView(
  rig: Rig,
  color: number,
  scale = 120,
): { container: Container; update(shell: Shell, seconds: number, reducedMotion: boolean): void } {
  const container = new Container();
  container.scale.set(scale, -scale);
  const accent = stripMesh(color);
  const ink = stripMesh(color);
  container.addChild(accent, ink);

  const points = new Float32Array(RIG_POINTS * 2);
  const inkWidth = taperedWidth(INK_WIDTH, RIG_POINTS);
  const accentWidth = taperedWidth(ACCENT_WIDTH, RIG_POINTS);

  return {
    container,
    update(shell, seconds, reducedMotion) {
      deform(rig, shell, boilFrameAt(seconds, reducedMotion), points);
      buildStrip(points, inkWidth, ink.geometry.positions);
      ink.geometry.getBuffer('aPosition').update();
      accent.alpha = shell.color * ACCENT_ALPHA;
      accent.visible = accent.alpha > 0;
      if (accent.visible) {
        buildStrip(points, accentWidth, accent.geometry.positions);
        accent.geometry.getBuffer('aPosition').update();
      }
    },
  };
}
