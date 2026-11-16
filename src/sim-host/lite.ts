// Builds the world-lite snapshot (ADR 0009 item 4). Copies, so later steps do not change it.
import type { World } from '../sim/types.ts';
import { HERO } from '../sim/types.ts';
import type { Tuning } from '../sim/tuning.ts';
import type { WorldLite } from './protocol.ts';
import { holds } from '../sim/daily/gossip.ts';
import { landOf } from '../sim/land.ts';
import { fogAt } from '../sim/light.ts';
import { flies, perceivedShares } from '../sim/packs/fen.ts';
import { friendPairs } from '../sim/metrics.ts';
import { byCodeUnit } from '../sim/math.ts';
import { averageWarmth, byId } from '../sim/world.ts';

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

/** The hero, with each other creature's opinion of it where it has one (ADR 0013 item 8). */
function heroLite(w: World): WorldLite['hero'] {
  const hero = byId(w, HERO);
  if (!w.hero || !hero) return null;
  const opinions: Record<string, number> = {};
  for (const c of w.creatures) {
    const v = c.opinions[HERO];
    if (v !== undefined) opinions[c.id] = v;
  }
  const { kind, reply, gift, keepsakes } = w.hero;
  return { kind, name: hero.name, reply, gift, keepsakes: [...keepsakes], opinions };
}

/**
 * The Fen's flock, the Hollow's fame, or Wisp's choice in Halcyon as the snapshot shows it (ADR
 * 0013 items 5 to 7); null without a pack.
 */
function packLite(w: World, tuning: Tuning): WorldLite['pack'] {
  if (!w.pack) return null;
  if (w.pack.id === 'hollow') return { id: 'hollow', fame: { ...w.pack.fame }, front: w.pack.front };
  if (w.pack.id === 'halcyon') return { id: 'halcyon', chose: w.pack.chose };
  const flying = w.creatures.filter((c) => c.state !== 'away' && flies(w, c)).map((c) => c.id);
  return { id: 'fen', flying, perceived: perceivedShares(w, tuning) };
}

export function toLite(w: World, tuning: Tuning): WorldLite {
  const land = landOf(w, tuning);
  return {
    creatures: w.creatures.map((c) => ({
      id: c.id,
      speciesId: c.speciesId,
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
    hero: heroLite(w),
    pack: packLite(w, tuning),
    light: w.fields.light ? { ...w.fields.light } : null,
    fog: { w: w.fields.fogW, h: w.fields.fogH, cells: fogCells(w, tuning) },
    structures: w.structures.map((s) => ({ ...s })),
    bushes: w.bushes.map((b) => ({ id: b.id, x: b.x, y: b.y, berries: b.berries })),
    water: (w.water ?? []).map((r) => ({ ...r })),
    banks: land.banks.map((r) => ({ ...r })),
    decks: land.decks.map((d) => ({ ...d })),
    islets: land.islets.map((r) => ({ ...r })),
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
    season: w.season,
    day: w.day,
    gateDark: w.gateDark === true,
  };
}
