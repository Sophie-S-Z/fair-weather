// Builds the world-lite snapshot (ADR 0009 item 4). Copies, so later steps do not change it.
import type { World } from '../sim/types.ts';
import type { Tuning } from '../sim/tuning.ts';
import type { WorldLite } from './protocol.ts';
import { holds } from '../sim/daily/gossip.ts';
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
    })),
    ties: [...w.ties]
      .sort(([x], [y]) => byCodeUnit(x, y))
      .map(([, tie]) => ({ a: tie.a, b: tie.b, ab: tie.ab.warmth, ba: tie.ba.warmth })),
    rumor: lastRumor(w, tuning),
    light: w.fields.light ? { ...w.fields.light } : null,
    fog: { w: w.fields.fogW, h: w.fields.fogH, cells: w.fields.fog.slice() },
    structures: w.structures.map((s) => ({ ...s })),
    metrics: {
      averageWarmth: averageWarmth(w),
      friendPairs: friendPairs(w, tuning),
    },
  };
}
