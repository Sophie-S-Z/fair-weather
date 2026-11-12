import { BufferImageSource, Sprite, Texture } from 'pixi.js';
import type { WorldLite } from '../../sim-host/protocol.ts';

/** In high contrast a wash never covers lines by more than this, so they stay readable. */
const HIGH_CONTRAST_MAX_ALPHA = 0.4;

/**
 * A grid of cells (0..1) as a soft wash over the scene: the fog (spec 11.3), or the heat map. A
 * fog.w x fog.h alpha texture, one texel per cell, stretched over the scene with linear filtering,
 * so cells blend into a cloud in one draw call. The grid spans `sceneWidth`, so a cell is
 * `sceneWidth / fog.w` wide. The texels are rewritten only when the cells change.
 */
export function createWash(
  wash: { color: number; alpha: number },
  sceneWidth: number,
  label = 'fog',
): { sprite: Sprite; update(fog: WorldLite['fog'], highContrast: boolean): void } {
  const sprite = new Sprite({ label });
  sprite.tint = wash.color;
  let source: BufferImageSource | null = null;
  let last = new Float32Array(0);
  return {
    sprite,
    update(fog, highContrast) {
      sprite.alpha = highContrast ? Math.min(wash.alpha, HIGH_CONTRAST_MAX_ALPHA) : wash.alpha;
      sprite.visible = fog.w > 0 && fog.h > 0;
      if (!sprite.visible) return;
      if (fog.cells.length === last.length && fog.cells.every((v, i) => v === last[i])) return;
      last = fog.cells.slice();
      if (!source || source.width !== fog.w || source.height !== fog.h) {
        source?.destroy();
        source = new BufferImageSource({
          resource: new Uint8Array(fog.w * fog.h * 4),
          width: fog.w,
          height: fog.h,
          scaleMode: 'linear',
          alphaMode: 'premultiplied-alpha',
        });
        sprite.texture = new Texture({ source });
        sprite.scale.set(sceneWidth / Math.max(1, fog.w));
      }
      // White, premultiplied: the sprite tint gives the color.
      const texels = source.resource as Uint8Array;
      fog.cells.forEach((v, i) => texels.fill(Math.round(v * 255), 4 * i, 4 * i + 4));
      source.update();
    },
  };
}
