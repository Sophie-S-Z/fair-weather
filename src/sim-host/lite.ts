// Builds the world-lite snapshot (ADR 0009 item 4). Copies, so later steps do not change it.
import type { World } from '../sim/types.ts';
import type { WorldLite } from './protocol.ts';

export function toLite(w: World): WorldLite {
  return {
    creatures: w.creatures.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      state: c.state,
      shell: { ...c.shell },
      berries: c.berries,
      skyWarmth: c.skyWarmth,
    })),
    light: w.fields.light ? { ...w.fields.light } : null,
    fog: { w: w.fields.fogW, h: w.fields.fogH, cells: w.fields.fog.slice() },
    structures: w.structures.map((s) => ({ ...s })),
  };
}
