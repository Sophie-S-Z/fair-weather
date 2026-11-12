// Builds the world-lite snapshot (ADR 0009 item 4). Copies, so later steps do not change it.
import type { World } from '../sim/types.ts';
import type { Tuning } from '../sim/tuning.ts';
import type { WorldLite } from './protocol.ts';
import { holds } from '../sim/daily/gossip.ts';
import { fogAt } from '../sim/light.ts';
import { friendPairs } from '../sim/metrics.ts';
import { byCodeUnit } from '../sim/math.ts';
import { averageWarmth } from '../sim/world.ts';

/** The latest rumor and the creatures that hold it (ADR 0012 item 2). */
function lastRumor(w: World, tuning: Tuning): WorldLite['rumor'] {
  const r = w.rumors.at(-1);
  if (!r) return null;
  const holders = w.creatures
    .filter((c) => c.state !== 'away' && c.id !== r.about && holds(c, r.about, r.sign, tuning))
    .map((c) => c.id)
    .sort(byCodeUnit);
  return { about: r.about, sign: r.sign, holders };
}

/**
 * Each fog cell as the sim reads fog at the cell's center (sim/light.ts fogAt), so a lantern's
 * lessening shows in the wash and in the dashes.
 */
function fogCells(w: World, tuning: Tuning): Float32Array {
  const { fogW, fogH } = w.fields;
  const size = tuning.fog.cellSize;
  const cells = new Float32Array(fogW * fogH);
  for (let row = 0; row < fogH; row++) {
    for (let col = 0; col < fogW; col++) {
      cells[row * fogW + col] = fogAt(w, (col + 0.5) * size, (row + 0.5) * size, tuning);
    }
  }
  return cells;
}

export function toLite(w: World, tuning: Tuning): WorldLite {
  return {
    creatures: w.creatures.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      state: c.state,
      shell: { ...c.shell },
      berries: c.berries,
      skyWarmth: c.skyWarmth,
      dials: { ...c.dials },
      dancing: c.dancing === true,
      gone: c.gone === true,
    })),
    ties: [...w.ties]
      .sort(([x], [y]) => byCodeUnit(x, y))
      .map(([, tie]) => ({ a: tie.a, b: tie.b, ab: tie.ab.warmth, ba: tie.ba.warmth })),
    rumor: lastRumor(w, tuning),
    light: w.fields.light ? { ...w.fields.light } : null,
    fog: { w: w.fields.fogW, h: w.fields.fogH, cells: fogCells(w, tuning) },
    structures: w.structures.map((s) => ({ ...s })),
    bushes: w.bushes.map((b) => ({ ...b })),
    water: (w.water ?? []).map((r) => ({ ...r })),
    mushroom: w.mushroom
      ? {
          x: w.mushroom.x,
          y: w.mushroom.y,
          drops: w.mushroom.drops - w.mushroom.taken,
          witherDays: w.mushroom.witherDays,
        }
      : null,
    metrics: {
      averageWarmth: averageWarmth(w),
      friendPairs: friendPairs(w, tuning),
    },
  };
}
