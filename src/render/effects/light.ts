import { Graphics } from 'pixi.js';
import type { Palette } from '../palette.ts';

/** Stacked discs per glow: the center gets every disc, the edge only the widest, so it fades out. */
const RINGS = 6;

/** The light lens as a warm radial glow of `radius` scene units that follows the lens (spec 11.3). */
export function createLight(
  palette: Palette,
  radius: number,
): { graphics: Graphics; update(light: { x: number; y: number } | null): void } {
  const graphics = new Graphics({ label: 'light' });
  const fill = { color: palette.light.color, alpha: palette.light.alpha / RINGS };
  for (let i = RINGS; i >= 1; i--) graphics.circle(0, 0, (radius * i) / RINGS).fill(fill);
  return {
    graphics,
    update(light) {
      graphics.visible = light !== null;
      if (light) graphics.position.set(light.x, light.y);
    },
  };
}
