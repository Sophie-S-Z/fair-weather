import { Graphics } from 'pixi.js';
import type { WorldLite } from '../../sim-host/protocol.ts';
import type { Palette } from '../palette.ts';

/** Disc radius as a fraction of the cell size. */
const DISC = 0.75;

/**
 * The fog grid as a soft wash over the scene (spec 11.3): one disc per foggy cell, a little wider
 * than the cell so neighbors blend into a cloud, its alpha set by the cell's fog. The grid spans `sceneWidth`, so a cell is `sceneWidth / fog.w` wide.
 * It is redrawn only when the cells change.
 */
export function createFog(
  palette: Palette,
  sceneWidth: number,
): { graphics: Graphics; update(fog: WorldLite['fog']): void } {
  const graphics = new Graphics();
  let last = new Float32Array(0);
  return {
    graphics,
    update(fog) {
      if (fog.cells.length === last.length && fog.cells.every((v, i) => v === last[i])) return;
      last = fog.cells.slice();
      graphics.clear();
      const size = sceneWidth / Math.max(1, fog.w);
      fog.cells.forEach((v, i) => {
        if (v <= 0) return;
        const col = i % fog.w;
        const row = (i - col) / fog.w;
        graphics
          .circle((col + 0.5) * size, (row + 0.5) * size, size * DISC)
          .fill({ color: palette.fog.color, alpha: v * palette.fog.alpha });
      });
    },
  };
}
